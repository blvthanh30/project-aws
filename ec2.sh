#!/bin/bash

echo "=== Start setting up VOIDX EC2 server ==="

sudo dnf update -y
sudo dnf install git nodejs npm nginx -y

cd /home/ec2-user

if [ ! -d "project-aws" ]; then
  echo "Cloning project from GitHub..."
  git clone https://github.com/blvthanh30/project-aws.git
else
  echo "Project already exists. Pulling latest code..."
  cd project-aws
  git pull
  cd ..
fi

cd /home/ec2-user/project-aws

echo "Installing Node.js dependencies..."
npm install

echo "Creating systemd service for VOIDX..."

sudo tee /etc/systemd/system/voidx.service > /dev/null <<EOF
[Unit]
Description=VOIDX Node Web App
After=network.target

[Service]
User=ec2-user
WorkingDirectory=/home/ec2-user/project-aws
ExecStart=/usr/bin/node /home/ec2-user/project-aws/server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl restart voidx
sudo systemctl enable voidx

echo "Creating Nginx reverse proxy config..."

sudo tee /etc/nginx/conf.d/voidx.conf > /dev/null <<EOF
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;

        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx

echo "Checking services..."

sudo systemctl status voidx --no-pager
sudo systemctl status nginx --no-pager

echo "=== VOIDX EC2 setup completed ==="
