#!/bin/bash
# E2E Storeroom Kiosk — one-time server setup
# Run as a user with sudo access (not root)
# Usage: bash setup.sh

set -e

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
USER="$(whoami)"

echo "=== E2E Storeroom Kiosk Setup ==="
echo "    App dir: $APP_DIR"
echo "    User:    $USER"
echo ""

# ── Node.js 20 LTS ────────────────────────────────────────────────────────────
echo "=== Installing Node.js 20 LTS ==="
NODE_VER=$(node --version 2>/dev/null || echo "none")
if [[ ! "$NODE_VER" =~ ^v(18|20|22) ]]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
    sudo apt-get install -y nodejs
fi
echo "    Node: $(node --version)  npm: $(npm --version)"

# ── PM2 ───────────────────────────────────────────────────────────────────────
echo ""
echo "=== Installing PM2 ==="
sudo npm install -g pm2

# ── Build frontend ────────────────────────────────────────────────────────────
echo ""
echo "=== Installing dependencies & building frontend ==="
cd "$APP_DIR/frontend" && npm install && npm run build
cd "$APP_DIR/backend"  && npm install --omit=dev
cd "$APP_DIR"

# ── config.json ───────────────────────────────────────────────────────────────
echo ""
echo "=== Creating config.json ==="
if [ ! -f "$APP_DIR/backend/config.json" ]; then
    cp "$APP_DIR/backend/config.example.json" "$APP_DIR/backend/config.json"
    echo "    Created backend/config.json from example."
    echo "    !! Edit it with your Snipe-IT URL, token, and other settings before use."
else
    echo "    backend/config.json already exists — skipping."
fi

# ── nginx ─────────────────────────────────────────────────────────────────────
echo ""
echo "=== Installing nginx ==="
sudo apt-get install -y nginx

echo ""
echo "=== Generating self-signed SSL certificate (10 years) ==="
SERVER_IP=$(hostname -I | awk '{print $1}')
sudo mkdir -p /etc/ssl/predator-kiosk
sudo openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
    -keyout /etc/ssl/predator-kiosk/key.pem \
    -out    /etc/ssl/predator-kiosk/cert.pem \
    -subj   "/CN=$SERVER_IP/O=E2E Storeroom Kiosk" 2>/dev/null
echo "    Certificate written to /etc/ssl/predator-kiosk/cert.pem"

echo ""
echo "=== Writing nginx config ==="
sudo tee /etc/nginx/sites-available/predator-kiosk > /dev/null << 'NGINX'
server {
    listen 80;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;

    ssl_certificate     /etc/ssl/predator-kiosk/cert.pem;
    ssl_certificate_key /etc/ssl/predator-kiosk/key.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;

    proxy_read_timeout  60s;
    client_max_body_size 20M;

    location / {
        proxy_pass         http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINX

sudo ln -sf /etc/nginx/sites-available/predator-kiosk /etc/nginx/sites-enabled/predator-kiosk
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx
echo "    nginx running — HTTP redirects to HTTPS"

# ── Start app ─────────────────────────────────────────────────────────────────
echo ""
echo "=== Starting app with PM2 ==="
pm2 stop predator-kiosk 2>/dev/null || true
pm2 delete predator-kiosk 2>/dev/null || true
cd "$APP_DIR/backend" && NODE_ENV=production pm2 start server.js --name predator-kiosk
pm2 save

# Enable PM2 on boot
STARTUP_CMD=$(pm2 startup systemd -u "$USER" --hp "/home/$USER" 2>&1 | grep "sudo")
if [ -n "$STARTUP_CMD" ]; then
    eval "$STARTUP_CMD"
fi

# ── Firewall ──────────────────────────────────────────────────────────────────
echo ""
echo "=== Configuring firewall ==="
sudo ufw allow 22/tcp   2>/dev/null || true   # SSH
sudo ufw allow 80/tcp   2>/dev/null || true   # HTTP (redirects to HTTPS)
sudo ufw allow 443/tcp  2>/dev/null || true   # HTTPS
sudo ufw deny  3001/tcp 2>/dev/null || true   # Block direct app access
sudo ufw --force enable 2>/dev/null || true

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "========================================"
echo "  Setup complete!"
echo "  App: https://$SERVER_IP"
echo ""
echo "  NEXT STEP: edit backend/config.json"
echo "  with your Snipe-IT URL and token."
echo ""
echo "  To update after a git pull:"
echo "    cd $APP_DIR"
echo "    git pull"
echo "    cd frontend && npm run build && cd .."
echo "    pm2 restart predator-kiosk"
echo "========================================"
