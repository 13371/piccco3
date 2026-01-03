#!/bin/bash

# 直接测试登录功能
# 使用方法：bash scripts/test-login-direct.sh

echo "🔍 直接测试登录功能..."
echo ""

# 获取项目目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# 读取配置
if [ -f .env ]; then
    TMP_ENV=$(mktemp)
    sed 's/\r$//' .env > "$TMP_ENV"
    set -a
    source "$TMP_ENV"
    set +a
    rm -f "$TMP_ENV"
    
    DB_NAME=${DB_NAME:-piccco}
    DB_USER=${DB_USER:-piccco_user}
    DB_PASSWORD=${DB_PASSWORD:-}
else
    echo "❌ 未找到 .env 文件"
    exit 1
fi

export PGPASSWORD="$DB_PASSWORD"

# 检查 psql
if [ -f "/www/server/pgsql/bin/psql" ]; then
    PSQL="/www/server/pgsql/bin/psql"
else
    PSQL="psql"
fi

# 测试邮箱
TEST_EMAIL="zq13371@gmail.com"

echo "1. 检查用户是否存在..."
USER_DATA=$($PSQL -h 127.0.0.1 -p 5432 -U postgres -d "$DB_NAME" -t -c "
SELECT 
    email,
    username,
    CASE 
        WHEN password LIKE '\$2a\$%' OR password LIKE '\$2b\$%' THEN 'bcrypt'
        WHEN password LIKE '\$2y\$%' THEN 'bcrypt (2y)'
        ELSE 'unknown'
    END as password_format,
    LENGTH(password) as password_length,
    is_banned,
    created_at
FROM users 
WHERE email = '$TEST_EMAIL';
" 2>/dev/null)

if [ -n "$USER_DATA" ]; then
    echo "✅ 用户存在："
    echo "$USER_DATA" | while IFS='|' read -r email username pwd_format pwd_len is_banned created_at; do
        echo "  邮箱: $(echo $email | xargs)"
        echo "  用户名: $(echo $username | xargs)"
        echo "  密码格式: $(echo $pwd_format | xargs)"
        echo "  密码长度: $(echo $pwd_len | xargs)"
        echo "  是否封禁: $(echo $is_banned | xargs)"
        echo "  创建时间: $(echo $created_at | xargs)"
    done
else
    echo "❌ 用户不存在"
    exit 1
fi

echo ""
echo "2. 测试数据库查询（模拟 findUserByEmail）..."
QUERY_RESULT=$($PSQL -h 127.0.0.1 -p 5432 -U "$DB_USER" -d "$DB_NAME" -t -c "
SELECT id, email, username, password, is_banned 
FROM users 
WHERE email = '$TEST_EMAIL';
" 2>&1)

if echo "$QUERY_RESULT" | grep -q "ERROR"; then
    echo "❌ 数据库查询失败："
    echo "$QUERY_RESULT"
else
    echo "✅ 数据库查询成功"
    echo "  查询结果包含用户数据"
fi

echo ""
echo "3. 检查应用日志中的登录错误..."
if command -v pm2 >/dev/null 2>&1; then
    echo "最近 20 行包含 'login' 或 'error' 的日志："
    pm2 logs piccco-backend --lines 200 --nostream 2>/dev/null | grep -i "login\|error\|auth" | tail -20 || echo "无法获取日志"
else
    echo "⚠️  未找到 PM2"
fi

echo ""
echo "4. 测试登录 API..."
if command -v curl >/dev/null 2>&1; then
    echo "发送测试登录请求..."
    RESPONSE=$(curl -s -X POST http://localhost:4000/api/auth/login \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"test123456\"}" \
        -w "\nHTTP_CODE:%{http_code}" 2>&1)
    
    HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE" | cut -d':' -f2)
    BODY=$(echo "$RESPONSE" | grep -v "HTTP_CODE")
    
    echo "HTTP 状态码: $HTTP_CODE"
    echo "响应内容:"
    echo "$BODY" | head -10
else
    echo "⚠️  未安装 curl"
fi

echo ""
echo "=========================================="
echo "📝 诊断建议："
echo "=========================================="
echo ""
echo "如果密码格式不是 'bcrypt'，可能需要重置密码"
echo "如果数据库查询失败，检查用户权限"
echo "如果 API 返回 500，查看应用日志获取详细错误"

