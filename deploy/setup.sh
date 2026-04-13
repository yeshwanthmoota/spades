#!/bin/bash
set -e

# ─────────────────────────────────────────────────────────────────────────────
#  Spades Game — EC2 Setup Script
#
#  Usage (from your local machine):
#    scp -i your-key.pem -r ./spades-game ubuntu@<EC2-IP>:~/spades-game
#    ssh -i your-key.pem ubuntu@<EC2-IP>
#    bash ~/spades-game/deploy/setup.sh
# ─────────────────────────────────────────────────────────────────────────────

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WEB_ROOT="/var/www/spades"

# ── Helpers ───────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
step()  { echo -e "\n${YELLOW}[$1/$TOTAL] $2...${NC}"; }
ok()    { echo -e "${GREEN}  ✔ $1${NC}"; }
TOTAL=8

echo -e "${GREEN}"
echo "  ♠  Spades Game — EC2 Setup"
echo "  App dir: $APP_DIR"
echo -e "${NC}"

# ── 1. System packages ────────────────────────────────────────────────────────
step 1 "Updating system packages"
sudo apt-get update -y -q
sudo apt-get upgrade -y -q
ok "System packages up to date"

# ── 2. Node.js 20 ─────────────────────────────────────────────────────────────
step 2 "Installing Node.js 20"
if command -v node &>/dev/null && [[ "$(node -v)" == v20* ]]; then
  ok "Node.js 20 already installed ($(node -v))"
else
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y -q nodejs
  ok "Installed Node.js $(node -v) / npm $(npm -v)"
fi

# ── 3. PM2 ────────────────────────────────────────────────────────────────────
step 3 "Installing PM2"
if command -v pm2 &>/dev/null; then
  ok "PM2 already installed ($(pm2 -v))"
else
  sudo npm install -g pm2 --quiet
  ok "PM2 installed ($(pm2 -v))"
fi

# ── 4. Nginx ──────────────────────────────────────────────────────────────────
step 4 "Installing Nginx"
if command -v nginx &>/dev/null; then
  ok "Nginx already installed"
else
  sudo apt-get install -y -q nginx
  ok "Nginx installed"
fi
sudo systemctl enable nginx --quiet

# ── 5. npm dependencies ───────────────────────────────────────────────────────
step 5 "Installing dependencies"
cd "$APP_DIR/server" && npm install --omit=dev --quiet
ok "Server dependencies installed"
cd "$APP_DIR/client" && npm install --quiet
ok "Client dependencies installed"

# ── 6. Build React client ─────────────────────────────────────────────────────
step 6 "Building React client"
cd "$APP_DIR/client" && npm run build
ok "React build complete → server/public/"

# ── 7. Deploy build + configure Nginx ────────────────────────────────────────
step 7 "Deploying build and configuring Nginx"
sudo mkdir -p "$WEB_ROOT"
sudo cp -r "$APP_DIR/server/public/." "$WEB_ROOT/"
sudo chown -R www-data:www-data "$WEB_ROOT"
ok "Build copied to $WEB_ROOT"

sudo cp "$APP_DIR/deploy/nginx.conf" /etc/nginx/sites-available/spades
sudo ln -sf /etc/nginx/sites-available/spades /etc/nginx/sites-enabled/spades
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t -q
sudo systemctl restart nginx
ok "Nginx configured and restarted"

# ── 8. Start Node server with PM2 ─────────────────────────────────────────────
step 8 "Starting Node.js server with PM2"
cd "$APP_DIR/server"
pm2 delete spades-server 2>/dev/null || true
pm2 start index.js --name spades-server
pm2 save --force
sudo env PATH="$PATH:/usr/bin" pm2 startup systemd -u ubuntu --hp /home/ubuntu | tail -1 | sudo bash || true
ok "spades-server running under PM2"

# ── Done ──────────────────────────────────────────────────────────────────────
TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 21600" 2>/dev/null)
PUBLIC_IP=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null)
[ -z "$PUBLIC_IP" ] && PUBLIC_IP=$(curl -s https://checkip.amazonaws.com 2>/dev/null)
[ -z "$PUBLIC_IP" ] && PUBLIC_IP="<your-ec2-ip>"

echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  ✔  Setup complete!"
echo -e "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  Game URL  : http://$PUBLIC_IP"
echo -e "  Run check : bash $APP_DIR/deploy/check.sh"
echo -e "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
