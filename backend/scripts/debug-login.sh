#!/bin/bash

# 调试登录问题
# 使用方法：bash scripts/debug-login.sh [email]

EMAIL="${1:-zq13371@gmail.com}"

echo "🔍 调试登录问题..."
echo ""

# 获取项目目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# 检查 psql
if [ -f "/www/server/pgsql/bin/psql" ]; then
    PSQL="/www/server/pgsql/bin/psql"
else
    PSQL="psql"
fi

# 1. 检查用户是否存在
echo "1. 检查用户是否存在..."
USER_INFO=$($PSQL -h 127.0.0.1 -p 5432 -U postgres -d piccco -t -A -c "
SELECT 
    id,
    email,
    username,
    CASE 
        WHEN password LIKE '\$2a\$%' OR password LIKE '\$2b\$%' THEN 'bcrypt ✅'
        ELSE 'NOT bcrypt ❌'
    END as password_format,
    LENGTH(password) as password_length,
    LEFT(password, 20) as password_prefix,
    is_banned,
    created_at
FROM users 
WHERE email = '$EMAIL';
" 2>&1)

if [ $? -ne 0 ]; then
    echo "❌ 查询失败: $USER_INFO"
    exit 1
fi

if [ -z "$USER_INFO" ]; then
    echo "❌ 用户不存在: $EMAIL"
    exit 1
fi

echo "$USER_INFO" | while IFS='|' read -r id email username format length prefix banned created; do
    echo "  用户ID: $id"
    echo "  邮箱: $email"
    echo "  用户名: $username"
    echo "  密码格式: $format"
    echo "  密码长度: $length"
    echo "  密码前缀: $prefix"
    echo "  是否封禁: $banned"
    echo "  创建时间: $created"
done
echo ""

# 2. 检查最近的登录日志
echo "2. 检查最近的登录日志..."
if command -v pm2 >/dev/null 2>&1; then
    echo "包含 'login'、'auth'、'verifyPassword' 或 '密码' 的日志："
    pm2 logs piccco-backend --lines 100 --nostream 2>/dev/null | grep -i "login\|auth\|verifyPassword\|密码\|password" | tail -20 || echo "无相关日志"
else
    echo "⚠️  未找到 PM2"
fi
echo ""

# 3. 测试 API 登录（使用错误密码）
echo "3. 测试登录 API（使用错误密码以查看错误响应）..."
if command -v curl >/dev/null 2>&1; then
    RESPONSE=$(curl -s -X POST http://localhost:4000/api/auth/login \
        -H "Content-Type: application/json" \
        -H "Origin: http://8.136.38.126" \
        -d "{\"email\":\"$EMAIL\",\"password\":\"wrongpassword\"}" \
        -w "\nHTTP_CODE:%{http_code}" 2>&1)
    
    HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE" | cut -d':' -f2)
    BODY=$(echo "$RESPONSE" | grep -v "HTTP_CODE")
    
    echo "HTTP 状态码: $HTTP_CODE"
    echo "响应内容: $BODY"
    
    if [ "$HTTP_CODE" = "500" ]; then
        echo "❌ 返回 500 错误，说明服务器端有问题"
    elif [ "$HTTP_CODE" = "400" ]; then
        echo "✅ 返回 400 错误（预期的密码错误响应）"
    fi
else
    echo "⚠️  未安装 curl"
fi
echo ""

# 4. 检查 STORAGE_MODE
echo "4. 检查存储模式..."
if [ -f ".env" ]; then
    STORAGE_MODE=$(grep "^STORAGE_MODE=" .env 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'" || echo "未设置")
    echo "  STORAGE_MODE: ${STORAGE_MODE:-未设置（默认: file）}"
else
    echo "  ⚠️  未找到 .env 文件"
fi
echo ""

# 5. 建议
echo "=========================================="
echo "📝 建议的修复步骤："
echo "=========================================="
echo ""
echo "如果密码格式不正确："
echo "  1. 重新设置密码: bash scripts/reset-password-simple.sh $EMAIL"
echo ""
echo "如果密码格式正确但验证失败："
echo "  1. 确认输入的密码是否正确"
echo "  2. 查看详细日志: pm2 logs piccco-backend | grep -i 'verifyPassword\|密码'"
echo "  3. 检查 STORAGE_MODE 是否正确（应该是 'db' 或 'dual'）"
echo ""
echo "如果看到 500 错误："
echo "  1. 查看完整错误日志: pm2 logs piccco-backend --lines 50"
echo "  2. 检查数据库连接"
echo ""

