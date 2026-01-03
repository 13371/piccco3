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

# 对于管理操作，使用 postgres 用户直接连接 PostgreSQL（端口 5432）
# 而不是通过 PgBouncer（端口 6432）
ADMIN_DB_PORT="5432"
ADMIN_DB_USER="postgres"

# 尝试获取 postgres 用户密码（如果 .env 中有）
POSTGRES_PASSWORD=$(grep "^POSTGRES_PASSWORD=" .env 2>/dev/null | cut -d'=' -f2 | tr -d ' ' | tr -d '"' | tr -d "'" || echo "")

# 如果使用 PgBouncer 端口，切换到直接 PostgreSQL 连接
if [ "$DB_PORT" = "6432" ]; then
    echo "   ⚠️  检测到 PgBouncer 端口 (6432)，切换到直接 PostgreSQL 连接 (5432)"
    ADMIN_DB_PORT="5432"
fi

# 设置密码（优先使用 POSTGRES_PASSWORD，否则使用 DB_PASSWORD）
if [ -n "$POSTGRES_PASSWORD" ]; then
    export PGPASSWORD="$POSTGRES_PASSWORD"
else
    export PGPASSWORD="$DB_PASSWORD"
fi

# 检查数据库连接
echo "1️⃣  检查数据库连接..."
echo "   使用: $ADMIN_DB_USER@$DB_HOST:$ADMIN_DB_PORT"
if $PSQL -h "$DB_HOST" -p "$ADMIN_DB_PORT" -U "$ADMIN_DB_USER" -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
    echo "   ✅ 数据库连接正常"
else
    echo "   ❌ 数据库连接失败"
    echo "   尝试直接连接..."
    $PSQL -h "$DB_HOST" -p "$ADMIN_DB_PORT" -U "$ADMIN_DB_USER" -d "$DB_NAME" -c "SELECT 1;"
    echo ""
    echo "   💡 提示：如果密码错误，请："
    echo "   1. 检查 .env 中的 POSTGRES_PASSWORD"
    echo "   2. 或者手动输入 postgres 用户密码"
    exit 1
fi
echo ""

# 检查所有用户
echo "2️⃣  检查所有用户..."
ALL_USERS=$($PSQL -h "$DB_HOST" -p "$ADMIN_DB_PORT" -U "$ADMIN_DB_USER" -d "$DB_NAME" -t -c "
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
USER_INFO=$($PSQL -h "$DB_HOST" -p "$ADMIN_DB_PORT" -U "$ADMIN_DB_USER" -d "$DB_NAME" -t -c "
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
FUZZY_MATCH=$($PSQL -h "$DB_HOST" -p "$ADMIN_DB_PORT" -U "$ADMIN_DB_USER" -d "$DB_NAME" -t -c "
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

