#!/bin/bash

# 检查用户是否存在
# 使用方法：bash scripts/check-user-exists.sh [email]

EMAIL="${1:-zq13371@gmail.com}"

echo "🔍 检查用户是否存在..."
echo "=========================================="
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
    DB_USER=${DB_USER:-postgres}
    DB_HOST=${DB_HOST:-127.0.0.1}
    DB_PORT=${DB_PORT:-5432}
    DB_PASSWORD=${DB_PASSWORD:-}
else
    echo "❌ 未找到 .env 文件"
    exit 1
fi

echo "数据库配置："
echo "  DB_HOST: $DB_HOST"
echo "  DB_PORT: $DB_PORT"
echo "  DB_NAME: $DB_NAME"
echo "  DB_USER: $DB_USER"
echo ""

# 检查 psql
if [ -f "/www/server/pgsql/bin/psql" ]; then
    PSQL="/www/server/pgsql/bin/psql"
else
    PSQL="psql"
fi

# 设置密码
export PGPASSWORD="$DB_PASSWORD"

# 检查数据库连接
echo "1️⃣  检查数据库连接..."
if $PSQL -h "$DB_HOST" -p "$DB_PORT" -U postgres -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
    echo "   ✅ 数据库连接正常"
else
    echo "   ❌ 数据库连接失败"
    echo "   尝试直接连接..."
    $PSQL -h "$DB_HOST" -p "$DB_PORT" -U postgres -d "$DB_NAME" -c "SELECT 1;"
    exit 1
fi
echo ""

# 检查所有用户
echo "2️⃣  检查所有用户..."
ALL_USERS=$($PSQL -h "$DB_HOST" -p "$DB_PORT" -U postgres -d "$DB_NAME" -t -c "
SELECT email, username, created_at 
FROM users 
ORDER BY created_at DESC 
LIMIT 10;
" 2>&1)

if [ $? -eq 0 ]; then
    echo "   用户列表："
    echo "$ALL_USERS" | while IFS= read -r line; do
        if [ -n "$line" ]; then
            echo "     $line"
        fi
    done
else
    echo "   ❌ 查询失败："
    echo "$ALL_USERS"
fi
echo ""

# 检查特定用户
echo "3️⃣  检查用户: $EMAIL"
USER_INFO=$($PSQL -h "$DB_HOST" -p "$DB_PORT" -U postgres -d "$DB_NAME" -t -c "
SELECT 
    email, 
    username, 
    CASE 
        WHEN password LIKE '\$2a\$%' OR password LIKE '\$2b\$%' OR password LIKE '\$2y\$%' THEN 'bcrypt'
        ELSE 'raw'
    END as password_format,
    LENGTH(password) as password_length,
    created_at
FROM users 
WHERE email = '$EMAIL';
" 2>&1)

if [ $? -eq 0 ] && [ -n "$USER_INFO" ]; then
    echo "   ✅ 用户存在："
    echo "$USER_INFO" | while IFS= read -r line; do
        if [ -n "$line" ]; then
            echo "     $line"
        fi
    done
else
    echo "   ❌ 用户不存在或查询失败"
    if [ -n "$USER_INFO" ]; then
        echo "   错误信息："
        echo "$USER_INFO"
    fi
fi
echo ""

# 尝试模糊匹配
echo "4️⃣  尝试模糊匹配邮箱..."
FUZZY_MATCH=$($PSQL -h "$DB_HOST" -p "$DB_PORT" -U postgres -d "$DB_NAME" -t -c "
SELECT email, username 
FROM users 
WHERE email LIKE '%$EMAIL%' OR email LIKE '%zq%' 
ORDER BY email 
LIMIT 5;
" 2>&1)

if [ $? -eq 0 ] && [ -n "$FUZZY_MATCH" ]; then
    echo "   可能的匹配："
    echo "$FUZZY_MATCH" | while IFS= read -r line; do
        if [ -n "$line" ]; then
            echo "     $line"
        fi
    done
else
    echo "   未找到匹配的用户"
fi
echo ""

echo "=========================================="
echo "检查完成"
echo "=========================================="

