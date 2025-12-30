#!/bin/bash
# 修复访问问题

cd /www/wwwroot/piccco3

echo "=" | head -c 70; echo
echo "修复访问问题"
echo "=" | head -c 70; echo

# 获取服务器IP
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

echo ""
echo "服务器IP: $SERVER_IP"
echo ""

# 1. 检查并构建前端（如果需要）
if [ ! -d "dist" ] || [ ! -f "dist/index.html" ]; then
    echo "1. 构建前端..."
    npm run build
    if [ $? -eq 0 ]; then
        echo "   ✓ 前端构建成功"
    else
        echo "   ✗ 前端构建失败"
        exit 1
    fi
else
    echo "1. ✓ 前端已构建"
fi

# 2. 检查后端服务
echo ""
echo "2. 检查后端服务..."
if command -v pm2 &> /dev/null; then
    BACKEND_STATUS=$(pm2 list 2>/dev/null | grep piccco-backend | awk '{print $10}')
    if [ "$BACKEND_STATUS" != "online" ]; then
        echo "   启动后端服务..."
        if [ -f "backend/src/server.js" ]; then
            cd backend
            pm2 start src/server.js --name piccco-backend
            pm2 save
            cd ..
            echo "   ✓ 后端服务已启动"
        else
            echo "   ✗ backend/src/server.js 不存在"
            exit 1
        fi
    else
        echo "   ✓ 后端服务已运行"
    fi
else
    echo "   ✗ PM2 未安装，请先安装: npm install -g pm2"
    exit 1
fi

# 3. 创建 .env.production 文件（用于构建时设置API地址）
echo ""
echo "3. 配置前端API地址..."
cat > .env.production << EOF
# 生产环境配置
# API地址 - 使用相对路径，通过Nginx代理
VITE_API_BASE_URL=/api
EOF
echo "   ✓ 已创建 .env.production"
echo "   API地址: /api (通过Nginx代理)"

# 4. 重新构建前端（使用新的API配置）
echo ""
echo "4. 使用新配置重新构建前端..."
npm run build
if [ $? -eq 0 ]; then
    echo "   ✓ 前端重新构建成功"
else
    echo "   ✗ 前端重新构建失败"
    exit 1
fi

# 5. 显示Nginx配置提示
echo ""
echo "=" | head -c 70; echo
echo "Nginx 配置"
echo "=" | head -c 70; echo
echo ""
echo "请在宝塔面板中配置Nginx，添加以下内容:"
echo ""
echo "location / {"
echo "    root /www/wwwroot/piccco3/dist;"
echo "    index index.html;"
echo "    try_files \$uri \$uri/ /index.html;"
echo "}"
echo ""
echo "location /api {"
echo "    proxy_pass http://localhost:4000;"
echo "    proxy_http_version 1.1;"
echo "    proxy_set_header Upgrade \$http_upgrade;"
echo "    proxy_set_header Connection 'upgrade';"
echo "    proxy_set_header Host \$host;"
echo "    proxy_set_header X-Real-IP \$remote_addr;"
echo "    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;"
echo "    proxy_set_header X-Forwarded-Proto \$scheme;"
echo "    proxy_cache_bypass \$http_upgrade;"
echo "}"
echo ""

# 6. 显示访问地址
echo ""
echo "=" | head -c 70; echo
echo "访问地址"
echo "=" | head -c 70; echo
echo ""
echo "配置完成后，通过以下地址访问:"
echo "  - IP地址: http://$SERVER_IP"
echo "  - 域名: http://your-domain.com (如果已配置)"
echo ""
echo "注意: 不要使用 localhost:5173，那是开发服务器地址"
echo ""












