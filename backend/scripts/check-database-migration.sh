#!/bin/bash

# 全面检查数据库迁移和表结构
# 使用方法：bash scripts/check-database-migration.sh

echo "🔍 全面检查数据库迁移和表结构..."
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
    DB_HOST=${DB_HOST:-127.0.0.1}
    ADMIN_DB_PORT="5432"
    
    # 尝试获取 postgres 用户密码
    POSTGRES_PASSWORD=$(grep "^POSTGRES_PASSWORD=" .env 2>/dev/null | cut -d'=' -f2 | tr -d ' ' | tr -d '"' | tr -d "'" || echo "")
    if [ -n "$POSTGRES_PASSWORD" ]; then
        export PGPASSWORD="$POSTGRES_PASSWORD"
    else
        export PGPASSWORD="${DB_PASSWORD:-}"
    fi
else
    echo "❌ .env 文件不存在"
    exit 1
fi

# 检查 psql
if [ -f "/www/server/pgsql/bin/psql" ]; then
    PSQL="/www/server/pgsql/bin/psql"
else
    PSQL="psql"
fi

echo "数据库: $DB_NAME@$DB_HOST:$ADMIN_DB_PORT"
echo ""

# 1. 检查所有表是否存在
echo "1️⃣  检查所有表是否存在..."
TABLES=("users" "folders" "notes" "urls" "user_settings" "messages" "message_history" "verification_codes" "logs")

for table in "${TABLES[@]}"; do
    EXISTS=$($PSQL -h "$DB_HOST" -p "$ADMIN_DB_PORT" -U postgres -d "$DB_NAME" -t -c "
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = '$table'
    );
    " 2>&1 | tr -d ' ')
    
    if [ "$EXISTS" = "t" ]; then
        echo "   ✅ $table 表存在"
    else
        echo "   ❌ $table 表不存在"
    fi
done
echo ""

# 2. 检查 users 表结构
echo "2️⃣  检查 users 表结构..."
USERS_COLUMNS=$($PSQL -h "$DB_HOST" -p "$ADMIN_DB_PORT" -U postgres -d "$DB_NAME" -t -c "
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'users'
ORDER BY ordinal_position;
" 2>&1)

if [ -n "$USERS_COLUMNS" ]; then
    echo "   users 表字段："
    echo "$USERS_COLUMNS" | while IFS='|' read -r name type nullable default; do
        name=$(echo "$name" | xargs)
        type=$(echo "$type" | xargs)
        nullable=$(echo "$nullable" | xargs)
        default=$(echo "$default" | xargs)
        echo "     - $name: $type (nullable: $nullable, default: $default)"
    done
else
    echo "   ❌ 无法获取 users 表结构"
fi
echo ""

# 3. 检查 notes 表结构（特别注意 id 字段）
echo "3️⃣  检查 notes 表结构..."
NOTES_COLUMNS=$($PSQL -h "$DB_HOST" -p "$ADMIN_DB_PORT" -U postgres -d "$DB_NAME" -t -c "
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'notes'
ORDER BY ordinal_position;
" 2>&1)

if [ -n "$NOTES_COLUMNS" ]; then
    echo "   notes 表字段："
    HAS_ID=false
    echo "$NOTES_COLUMNS" | while IFS='|' read -r name type nullable; do
        name=$(echo "$name" | xargs)
        type=$(echo "$type" | xargs)
        nullable=$(echo "$nullable" | xargs)
        echo "     - $name: $type (nullable: $nullable)"
        if [ "$name" = "id" ]; then
            HAS_ID=true
        fi
    done
    
    # 检查是否有 id 字段
    ID_EXISTS=$($PSQL -h "$DB_HOST" -p "$ADMIN_DB_PORT" -U postgres -d "$DB_NAME" -t -c "
    SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'notes' 
        AND column_name = 'id'
    );
    " 2>&1 | tr -d ' ')
    
    if [ "$ID_EXISTS" != "t" ]; then
        echo "   ⚠️  notes 表缺少 id 字段！"
    fi
else
    echo "   ❌ 无法获取 notes 表结构"
fi
echo ""

# 4. 检查所有索引
echo "4️⃣  检查关键索引..."
KEY_INDEXES=(
    "idx_users_email"
    "idx_notes_user_id"
    "idx_notes_user_id_deleted"
    "idx_notes_user_id_updated_at"
    "idx_folders_user_id"
    "idx_messages_user_id"
)

for index in "${KEY_INDEXES[@]}"; do
    EXISTS=$($PSQL -h "$DB_HOST" -p "$ADMIN_DB_PORT" -U postgres -d "$DB_NAME" -t -c "
    SELECT EXISTS (
        SELECT FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND indexname = '$index'
    );
    " 2>&1 | tr -d ' ')
    
    if [ "$EXISTS" = "t" ]; then
        echo "   ✅ $index 索引存在"
    else
        echo "   ❌ $index 索引不存在"
    fi
done
echo ""

# 5. 检查用户数据
echo "5️⃣  检查用户数据..."
USER_COUNT=$($PSQL -h "$DB_HOST" -p "$ADMIN_DB_PORT" -U postgres -d "$DB_NAME" -t -c "
SELECT COUNT(*) FROM users;
" 2>&1 | tr -d ' ')

echo "   用户总数: $USER_COUNT"

if [ "$USER_COUNT" -gt 0 ]; then
    echo "   用户列表："
    $PSQL -h "$DB_HOST" -p "$ADMIN_DB_PORT" -U postgres -d "$DB_NAME" -c "
    SELECT 
        email, 
        username, 
        CASE 
            WHEN password LIKE '\$2a\$%' OR password LIKE '\$2b\$%' OR password LIKE '\$2y\$%' THEN 'bcrypt ✅'
            ELSE 'raw ❌'
        END as password_format,
        LENGTH(password) as password_length,
        created_at
    FROM users 
    ORDER BY created_at DESC 
    LIMIT 10;
    " 2>&1 | tail -n +3 | head -n -1
fi
echo ""

# 6. 检查外键约束
echo "6️⃣  检查外键约束..."
FOREIGN_KEYS=$($PSQL -h "$DB_HOST" -p "$ADMIN_DB_PORT" -U postgres -d "$DB_NAME" -t -c "
SELECT 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name;
" 2>&1)

if [ -n "$FOREIGN_KEYS" ]; then
    echo "   外键约束："
    echo "$FOREIGN_KEYS" | while IFS='|' read -r table column foreign_table foreign_column; do
        table=$(echo "$table" | xargs)
        column=$(echo "$column" | xargs)
        foreign_table=$(echo "$foreign_table" | xargs)
        foreign_column=$(echo "$foreign_column" | xargs)
        echo "     - $table.$column -> $foreign_table.$foreign_column"
    done
else
    echo "   ⚠️  未找到外键约束"
fi
echo ""

# 7. 检查主键约束
echo "7️⃣  检查主键约束..."
PRIMARY_KEYS=$($PSQL -h "$DB_HOST" -p "$ADMIN_DB_PORT" -U postgres -d "$DB_NAME" -t -c "
SELECT 
    tc.table_name,
    string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) AS columns
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'PRIMARY KEY'
GROUP BY tc.table_name
ORDER BY tc.table_name;
" 2>&1)

if [ -n "$PRIMARY_KEYS" ]; then
    echo "   主键约束："
    echo "$PRIMARY_KEYS" | while IFS='|' read -r table columns; do
        table=$(echo "$table" | xargs)
        columns=$(echo "$columns" | xargs)
        echo "     - $table: ($columns)"
    done
else
    echo "   ⚠️  未找到主键约束"
fi
echo ""

# 8. 检查迁移文件中的问题
echo "8️⃣  检查迁移文件..."
if [ -f "migrations/001_create_schema.sql" ]; then
    # 检查 notes 表定义是否缺少 id 字段
    if grep -A 10 "CREATE TABLE IF NOT EXISTS notes" migrations/001_create_schema.sql | grep -q "id VARCHAR"; then
        echo "   ✅ notes 表定义包含 id 字段"
    else
        echo "   ⚠️  notes 表定义可能缺少 id 字段"
        echo "   检查迁移文件..."
        grep -A 15 "CREATE TABLE IF NOT EXISTS notes" migrations/001_create_schema.sql | head -20
    fi
else
    echo "   ❌ 迁移文件不存在"
fi
echo ""

# 9. 测试查询
echo "9️⃣  测试关键查询..."
echo "   测试查找用户..."
TEST_USER=$($PSQL -h "$DB_HOST" -p "$ADMIN_DB_PORT" -U postgres -d "$DB_NAME" -t -c "
SELECT email, username FROM users LIMIT 1;
" 2>&1 | tr -d ' ')

if [ -n "$TEST_USER" ]; then
    echo "   ✅ 用户查询正常"
else
    echo "   ❌ 用户查询失败"
fi
echo ""

echo "=========================================="
echo "检查完成"
echo "=========================================="
echo ""
echo "💡 如果发现问题："
echo "1. 如果表不存在，运行迁移："
echo "   /www/server/pgsql/bin/psql -h $DB_HOST -p $ADMIN_DB_PORT -U postgres -d $DB_NAME -f migrations/001_create_schema.sql"
echo ""
echo "2. 如果索引缺失，运行索引优化："
echo "   /www/server/pgsql/bin/psql -h $DB_HOST -p $ADMIN_DB_PORT -U postgres -d $DB_NAME -f migrations/003_optimize_indexes.sql"
echo ""
echo "3. 如果 notes 表缺少 id 字段，需要修复迁移文件并重新创建表"
echo ""

