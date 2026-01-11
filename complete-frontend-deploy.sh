#!/bin/bash
# 完整前端部署脚本（包括构建和 Nginx 配置检查）

set -e

PROJECT_DIR="/www/wwwroot/piccco3"
FRONTEND_DIR="$PROJECT_DIR"

echo "=========================================="
echo "piccco 前端完整部署脚本"
echo "=========================================="

# 检查目录是否存在
if [ ! -d "$FRONTEND_DIR" ]; then
    echo "错误: 前端目录不存在: $FRONTEND_DIR"
    exit 1
fi

echo "1. 进入前端目录..."
cd "$FRONTEND_DIR"

echo "2. 从 GitHub 拉取最新代码..."
git pull origin main

echo "3. 安装/更新依赖..."
npm install

echo "4. 构建前端（生产环境）..."
npm run build

echo "5. 检查构建输出..."
if [ -d "dist" ]; then
    echo "✅ 构建成功，dist 目录已创建"
    echo "   文件数量: $(find dist -type f | wc -l)"
    echo "   总大小: $(du -sh dist | cut -f1)"
else
    echo "❌ 构建失败，dist 目录不存在"
    exit 1
fi

echo ""
echo "6. 检查 Nginx 配置..."
NGINX_CONFIG="/www/server/panel/vhost/nginx/piccco.conf"
if [ -f "$NGINX_CONFIG" ]; then
    echo "✅ 找到 Nginx 配置文件: $NGINX_CONFIG"
    
    # 检查是否已经配置了 dist 目录
    if grep -q "root.*dist" "$NGINX_CONFIG"; then
        echo "✅ Nginx 已配置指向 dist 目录"
    else
        echo "⚠️  Nginx 配置可能未指向 dist 目录"
        echo "   请检查配置文件中的 root 指令是否指向: $FRONTEND_DIR/dist"
    fi
else
    echo "⚠️  未找到 Nginx 配置文件: $NGINX_CONFIG"
    echo "   请确保已在宝塔面板中配置网站"
fi

echo ""
echo "7. 重启 Nginx..."
if command -v nginx &> /dev/null; then
    nginx -t && systemctl restart nginx
    echo "✅ Nginx 已重启"
else
    echo "⚠️  未找到 nginx 命令，请在宝塔面板中手动重启 Nginx"
fi

echo ""
echo "=========================================="
echo "前端部署完成！"
echo "=========================================="
echo "构建输出目录: $FRONTEND_DIR/dist"
echo ""
echo "下一步："
echo "1. 访问网站确认部署成功"
echo "2. 清除浏览器缓存（Ctrl+Shift+Delete）"
echo "3. 硬刷新页面（Ctrl+F5）"
echo "=========================================="

