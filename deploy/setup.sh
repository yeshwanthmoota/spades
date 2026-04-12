#!/bin/bash
set -e

# ─── Configuration ────────────────────────────────────────────────────────────
# Run this script from inside the spades-game directory you uploaded to EC2.
# Example:
#   scp -i your-key.pem -r ./spades-game ubuntu@<EC2-IP>:~/spades-game
#   ssh -i your-key.pem ubuntu@<EC2-IP>
#   cd ~/spades-game && bash deploy/setup.sh

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"   # resolves to the project root
WEB_ROOT="/var/www/spades"

echo "=== Spades Game — EC2 Setup Script ==="
echo "App directory: $APP_DIR"
echo ""

# ─── 1. Update system packages ────────────────────────────────────────────────
echo "[1/8] Updating system packages..."
sudo apt-get update -y
sudo apt-get upgrade -y

# ─── 2. Install Node.js 20 via nvm ────────────────────────────────────────────
echo "[2/8] Installing Node.js 20 via nvm..."
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
export NVM_DIR="$HOME/.nvm"
# shellcheck source=/dev/null
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 20
nvm use 20
nvm alias default 20
echo "Node version: $(node -v)"
echo "npm version:  $(npm -v)"

# ─── 3. Install PM2 globally ──────────────────────────────────────────────────
echo "[3/8] Installing PM2..."
npm install -g pm2

# ─── 4. Install and configure Nginx ───────────────────────────────────────────
echo "[4/8] Installing Nginx..."
sudo apt-get install -y nginx
sudo systemctl enable nginx

# ─── 5. Install dependencies ──────────────────────────────────────────────────
echo "[5/8] Installing server dependencies..."
cd "$APP_DIR/server"
npm install --production

echo "Installing client dependencies..."
cd "$APP_DIR/client"
npm install

# ─── 6. Build the React client ────────────────────────────────────────────────
echo "[6/8] Building React client..."
cd "$APP_DIR/client"
npm run build
# Output goes to server/public (per vite.config.js)

# ─── 7. Deploy build + configure Nginx ───────────────────────────────────────
echo "[7/8] Deploying build to $WEB_ROOT..."
sudo mkdir -p "$WEB_ROOT"
sudo cp -r "$APP_DIR/server/public/." "$WEB_ROOT/"
sudo chown -R www-data:www-data "$WEB_ROOT"

sudo cp "$APP_DIR/deploy/nginx.conf" /etc/nginx/sites-available/spades
sudo ln -sf /etc/nginx/sites-available/spades /etc/nginx/sites-enabled/spades
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

# ─── 8. Start Node.js server with PM2 ────────────────────────────────────────
echo "[8/8] Starting Node.js server with PM2..."
cd "$APP_DIR/server"
pm2 delete spades-server 2>/dev/null || true
pm2 start index.js --name spades-server
pm2 save
pm2 startup | tail -1 | sudo bash || true

# ─── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo "========================================="
echo " Setup complete!"
echo "========================================="
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "unknown")
echo " Public IP : http://$PUBLIC_IP"
echo " PM2 status: pm2 status"
echo " Node logs : pm2 logs spades-server"
echo " Nginx logs: sudo tail -f /var/log/nginx/error.log"
echo "========================================="
