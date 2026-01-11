#!/bin/bash
# 添加 API 代理配置到 Nginx

CONFIG_FILE="/www/server/panel/vhost/nginx/8.136.38.126.conf"
BACKUP_FILE="${CONFIG_FILE}.backup.$(date +%Y%m%d_%H%M%S)"

echo "=========================================="
echo "添加 API 代理配置"
echo "=========================================="

# 1. 备份原配置文件
echo "1. 备份配置文件..."
cp "$CONFIG_FILE" "$BACKUP_FILE"
echo "✅ 已备份到: $BACKUP_FILE"

# 2. 检查是否已有 /api 配置
if grep -q "location /api" "$CONFIG_FILE"; then
    echo "⚠️  配置文件中已存在 /api 配置"
    echo "   当前配置:"
    grep -A 10 "location /api" "$CONFIG_FILE"
    read -p "是否覆盖? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "取消操作"
        exit 0
    fi
    # 删除旧的 /api 配置
    sed -i '/location \/api/,/^[[:space:]]*}/d' "$CONFIG_FILE"
fi

# 3. 添加 /api 代理配置
echo "2. 添加 API 代理配置..."

# 找到 location / 块，在其后添加
if grep -q "location /" "$CONFIG_FILE"; then
    # 在 location / 块后添加
    sed -i '/location \//a\
    # API 代理到后端服务\
    location /api {\
        proxy_pass http://localhost:4000;\
        proxy_http_version 1.1;\
        proxy_set_header Upgrade $http_upgrade;\
        proxy_set_header Connection '\''upgrade'\'';\
        proxy_set_header Host $host;\
        proxy_set_header X-Real-IP $remote_addr;\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\
        proxy_set_header X-Forwarded-Proto $scheme;\
        proxy_cache_bypass $http_upgrade;\
        proxy_connect_timeout 60s;\
        proxy_send_timeout 60s;\
        proxy_read_timeout 60s;\
    }' "$CONFIG_FILE"
else
    # 如果找不到 location /，在 server 块中添加
    sed -i '/server {/a\
    # API 代理到后端服务\
    location /api {\
        proxy_pass http://localhost:4000;\
        proxy_http_version 1.1;\
        proxy_set_header Upgrade $http_upgrade;\
        proxy_set_header Connection '\''upgrade'\'';\
        proxy_set_header Host $host;\
        proxy_set_header X-Real-IP $remote_addr;\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\
        proxy_set_header X-Forwarded-Proto $scheme;\
        proxy_cache_bypass $http_upgrade;\
        proxy_connect_timeout 60s;\
        proxy_send_timeout 60s;\
        proxy_read_timeout 60s;\
    }' "$CONFIG_FILE"
fi

echo "✅ API 代理配置已添加"

# 4. 测试配置
echo "3. 测试 Nginx 配置..."
if nginx -t; then
    echo "✅ Nginx 配置测试通过"
else
    echo "❌ Nginx 配置测试失败，恢复备份..."
    cp "$BACKUP_FILE" "$CONFIG_FILE"
    exit 1
fi

# 5. 重载 Nginx
echo "4. 重载 Nginx..."
if systemctl reload nginx; then
    echo "✅ Nginx 已重载"
else
    echo "⚠️  reload 失败，尝试 restart..."
    systemctl restart nginx
fi

echo ""
echo "=========================================="
echo "配置完成！"
echo "=========================================="
echo "配置文件: $CONFIG_FILE"
echo "备份文件: $BACKUP_FILE"
echo ""
echo "API 代理已配置: /api -> http://localhost:4000"
echo "请测试 API 请求是否正常工作"
echo "=========================================="

