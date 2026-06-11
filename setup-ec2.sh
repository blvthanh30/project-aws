#!/bin/bash

echo "=== Start setting up VOIDX EC2 server ==="

# 1. Update OS and install packages
sudo dnf update -y
sudo dnf install -y git nginx openssl

curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs

APP_DIR="/opt/voidx-shop"
APP_USER="ec2-user"
APP_PORT=3000
NODE_PORT=5001

echo "=== [2/7] Prepare app directory ==="
sudo rm -rf "${APP_DIR}"
sudo mkdir -p "${APP_DIR}"

echo "=== [3/7] Clone repo ==="
sudo git clone --depth 1 "https://github.com/blvthanh30/project-aws" "${APP_DIR}" || exit 1
sudo chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"

echo "=== [4/7] Install dependencies ==="
sudo runuser -u "${APP_USER}" -- bash -lc "
  cd '${APP_DIR}'
  if [ -f package-lock.json ]; then
    npm ci
  else
    npm install
  fi
"

echo "=== [5/7] Create .env ==="
sudo tee "${APP_DIR}/.env" > /dev/null <<EOF_ENV
PORT=${NODE_PORT}
HOST=0.0.0.0
NODE_ENV=production
EOF_ENV

sudo chown "${APP_USER}:${APP_USER}" "${APP_DIR}/.env"
sudo chmod 600 "${APP_DIR}/.env"

echo "=== [6/7] Configure nginx ==="
sudo tee /etc/nginx/conf.d/voidx-shop.conf > /dev/null <<'EOF_NGINX'
server {
    listen 3000;
    server_name _;

    location /health {
        access_log off;
        proxy_pass http://127.0.0.1:5001/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:5001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        proxy_connect_timeout 10s;
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;
    gzip_comp_level 5;
}
EOF_NGINX

sudo rm -f /etc/nginx/conf.d/default.conf
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx

echo "=== [7/7] Create systemd service ==="
sudo tee /etc/systemd/system/voidx-shop.service > /dev/null <<EOF_SERVICE
[Unit]
Description=VOIDX Shop - Node.js App
After=network-online.target nginx.service
Wants=network-online.target

[Service]
Type=simple
User=${APP_USER}
WorkingDirectory=${APP_DIR}
EnvironmentFile=${APP_DIR}/.env
ExecStart=/usr/bin/node ${APP_DIR}/server.js
Restart=always
RestartSec=10
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF_SERVICE

sudo systemctl daemon-reload
sudo systemctl enable voidx-shop.service
sudo systemctl start voidx-shop.service

sleep 5
sudo systemctl reload nginx || true

echo ""
echo "======================================================="
echo "  Bootstrap COMPLETED"
echo "======================================================="
echo "  APP URL     : http://<EC2-or-ALB-DNS>:${APP_PORT}/"
echo "  Healthcheck : http://<EC2-or-ALB-DNS>:${APP_PORT}/health"
echo "  Node port   : ${NODE_PORT} (internal only)"
echo ""
echo "  Check app   : systemctl status voidx-shop"
echo "  App logs    : journalctl -u voidx-shop -f"
echo "  nginx       : systemctl status nginx"
echo "  Boot log    : sudo cat /var/log/user-data.log"
echo "======================================================="
