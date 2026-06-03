#!/bin/bash

set -ex
exec > >(tee /var/log/user-data.log | logger -t user-data 2>/dev/console) 2>&1

APP_DIR="/opt/voidx-shop"
APP_USER="ec2-user"
APP_PORT=3000
NODE_PORT=5001

echo "=== [1/7] Update OS and install packages ==="
dnf update -y
dnf install -y git nginx openssl

curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
dnf install -y nodejs

echo "=== [2/7] Prepare app directory ==="
rm -rf "${APP_DIR}"
mkdir -p "${APP_DIR}"

echo "=== [3/7] Clone repo ==="
git clone --depth 1 "${github_repo_url}" "${APP_DIR}" || exit 1
chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"

echo "=== [4/7] Install dependencies ==="
runuser -u "${APP_USER}" -- bash -lc "
  cd '${APP_DIR}'
  if [ -f package-lock.json ]; then
    npm ci
  else
    npm install
  fi
"

echo "=== [5/7] Create .env ==="
cat > "${APP_DIR}/.env" <<EOF_ENV
PORT=${NODE_PORT}
HOST=0.0.0.0
NODE_ENV=production
EOF_ENV

chown "${APP_USER}:${APP_USER}" "${APP_DIR}/.env"
chmod 600 "${APP_DIR}/.env"

echo "=== [6/7] Configure nginx ==="
cat > /etc/nginx/conf.d/voidx-shop.conf <<EOF_NGINX
server {
    listen ${APP_PORT};
    server_name _;

    location /health {
        access_log off;
        proxy_pass http://127.0.0.1:${NODE_PORT}/health;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:${NODE_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
        proxy_connect_timeout 10s;
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;
    gzip_comp_level 5;
}
EOF_NGINX

rm -f /etc/nginx/conf.d/default.conf
nginx -t
systemctl enable nginx
systemctl restart nginx

echo "=== [7/7] Create systemd service ==="
cat > /etc/systemd/system/voidx-shop.service <<EOF_SERVICE
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

systemctl daemon-reload
systemctl enable voidx-shop.service
systemctl start voidx-shop.service

sleep 5
systemctl reload nginx || true

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
echo "  Boot log    : cat /var/log/user-data.log"
echo "======================================================="
