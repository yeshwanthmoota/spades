#!/bin/bash

# ─────────────────────────────────────────────────────────────────────────────
#  Spades Game — Health Check Script
#  Verifies every component is installed and running correctly.
#
#  Usage:  bash ~/spades-game/deploy/check.sh
# ─────────────────────────────────────────────────────────────────────────────

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WEB_ROOT="/var/www/spades"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'

PASS=0; FAIL=0

pass() { echo -e "  ${GREEN}✔${NC}  $1"; ((PASS++)); }
fail() { echo -e "  ${RED}✘${NC}  $1"; ((FAIL++)); }
warn() { echo -e "  ${YELLOW}!${NC}  $1"; }
section() { echo -e "\n${CYAN}── $1 ──${NC}"; }

echo -e "${CYAN}"
echo "  ♠  Spades Game — Health Check"
echo -e "${NC}"

# ── Node.js ───────────────────────────────────────────────────────────────────
section "Node.js"
if command -v node &>/dev/null; then
  NODE_VER=$(node -v)
  MAJOR=$(echo "$NODE_VER" | sed 's/v\([0-9]*\).*/\1/')
  if [ "$MAJOR" -ge 18 ]; then
    pass "Node.js $NODE_VER"
  else
    fail "Node.js $NODE_VER — version 18+ required"
  fi
else
  fail "Node.js not found"
fi

if command -v npm &>/dev/null; then
  pass "npm $(npm -v)"
else
  fail "npm not found"
fi

# ── PM2 ───────────────────────────────────────────────────────────────────────
section "PM2"
if command -v pm2 &>/dev/null; then
  pass "PM2 $(pm2 -v) installed"

  PM2_STATUS=$(pm2 jlist 2>/dev/null)
  SERVER_STATUS=$(echo "$PM2_STATUS" | node -e "
    const list = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    const s = list.find(p => p.name === 'spades-server');
    if (!s) process.stdout.write('not_found');
    else process.stdout.write(s.pm2_env.status);
  " 2>/dev/null)

  case "$SERVER_STATUS" in
    online)      pass "spades-server is running (online)" ;;
    not_found)   fail "spades-server not found in PM2 — run setup.sh" ;;
    stopped)     fail "spades-server is stopped — run: pm2 start spades-server" ;;
    errored)     fail "spades-server errored — run: pm2 logs spades-server" ;;
    *)           warn "spades-server status: ${SERVER_STATUS:-unknown}" ;;
  esac

  # Check if PM2 is set to auto-start on reboot
  if systemctl is-enabled pm2-ubuntu &>/dev/null 2>&1; then
    pass "PM2 startup service enabled (survives reboot)"
  else
    warn "PM2 startup not configured — run: sudo env PATH=\$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu"
  fi
else
  fail "PM2 not found — run: sudo npm install -g pm2"
fi

# ── Node server port ──────────────────────────────────────────────────────────
section "Node.js Server (port 3001)"
if command -v ss &>/dev/null; then
  if ss -tlnp 2>/dev/null | grep -q ':3001'; then
    pass "Port 3001 is listening"
  else
    fail "Nothing listening on port 3001 — server may be down"
  fi
elif command -v netstat &>/dev/null; then
  if netstat -tlnp 2>/dev/null | grep -q ':3001'; then
    pass "Port 3001 is listening"
  else
    fail "Nothing listening on port 3001"
  fi
else
  warn "Cannot check port 3001 (ss/netstat not available)"
fi

# Quick HTTP probe on the Node server directly
if curl -s --max-time 3 http://localhost:3001 -o /dev/null; then
  pass "Node server responds on http://localhost:3001"
else
  fail "Node server not responding on http://localhost:3001"
fi

# ── Nginx ─────────────────────────────────────────────────────────────────────
section "Nginx"
if command -v nginx &>/dev/null; then
  pass "Nginx $(nginx -v 2>&1 | grep -o '[0-9.]*$') installed"
else
  fail "Nginx not installed"
fi

if systemctl is-active --quiet nginx; then
  pass "Nginx service is running"
else
  fail "Nginx is not running — run: sudo systemctl start nginx"
fi

if sudo nginx -t -q 2>/dev/null; then
  pass "Nginx config is valid"
else
  fail "Nginx config has errors — run: sudo nginx -t"
fi

if [ -f /etc/nginx/sites-enabled/spades ]; then
  pass "Spades site config is enabled"
else
  fail "Spades Nginx config not enabled — run setup.sh"
fi

# ── Web root ──────────────────────────────────────────────────────────────────
section "React Build ($WEB_ROOT)"
if [ -f "$WEB_ROOT/index.html" ]; then
  pass "index.html exists"
else
  fail "index.html missing — React app not built or not copied"
fi

if [ -d "$WEB_ROOT/assets" ]; then
  ASSET_COUNT=$(find "$WEB_ROOT/assets" -type f | wc -l)
  pass "$ASSET_COUNT asset files present"
else
  fail "assets/ folder missing — React build may be incomplete"
fi

# ── Socket.io proxy ───────────────────────────────────────────────────────────
section "Socket.io Proxy (Nginx → Node)"
SOCKET_CHECK=$(curl -s --max-time 5 \
  -o /dev/null -w "%{http_code}" \
  "http://localhost/socket.io/?EIO=4&transport=polling" 2>/dev/null)
if [[ "$SOCKET_CHECK" == "200" ]]; then
  pass "Socket.io endpoint reachable via Nginx (/socket.io/)"
else
  fail "Socket.io endpoint returned HTTP $SOCKET_CHECK (expected 200) — check Nginx proxy config"
fi

# ── Public IP ─────────────────────────────────────────────────────────────────
section "Network"
TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 21600" 2>/dev/null)
PUBLIC_IP=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null)
[ -z "$PUBLIC_IP" ] && PUBLIC_IP=$(curl -s https://checkip.amazonaws.com 2>/dev/null)

if [ -n "$PUBLIC_IP" ]; then
  pass "Public IP: $PUBLIC_IP"
  # Test the full stack from the outside via HTTP on port 80
  HTTP_CHECK=$(curl -s --max-time 5 -o /dev/null -w "%{http_code}" "http://$PUBLIC_IP" 2>/dev/null)
  if [[ "$HTTP_CHECK" == "200" ]]; then
    pass "Game is reachable at http://$PUBLIC_IP"
  else
    warn "http://$PUBLIC_IP returned HTTP $HTTP_CHECK — check security group allows port 80"
  fi
else
  warn "Could not determine public IP"
fi

# ── App files ─────────────────────────────────────────────────────────────────
section "Project Files"
for f in server/index.js server/gameLogic.js server/roomManager.js server/package.json \
          client/package.json deploy/nginx.conf; do
  if [ -f "$APP_DIR/$f" ]; then
    pass "$f"
  else
    fail "$f missing"
  fi
done

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
TOTAL_CHECKS=$((PASS + FAIL))
if [ "$FAIL" -eq 0 ]; then
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo -e "  ✔  All $TOTAL_CHECKS checks passed — game is ready!"
  [ -n "$PUBLIC_IP" ] && echo -e "  →  http://$PUBLIC_IP"
  echo -e "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
else
  echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo -e "  $FAIL of $TOTAL_CHECKS checks failed"
  echo -e "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "  Re-run setup : ${YELLOW}bash $APP_DIR/deploy/setup.sh${NC}"
  echo -e "  Server logs  : ${YELLOW}pm2 logs spades-server${NC}"
  echo -e "  Nginx logs   : ${YELLOW}sudo tail -f /var/log/nginx/error.log${NC}"
fi
echo ""
