#!/bin/bash
# ─────────────────────────────────────────────────────────────
#  start.sh — Start / restart the Spades application
#  Run from anywhere:  ~/spades/deploy/start.sh
# ─────────────────────────────────────────────────────────────

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

ok()   { echo -e "${GREEN}✔ $1${NC}"; }
info() { echo -e "${YELLOW}➜ $1${NC}"; }
fail() { echo -e "${RED}✖ $1${NC}"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "          ♠  SPADES  —  Starting App"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── 1. Nginx ──────────────────────────────────────────────────
info "Checking Nginx..."
if sudo systemctl is-active --quiet nginx; then
  ok "Nginx already running"
else
  sudo systemctl start nginx
  ok "Nginx started"
fi

# ── 2. PM2 + Node server ──────────────────────────────────────
info "Checking PM2..."
if ! command -v pm2 &>/dev/null; then
  fail "PM2 not found. Run deploy/setup.sh first."
  exit 1
fi

if pm2 list | grep -q "spades-server"; then
  info "Restarting existing PM2 process..."
  pm2 restart spades-server
  ok "spades-server restarted"
else
  info "Starting server with PM2..."
  cd "$ROOT_DIR/server"
  pm2 start index.js --name spades-server
  pm2 save
  ok "spades-server started and saved"
fi

# ── 3. Health check ───────────────────────────────────────────
info "Waiting for server to come up..."
sleep 2

if curl -sf http://localhost:3001 > /dev/null 2>&1; then
  ok "Server is responding on port 3001"
else
  fail "Server did not respond on port 3001 — check: pm2 logs spades-server"
fi

# ── 4. Public IP ──────────────────────────────────────────────
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
echo "  pm2 logs spades-server    — view live logs"
echo "  pm2 stop spades-server    — stop the server"
echo "  deploy/check.sh           — full health check"
echo ""
