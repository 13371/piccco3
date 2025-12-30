#!/bin/bash

# 修复前端构建和部署问题

echo "=========================================="
echo "修复前端构建和部署"
echo "=========================================="

# 1. 删除 dist 目录中的 .user.ini 文件（如果存在）
echo ""
echo "1. 清理 dist 目录..."
cd /www/wwwroot/piccco3
if [ -f "dist/.user.ini" ]; then
    echo "   删除 dist/.user.ini 文件..."
    rm -f dist/.user.ini
fi

# 2. 删除整个 dist 目录并重新构建
echo ""
echo "2. 删除旧的 dist 目录..."
rm -rf dist

# 3. 使用正确的环境变量重新构建前端
echo ""
echo "3. 重新构建前端（设置 VITE_API_BASE_URL=/api）..."
VITE_API_BASE_URL=/api npm run build

if [ $? -eq 0 ]; then
    echo ""
    echo "✓ 前端构建成功！"
    
    # 4. 设置 dist 目录权限
    echo ""
    echo "4. 设置 dist 目录权限..."
    chmod -R 755 dist
    chown -R www:www dist
    
    # 5. 重启 Nginx
    echo ""
    echo "5. 重启 Nginx..."
    nginx -s reload
    
    echo ""
    echo "=========================================="
    echo "✓ 部署完成！"
    echo "=========================================="
    echo ""
    echo "现在可以访问："
    echo "  - 前端: http://8.136.38.126"
    echo "  - 管理员: http://8.136.38.126/admin"
    echo ""
else
    echo ""
    echo "✗ 前端构建失败，请检查错误信息"
    exit 1
fi

