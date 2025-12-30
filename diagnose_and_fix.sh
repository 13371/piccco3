#!/bin/bash
# 诊断和修复访问问题

cd /www/wwwroot/piccco3

echo "=" | head -c 70; echo
echo "诊断访问问题"
echo "=" | head -c 70; echo

# 1. 检查服务器IP
echo ""
echo "1. 服务器信息:"
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
echo "   服务器IP: $SERVER_IP"

# 2. 检查后端服务
echo ""
echo "2. 检查后端服务:"
if command -v pm2 &> /dev/null; then
    BACKEND_STATUS=$(pm2 list | grep piccco-backend | awk '{print $10}')
    if [ "$BACKEND_STATUS" = "online" ]; then
        echo "   ✓ 后端服务运行中"
        BACKEND_PORT=$(pm2 show piccco-backend | grep "script path" | grep -oP '\d+' | head -1 || echo "4000")
        echo "   端口: $BACKEND_PORT"
    else
        echo "   ✗ 后端服务未运行"
        echo "   启动命令: cd backend && pm2 start src/server.js --name piccco-backend"
    fi
else
    echo "   ⚠ PM2 未安装"
fi

# 3. 检查前端构建
echo ""
echo "3. 检查前端构建:"
if [ -d "dist" ]; then
    echo "   ✓ dist 目录存在"
    if [ -f "dist/index.html" ]; then
        echo "   ✓ index.html 存在"
    else
        echo "   ✗ index.html 不存在"
    fi
else
    echo "   ✗ dist 目录不存在，需要构建"
fi

# 4. 检查Nginx配置
echo ""
echo "4. 检查Nginx:"
if command -v nginx &> /dev/null; then
    NGINX_STATUS=$(systemctl status nginx 2>/dev/null | grep "Active:" | awk '{print $2}')
    if [ "$NGINX_STATUS" = "active" ]; then
        echo "   ✓ Nginx 运行中"
    else
        echo "   ✗ Nginx 未运行"
    fi
else
    echo "   ⚠ Nginx 未安装"
fi

# 5. 检查端口占用
echo ""
echo "5. 检查端口占用:"
echo "   端口 4000 (后端):"
netstat -tulpn | grep :4000 || echo "     未监听"
echo "   端口 80 (HTTP):"
netstat -tulpn | grep :80 || echo "     未监听"
echo "   端口 443 (HTTPS):"
netstat -tulpn | grep :443 || echo "     未监听"

# 6. 检查前端API配置
echo ""
echo "6. 检查前端API配置:"
if [ -f "dist/index.html" ]; then
    echo "   ✓ 已构建，API配置在构建时确定"
    echo "   当前配置: $(grep -r "localhost:4000" dist/ 2>/dev/null | head -1 || echo "未找到")"
else
    echo "   ⚠ 未构建，无法检查"
fi

echo ""
echo "=" | head -c 70; echo
echo "访问地址:"
echo "=" | head -c 70; echo
echo ""
echo "如果已配置域名: http://your-domain.com"
echo "如果使用IP: http://$SERVER_IP"
echo ""
echo "注意: 不要使用 localhost:5173，那是开发服务器地址"
echo ""












