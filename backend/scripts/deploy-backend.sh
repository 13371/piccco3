#!/bin/bash
# Backend one-click deploy: git pull + npm install + pm2 restart

set -e

PROJECT_DIR="/www/wwwroot/piccco3/backend"
PM2_APP_NAME="piccco-backend"   # change if your pm2 name differs

echo "=========================================="
echo "piccco backend deploy"
echo "Project dir: $PROJECT_DIR"
echo "pm2 app: $PM2_APP_NAME"
echo "=========================================="

if [ ! -d "$PROJECT_DIR" ]; then
  echo "ERROR: directory not found: $PROJECT_DIR"
  exit 1
fi

cd "$PROJECT_DIR"

echo "1) git pull..."
git pull origin main

echo "2) npm install..."
npm install

echo "3) pm2 restart..."
if pm2 list | grep -q "$PM2_APP_NAME"; then
  pm2 restart "$PM2_APP_NAME"
else
  echo "pm2 app not found, restart all"
  pm2 restart all
fi

echo "=========================================="
echo "Deploy done"
echo "=========================================="