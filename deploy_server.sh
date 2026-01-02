#!/bin/bash

# 服务器端快速部署脚本

echo "=========================================="
echo "快速部署 piccco3"
echo "=========================================="

cd /www/wwwroot/piccco3

# 1. 安装依赖
echo ""
echo "1. 检查并安装依赖..."
if [ ! -d "node_modules" ]; then
    echo "   安装前端依赖..."
    npm install
fi

if [ ! -d "backend/node_modules" ]; then
    echo "   安装后端依赖..."
    cd backend
    npm install
    cd ..
fi

# 2. 构建前端
echo ""
echo "2. 构建前端..."
rm -rf dist
VITE_API_BASE_URL=/api npm run build

if [ $? -eq 0 ]; then
    echo "   ✓ 前端构建成功"
    
    # 设置权限
    chmod -R 755 dist
    chown -R www:www dist
else
    echo "   ✗ 前端构建失败"
    exit 1
fi

# 3. 重启后端服务
echo ""
echo "3. 重启后端服务..."
cd backend

# 检查PM2服务是否存在
if pm2 list | grep -q "piccco-backend"; then
    echo "   重启现有服务..."
    pm2 restart piccco-backend --update-env
else
    echo "   启动新服务..."
    pm2 start src/server.js --name piccco-backend
    pm2 save
fi

if [ $? -eq 0 ]; then
    echo "   ✓ 后端服务已启动/重启"
else
    echo "   ✗ 后端服务启动失败"
    exit 1
fi

# 4. 重载Nginx
echo ""
echo "4. 重载Nginx..."
nginx -s reload

if [ $? -eq 0 ]; then
    echo "   ✓ Nginx已重载"
else
    echo "   ⚠️  Nginx重载失败，请手动检查"
fi

echo ""
echo "=========================================="
echo "✓ 部署完成！"
echo "=========================================="
echo ""
echo "访问地址："
echo "  - 前端: http://8.136.38.126"
echo "  - 管理员: http://8.136.38.126/admin"
echo ""
echo "检查服务状态："
echo "  - PM2状态: pm2 status"
echo "  - PM2日志: pm2 logs piccco-backend"
echo "  - 测试API: curl http://localhost:4000/api/health"
echo ""












