#!/bin/bash
# 查找宝塔面板 Nginx 配置文件

echo "=========================================="
echo "查找 Nginx 配置文件"
echo "=========================================="

# 方法1: 查找宝塔面板的配置目录
echo "1. 查找宝塔面板 Nginx 配置目录..."
if [ -d "/www/server/panel/vhost/nginx" ]; then
    echo "✅ 找到配置目录: /www/server/panel/vhost/nginx"
    echo "   配置文件列表:"
    ls -la /www/server/panel/vhost/nginx/*.conf 2>/dev/null || echo "   没有找到 .conf 文件"
else
    echo "❌ 未找到目录: /www/server/panel/vhost/nginx"
fi

echo ""
echo "2. 查找所有可能的 Nginx 配置目录..."
POSSIBLE_PATHS=(
    "/www/server/panel/vhost"
    "/www/server/nginx/conf/vhost"
    "/etc/nginx/sites-available"
    "/etc/nginx/conf.d"
    "/usr/local/nginx/conf/vhost"
)

for path in "${POSSIBLE_PATHS[@]}"; do
    if [ -d "$path" ]; then
        echo "✅ 找到目录: $path"
        find "$path" -name "*.conf" -type f 2>/dev/null | head -5
    fi
done

echo ""
echo "3. 查找包含 'piccco' 的配置文件..."
find /www/server -name "*piccco*.conf" 2>/dev/null
find /etc/nginx -name "*piccco*.conf" 2>/dev/null 2>/dev/null

echo ""
echo "4. 查看 Nginx 主配置文件引用的配置..."
if [ -f "/www/server/nginx/conf/nginx.conf" ]; then
    echo "   主配置文件: /www/server/nginx/conf/nginx.conf"
    echo "   包含的配置:"
    grep -E "include.*conf" /www/server/nginx/conf/nginx.conf | head -5
fi

echo ""
echo "=========================================="
echo "提示："
echo "如果找不到配置文件，可以在宝塔面板中："
echo "1. 进入 '网站' → 找到你的网站 → '设置'"
echo "2. 点击 '配置文件' 标签查看配置"
echo "=========================================="

