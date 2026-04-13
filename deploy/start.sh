#!/bin/bash
# ─────────────────────────────────────────────────────────────
#  start.sh — Build (if needed) and start the Spades app
#  Usage:  ~/spades/deploy/start.sh          (smart rebuild)
#          ~/spades/deploy/start.sh --force  (always rebuild)
# ─────────────────────────────────────────────────────────────

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

ok()   { echo -e "${GREEN}✔  $1${NC}"; }
info() { echo -e "${YELLOW}➜  $1${NC}"; }
fail() { echo -e "${RED}✖  $1${NC}"; exit 1; }
step() { echo -e "${CYAN}$1${NC}"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
CLIENT_DIR="$ROOT_DIR/client"
SERVER_DIR="$ROOT_DIR/server"
BUILD_DIR="$SERVER_DIR/public"
FORCE_BUILD=false

[[ "$1" == "--force" ]] && FORCE_BUILD=true

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "          ♠  SPADES  —  Starting App"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── 1. Install dependencies if node_modules missing ───────────
step "[1/5] Checking dependencies..."

if [ ! -d "$CLIENT_DIR/node_modules" ]; then
  info "Installing client dependencies..."
  cd "$CLIENT_DIR" && npm install --silent
  ok "Client dependencies installed"
else
  ok "Client dependencies present"
fi

if [ ! -d "$SERVER_DIR/node_modules" ]; then
  info "Installing server dependencies..."
  cd "$SERVER_DIR" && npm install --silent
  ok "Server dependencies installed"
else
  ok "Server dependencies present"
fi

# ── 2. Rebuild React if source is newer than build ────────────
step "[2/5] Checking React build..."

needs_build() {
  # Always build if forced or build folder missing or index.html missing
  $FORCE_BUILD && return 0
  [ ! -d "$BUILD_DIR" ] && return 0
  [ ! -f "$BUILD_DIR/index.html" ] && return 0

  # Check if any source file is newer than the build output
  LATEST_SRC=$(find "$CLIENT_DIR/src" "$CLIENT_DIR/index.html" \
    "$CLIENT_DIR/vite.config.js" "$CLIENT_DIR/tailwind.config.js" \
    -newer "$BUILD_DIR/index.html" 2>/dev/null | head -1)

  [ -n "$LATEST_SRC" ]
}

if needs_build; then
  info "Building React app (this takes ~30s)..."
  cd "$CLIENT_DIR"
  npm run build 2>&1 | tail -5   # show last 5 lines of build output

  # Copy dist → server/public
  rm -rf "$BUILD_DIR"
  cp -r "$CLIENT_DIR/dist" "$BUILD_DIR"
  ok "React build complete → server/public"
else
  ok "React build is up to date (use --force to rebuild)"
fi

# ── 3. Nginx ──────────────────────────────────────────────────
step "[3/5] Checking Nginx..."

if ! command -v nginx &>/dev/null; then
  fail "Nginx not found. Run deploy/setup.sh first."
fi

if sudo systemctl is-active --quiet nginx; then
  ok "Nginx already running"
else
  sudo systemctl start nginx
  ok "Nginx started"
fi

# ── 4. PM2 + Node server ──────────────────────────────────────
step "[4/5] Starting Node server..."

if ! command -v pm2 &>/dev/null; then
  fail "PM2 not found. Run deploy/setup.sh first."
fi

if pm2 list | grep -q "spades-server"; then
  pm2 restart spades-server --silent
  ok "spades-server restarted"
else
  cd "$SERVER_DIR"
  pm2 start index.js --name spades-server --silent
  pm2 save --silent
  ok "spades-server started and saved to PM2"
fi

# ── 5. Health check ───────────────────────────────────────────
step "[5/5] Health check..."
sleep 2

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "304" ]; then
  ok "Node server responding (HTTP $HTTP_CODE)"
else
  echo -e "${RED}✖  Node server not responding (HTTP $HTTP_CODE)${NC}"
  echo -e "   Run: ${YELLOW}pm2 logs spades-server --lines 20${NC}"
fi

NGINX_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost 2>/dev/null || echo "000")
if [ "$NGINX_CODE" = "200" ] || [ "$NGINX_CODE" = "304" ]; then
  ok "Nginx responding on port 80 (HTTP $NGINX_CODE)"
else
  echo -e "${RED}✖  Nginx not responding on port 80 (HTTP $NGINX_CODE)${NC}"
  echo -e "   Run: ${YELLOW}sudo nginx -t${NC}"
fi

# ── Public IP ─────────────────────────────────────────────────
TOKEN=$(curl -sf -X PUT "http://169.254.169.254/latest/api/token" \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 21600" 2>/dev/null || true)
if [ -n "$TOKEN" ]; then
  PUBLIC_IP=$(curl -sf -H "X-aws-ec2-metadata-token: $TOKEN" \
    http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || true)
fi
if [ -z "$PUBLIC_IP" ]; then
  PUBLIC_IP=$(curl -sf https://checkip.amazonaws.com 2>/dev/null || echo "unknown")
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ok "App is live!  →  http://${PUBLIC_IP}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Useful commands:"
echo "    pm2 logs spades-server       — live server logs"
echo "    deploy/stop.sh               — stop everything safely"
echo "    deploy/check.sh              — full health check"
echo "    deploy/start.sh --force      — force a full rebuild"
echo ""
