#!/bin/bash
# 检查 Nginx 配置和前端部署状态

echo "=========================================="
echo "检查 Nginx 配置和前端部署状态"
echo "=========================================="

PROJECT_DIR="/www/wwwroot/piccco3"
DIST_DIR="$PROJECT_DIR/dist"

# 1. 检查 dist 目录
echo "1. 检查构建输出目录..."
if [ -d "$DIST_DIR" ]; then
    echo "✅ dist 目录存在: $DIST_DIR"
    echo "   文件数量: $(find $DIST_DIR -type f | wc -l)"
    echo "   主要文件:"
    ls -lh $DIST_DIR/*.html 2>/dev/null || echo "   没有找到 HTML 文件"
    ls -lh $DIST_DIR/assets/*.js 2>/dev/null | head -1 || echo "   没有找到 JS 文件"
    ls -lh $DIST_DIR/assets/*.css 2>/dev/null | head -1 || echo "   没有找到 CSS 文件"
else
    echo "❌ dist 目录不存在: $DIST_DIR"
    echo "   请先运行: npm run build"
fi

echo ""
echo "2. 查找 Nginx 配置文件..."
CONFIG_FOUND=false

# 检查宝塔面板配置目录
if [ -d "/www/server/panel/vhost/nginx" ]; then
    echo "✅ 找到配置目录: /www/server/panel/vhost/nginx"
    CONFIG_FILES=$(ls /www/server/panel/vhost/nginx/*.conf 2>/dev/null)
    if [ -n "$CONFIG_FILES" ]; then
        CONFIG_FOUND=true
        echo "   配置文件列表:"
        ls -1 /www/server/panel/vhost/nginx/*.conf
        echo ""
        echo "   检查每个配置文件中的 root 设置:"
        for conf in /www/server/panel/vhost/nginx/*.conf; do
            echo "   --- $(basename $conf) ---"
            grep -E "^\s*root\s+" $conf 2>/dev/null || echo "   未找到 root 指令"
            grep -E "location\s+/api" $conf -A 3 2>/dev/null || echo "   未找到 /api 代理配置"
        done
    else
        echo "   ⚠️  目录存在但没有找到 .conf 文件"
    fi
fi

# 检查其他可能的位置
if [ "$CONFIG_FOUND" = false ]; then
    echo "   检查其他位置..."
    if [ -d "/www/server/nginx/conf/vhost" ]; then
        echo "   ✅ 找到: /www/server/nginx/conf/vhost"
        ls -1 /www/server/nginx/conf/vhost/*.conf 2>/dev/null | head -3
    fi
fi

echo ""
echo "3. 查找包含 'piccco' 或 'dist' 的配置文件..."
find /www/server -name "*.conf" -type f 2>/dev/null | xargs grep -l "piccco\|/dist" 2>/dev/null | head -5

echo ""
echo "4. 检查 Nginx 服务状态..."
if command -v nginx &> /dev/null; then
    nginx -t 2>&1 | grep -E "successful|error" || echo "   Nginx 测试完成"
    systemctl status nginx --no-pager -l | grep -E "Active|Main PID" || echo "   无法获取 Nginx 状态"
else
    echo "   ⚠️  未找到 nginx 命令"
fi

echo ""
echo "5. 检查后端服务状态..."
if command -v pm2 &> /dev/null; then
    pm2 list | grep -E "piccco|backend" || echo "   未找到后端服务"
else
    echo "   ⚠️  未找到 pm2 命令"
fi

echo ""
echo "=========================================="
echo "检查完成"
echo "=========================================="
echo ""
echo "如果找不到配置文件，请在宝塔面板中："
echo "1. 进入 '网站' → 找到你的网站 → '设置'"
echo "2. 点击 '网站目录' 标签，设置运行目录为: $DIST_DIR"
echo "3. 点击 '反向代理' 标签，添加 API 代理: http://localhost:4000"
echo "4. 保存并重载配置"
echo "=========================================="

