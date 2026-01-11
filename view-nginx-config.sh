#!/bin/bash
# 查看 Nginx 配置文件的完整内容

CONFIG_FILE="/www/server/panel/vhost/nginx/8.136.38.126.conf"

echo "=========================================="
echo "查看 Nginx 配置文件内容"
echo "=========================================="
echo "配置文件: $CONFIG_FILE"
echo ""

if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ 配置文件不存在: $CONFIG_FILE"
    exit 1
fi

echo "完整配置文件内容:"
echo "=========================================="
cat "$CONFIG_FILE"
echo "=========================================="

echo ""
echo "查找包含 'api' 或 'API' 的行（不区分大小写）:"
grep -i "api" "$CONFIG_FILE" -A 5 -B 2 || echo "未找到包含 'api' 的行"

echo ""
echo "查找包含 'location' 的所有配置:"
grep "location" "$CONFIG_FILE" -A 10 || echo "未找到 location 配置"

echo ""
echo "查找包含 'proxy_pass' 的配置:"
grep "proxy_pass" "$CONFIG_FILE" -B 5 -A 10 || echo "未找到 proxy_pass 配置"

echo ""
echo "查找包含 'include' 的配置（可能包含在其他文件中）:"
grep "include" "$CONFIG_FILE" -A 2 || echo "未找到 include 配置"

echo ""
echo "=========================================="
echo "检查完成"
echo "=========================================="

