#!/bin/bash

# 最终修复登录问题
# 使用方法：bash scripts/fix-login-final.sh [email]

EMAIL="${1:-zq13371@gmail.com}"

echo "🔧 开始修复登录问题..."
echo "=========================================="
echo ""

# 获取项目目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# 1. 检查并设置 STORAGE_MODE
echo "1️⃣  检查 STORAGE_MODE..."
if [ -f .env ]; then
    if grep -q "^STORAGE_MODE=" .env; then
        CURRENT_MODE=$(grep "^STORAGE_MODE=" .env | cut -d'=' -f2 | tr -d ' ' | tr -d '"' | tr -d "'")
        echo "   当前 STORAGE_MODE: $CURRENT_MODE"
        if [ "$CURRENT_MODE" != "db" ]; then
            echo "   ⚠️  STORAGE_MODE 不是 db，正在更新..."
            sed -i 's/^STORAGE_MODE=.*/STORAGE_MODE=db/' .env
            echo "   ✅ 已更新为 STORAGE_MODE=db"
        else
            echo "   ✅ STORAGE_MODE 已正确设置为 db"
        fi
    else
        echo "   ⚠️  STORAGE_MODE 未设置，正在添加..."
        echo "" >> .env
        echo "# 存储模式" >> .env
        echo "STORAGE_MODE=db" >> .env
        echo "   ✅ 已添加 STORAGE_MODE=db"
    fi
else
    echo "   ❌ .env 文件不存在"
    exit 1
fi
echo ""

# 2. 读取数据库配置
echo "2️⃣  读取数据库配置..."
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
    echo "   ❌ .env 文件不存在"
    exit 1
fi

# 对于管理操作，使用 postgres 用户直接连接 PostgreSQL（端口 5432）
ADMIN_DB_PORT="5432"
ADMIN_DB_USER="postgres"

# 如果使用 PgBouncer 端口，切换到直接 PostgreSQL 连接
if [ "$DB_PORT" = "6432" ]; then
    echo "   ⚠️  检测到 PgBouncer 端口 (6432)，切换到直接 PostgreSQL 连接 (5432)"
    ADMIN_DB_PORT="5432"
fi

# 尝试获取 postgres 用户密码（如果 .env 中有）
POSTGRES_PASSWORD=$(grep "^POSTGRES_PASSWORD=" .env 2>/dev/null | cut -d'=' -f2 | tr -d ' ' | tr -d '"' | tr -d "'" || echo "")

# 设置密码（优先使用 POSTGRES_PASSWORD，否则使用 DB_PASSWORD）
if [ -n "$POSTGRES_PASSWORD" ]; then
    export PGPASSWORD="$POSTGRES_PASSWORD"
else
    export PGPASSWORD="$DB_PASSWORD"
fi

echo "   数据库: $DB_NAME@$DB_HOST:$ADMIN_DB_PORT (管理连接)"
echo ""

# 检查 psql
if [ -f "/www/server/pgsql/bin/psql" ]; then
    PSQL="/www/server/pgsql/bin/psql"
else
    PSQL="psql"
fi

# 3. 检查用户是否存在
echo "3️⃣  检查用户是否存在: $EMAIL"
USER_EXISTS=$($PSQL -h "$DB_HOST" -p "$ADMIN_DB_PORT" -U "$ADMIN_DB_USER" -d "$DB_NAME" -t -c "
SELECT COUNT(*) FROM users WHERE email = '$EMAIL';
" 2>&1 | tr -d ' ')

if [ -z "$USER_EXISTS" ] || [ "$USER_EXISTS" != "1" ]; then
    echo "   ❌ 用户不存在: $EMAIL"
    echo ""
    echo "   正在查找所有用户..."
    ALL_USERS=$($PSQL -h "$DB_HOST" -p "$ADMIN_DB_PORT" -U "$ADMIN_DB_USER" -d "$DB_NAME" -t -c "
    SELECT email, username FROM users ORDER BY created_at DESC LIMIT 10;
    " 2>&1)
    if [ -n "$ALL_USERS" ]; then
        echo "$ALL_USERS" | while IFS= read -r line; do
            if [ -n "$line" ]; then
                echo "     $line"
            fi
        done
    fi
    exit 1
fi

echo "   ✅ 用户存在"
echo ""

# 4. 检查密码格式
echo "4️⃣  检查密码格式..."
PASSWORD_INFO=$($PSQL -h "$DB_HOST" -p "$ADMIN_DB_PORT" -U "$ADMIN_DB_USER" -d "$DB_NAME" -t -c "
SELECT 
    CASE 
        WHEN password LIKE '\$2a\$%' OR password LIKE '\$2b\$%' OR password LIKE '\$2y\$%' THEN 'bcrypt'
        ELSE 'raw'
    END as format,
    LENGTH(password) as length
FROM users 
WHERE email = '$EMAIL';
" 2>&1)

if [ -z "$PASSWORD_INFO" ]; then
    echo "   ❌ 无法获取密码信息"
    exit 1
fi

PASSWORD_FORMAT=$(echo "$PASSWORD_INFO" | awk '{print $1}')
PASSWORD_LENGTH=$(echo "$PASSWORD_INFO" | awk '{print $2}')

echo "   密码格式: $PASSWORD_FORMAT"
echo "   密码长度: $PASSWORD_LENGTH"

if [ "$PASSWORD_FORMAT" != "bcrypt" ] || [ "$PASSWORD_LENGTH" != "60" ]; then
    echo "   ⚠️  密码格式不正确，需要重置密码"
    echo ""
    echo "   请运行以下命令重置密码："
    echo "   bash scripts/reset-password-simple.sh $EMAIL"
    echo ""
    read -p "   是否现在重置密码？(y/n): " RESET_PASSWORD
    if [ "$RESET_PASSWORD" = "y" ] || [ "$RESET_PASSWORD" = "Y" ]; then
        if [ -f "scripts/reset-password-simple.sh" ]; then
            bash scripts/reset-password-simple.sh "$EMAIL"
        else
            echo "   ❌ 重置密码脚本不存在，请手动运行："
            echo "   bash scripts/reset-password-simple.sh $EMAIL"
            exit 1
        fi
    else
        echo "   ⚠️  请手动重置密码后再运行此脚本"
        exit 1
    fi
else
    echo "   ✅ 密码格式正确（bcrypt，长度 60）"
fi
echo ""

# 5. 清除缓存并重启应用
echo "5️⃣  清除缓存并重启应用..."
if command -v pm2 >/dev/null 2>&1; then
    echo "   正在重启应用..."
    pm2 restart piccco-backend --update-env
    sleep 5
    echo "   ✅ 应用已重启"
    
    # 检查应用状态
    PM2_STATUS=$(pm2 list | grep piccco-backend | awk '{print $10}')
    if [ "$PM2_STATUS" = "online" ]; then
        echo "   ✅ 应用状态: online"
    else
        echo "   ⚠️  应用状态: $PM2_STATUS"
    fi
else
    echo "   ⚠️  未找到 PM2"
fi
echo ""

# 6. 验证配置
echo "6️⃣  验证配置..."
echo "   STORAGE_MODE: $(grep "^STORAGE_MODE=" .env | cut -d'=' -f2 | tr -d ' ')"
echo "   密码格式: $PASSWORD_FORMAT"
echo "   密码长度: $PASSWORD_LENGTH"
echo ""

# 7. 测试连接
echo "7️⃣  测试数据库连接..."
if PGPASSWORD="$PGPASSWORD" /www/server/pgsql/bin/psql -h "$DB_HOST" -p "$ADMIN_DB_PORT" -U "$ADMIN_DB_USER" -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
    echo "   ✅ 数据库连接正常"
else
    echo "   ❌ 数据库连接失败"
fi
echo ""

echo "=========================================="
echo "✅ 修复完成！"
echo "=========================================="
echo ""
echo "📝 下一步："
echo "1. 使用重置时设置的密码尝试登录"
echo "2. 如果仍然失败，查看日志："
echo "   pm2 logs piccco-backend | grep -i login"
echo "3. 确认输入的密码与重置时设置的密码一致"
echo ""

