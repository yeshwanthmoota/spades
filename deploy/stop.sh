#!/bin/bash
# ─────────────────────────────────────────────────────────────
#  stop.sh — Safely stop the Spades application
#  Usage:  ~/spades/deploy/stop.sh
#          ~/spades/deploy/stop.sh --all   (also stops Nginx)
# ─────────────────────────────────────────────────────────────

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

ok()   { echo -e "${GREEN}✔  $1${NC}"; }
info() { echo -e "${YELLOW}➜  $1${NC}"; }

STOP_NGINX=false
[[ "$1" == "--all" ]] && STOP_NGINX=true

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "          ♠  SPADES  —  Stopping App"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── 1. Stop Node server via PM2 ───────────────────────────────
if command -v pm2 &>/dev/null; then
  if pm2 list | grep -q "spades-server"; then
    info "Stopping spades-server..."
    pm2 stop spades-server --silent
    ok "spades-server stopped"
  else
    ok "spades-server was not running"
  fi
else
  echo -e "${YELLOW}⚠  PM2 not found — skipping Node server${NC}"
fi

# ── 2. Stop Nginx (only with --all flag) ─────────────────────
if $STOP_NGINX; then
  if sudo systemctl is-active --quiet nginx; then
    info "Stopping Nginx..."
    sudo systemctl stop nginx
    ok "Nginx stopped"
  else
    ok "Nginx was already stopped"
  fi
else
  ok "Nginx left running (use --all to stop it too)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ok "App stopped cleanly"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  To start again:    deploy/start.sh"
echo "  To check status:   pm2 list"
echo ""
