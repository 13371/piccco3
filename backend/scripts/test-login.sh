#!/bin/bash

# 测试登录 API
# 使用方法：bash scripts/test-login.sh [email] [password]

EMAIL="${1:-zq13371@gmail.com}"
PASSWORD="${2:-}"

if [ -z "$PASSWORD" ]; then
    echo "🔐 测试登录 API..."
    echo ""
    echo "使用方法："
    echo "  bash scripts/test-login.sh [email] [password]"
    echo ""
    echo "示例："
    echo "  bash scripts/test-login.sh zq13371@gmail.com your_password"
    echo ""
    exit 1
fi

echo "🔐 测试登录 API..."
echo "=========================================="
echo ""
echo "邮箱: $EMAIL"
echo "密码: ${PASSWORD:0:1}*** (已隐藏)"
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
    echo "可能的原因："
    echo "  - 邮箱或密码错误"
    echo "  - 请求格式不正确"
elif [ "$HTTP_CODE" = "401" ]; then
    echo "❌ 登录失败：未授权"
    echo ""
    echo "响应内容："
    echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
    echo ""
    echo "可能的原因："
    echo "  - 邮箱或密码错误"
    echo "  - 账户被禁用"
elif [ "$HTTP_CODE" = "500" ]; then
    echo "❌ 服务器错误"
    echo ""
    echo "响应内容："
    echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
    echo ""
    echo "请查看服务器日志："
    echo "  pm2 logs piccco-backend --lines 50 | grep -i error"
else
    echo "❌ 未知错误 (HTTP $HTTP_CODE)"
    echo ""
    echo "响应内容："
    echo "$BODY"
fi
echo ""

