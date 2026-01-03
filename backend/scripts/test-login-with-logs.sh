#!/bin/bash

# 测试登录并查看实时日志
# 使用方法：bash scripts/test-login-with-logs.sh [email] [password]

EMAIL="${1:-zq13371@gmail.com}"
PASSWORD="${2:-}"

if [ -z "$PASSWORD" ]; then
    echo "❌ 请提供密码"
    echo ""
    echo "使用方法："
    echo "  bash scripts/test-login-with-logs.sh [email] [password]"
    echo ""
    echo "示例："
    echo "  bash scripts/test-login-with-logs.sh zq13371@gmail.com your_actual_password"
    echo ""
    exit 1
fi

echo "🔐 测试登录（带实时日志）..."
echo "=========================================="
echo ""
echo "邮箱: $EMAIL"
echo "密码: ${PASSWORD:0:1}*** (已隐藏)"
echo ""

# 在后台启动日志监控
echo "📋 启动日志监控（按 Ctrl+C 停止）..."
echo ""

# 测试登录
echo "发送登录请求..."
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -H "Origin: http://8.136.38.126" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
  2>&1)

HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | grep -v "HTTP_CODE:")

echo ""
echo "=========================================="
echo "响应结果"
echo "=========================================="
echo "HTTP 状态码: $HTTP_CODE"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ 登录成功！"
    echo ""
    echo "响应内容："
    echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
elif [ "$HTTP_CODE" = "400" ]; then
    echo "❌ 登录失败：请求错误"
    echo ""
    echo "响应内容："
    echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
    echo ""
    echo "查看详细日志："
    echo "  pm2 logs piccco-backend --lines 20 | grep -i 'login\|auth\|verifyPassword\|密码'"
else
    echo "❌ 未知错误 (HTTP $HTTP_CODE)"
    echo ""
    echo "响应内容："
    echo "$BODY"
fi
echo ""

# 显示最近的登录日志
echo "=========================================="
echo "最近的登录日志"
echo "=========================================="
if command -v pm2 >/dev/null 2>&1; then
    pm2 logs piccco-backend --lines 30 --nostream | grep -i "login\|auth\|verifyPassword\|密码\|password" | tail -10
else
    echo "⚠️  未找到 PM2"
fi
echo ""

