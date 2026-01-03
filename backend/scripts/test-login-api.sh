#!/bin/bash

# 测试登录 API
# 使用方法：bash scripts/test-login-api.sh [email] [password]

EMAIL="${1:-zq13371@gmail.com}"
PASSWORD="${2}"

echo "🧪 测试登录 API..."
echo ""

if [ -z "$PASSWORD" ]; then
    echo "⚠️  未提供密码，将使用错误密码进行测试"
    PASSWORD="wrongpassword"
    echo "使用错误密码: $PASSWORD"
    echo ""
fi

# 测试登录
echo "发送登录请求..."
RESPONSE=$(curl -s -X POST http://localhost:4000/api/auth/login \
    -H "Content-Type: application/json" \
    -H "Origin: http://8.136.38.126" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
    -w "\nHTTP_CODE:%{http_code}" 2>&1)

HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE" | cut -d':' -f2)
BODY=$(echo "$RESPONSE" | grep -v "HTTP_CODE")

echo "HTTP 状态码: $HTTP_CODE"
echo "响应内容: $BODY"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ 登录成功！"
    echo "Token: $(echo "$BODY" | grep -o '"token":"[^"]*' | cut -d'"' -f4)"
elif [ "$HTTP_CODE" = "400" ]; then
    echo "❌ 登录失败: 邮箱或密码错误"
    echo ""
    echo "可能的原因："
    echo "  1. 密码不正确"
    echo "  2. 密码格式问题"
    echo ""
    echo "建议："
    echo "  运行: bash scripts/reset-password-simple.sh $EMAIL"
elif [ "$HTTP_CODE" = "500" ]; then
    echo "❌ 服务器错误"
    echo "查看日志: pm2 logs piccco-backend --lines 50"
else
    echo "❌ 未知错误 (HTTP $HTTP_CODE)"
fi

echo ""

