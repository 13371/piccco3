#!/bin/bash

# 检查用户数据迁移状态
# 使用方法：bash scripts/check-user-migration-status.sh

echo "🔍 检查用户数据迁移状态..."
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
    STORAGE_MODE=${STORAGE_MODE:-file}
else
    echo "❌ 未找到 .env 文件"
    exit 1
fi

echo "当前存储模式: $STORAGE_MODE"
echo ""

# 1. 检查文件存储中的用户
echo "1️⃣  检查文件存储中的用户..."
FILE_STORAGE_DIR="$PROJECT_DIR/data/users"
if [ -d "$FILE_STORAGE_DIR" ]; then
    FILE_USER_COUNT=$(find "$FILE_STORAGE_DIR" -name "*.json" -type f 2>/dev/null | wc -l)
    echo "   ✅ 文件存储目录存在: $FILE_STORAGE_DIR"
    echo "   文件存储中的用户数: $FILE_USER_COUNT"
    
    if [ "$FILE_USER_COUNT" -gt 0 ]; then
        echo "   文件存储中的用户文件："
        find "$FILE_STORAGE_DIR" -name "*.json" -type f 2>/dev/null | head -5 | while read file; do
            EMAIL=$(grep -o '"email":"[^"]*"' "$file" 2>/dev/null | head -1 | cut -d'"' -f4)
            USERNAME=$(grep -o '"username":"[^"]*"' "$file" 2>/dev/null | head -1 | cut -d'"' -f4)
            echo "     - $EMAIL ($USERNAME)"
        done
        if [ "$FILE_USER_COUNT" -gt 5 ]; then
            echo "     ... 还有 $((FILE_USER_COUNT - 5)) 个用户"
        fi
    fi
else
    echo "   ⚠️  文件存储目录不存在: $FILE_STORAGE_DIR"
    FILE_USER_COUNT=0
fi
echo ""

# 2. 检查数据库中的用户
echo "2️⃣  检查数据库中的用户..."
if [ -f "/www/server/pgsql/bin/psql" ]; then
    PSQL="/www/server/pgsql/bin/psql"
else
    PSQL="psql"
fi

# 尝试获取 postgres 用户密码
POSTGRES_PASSWORD=$(grep "^POSTGRES_PASSWORD=" .env 2>/dev/null | cut -d'=' -f2 | tr -d ' ' | tr -d '"' | tr -d "'" || echo "")
if [ -n "$POSTGRES_PASSWORD" ]; then
    export PGPASSWORD="$POSTGRES_PASSWORD"
else
    export PGPASSWORD="${DB_PASSWORD:-}"
fi

# 检查数据库连接
DB_PORT="5432"
if [ "$DB_PORT" = "6432" ]; then
    DB_PORT="5432"  # 管理操作使用直接 PostgreSQL 端口
fi

DB_USER_COUNT=$($PSQL -h "$DB_HOST" -p "$DB_PORT" -U postgres -d "$DB_NAME" -t -c "
SELECT COUNT(*) FROM users;
" 2>/dev/null | tr -d ' ')

if [ -n "$DB_USER_COUNT" ] && [ "$DB_USER_COUNT" != "" ]; then
    echo "   ✅ 数据库连接成功"
    echo "   数据库中的用户数: $DB_USER_COUNT"
    
    if [ "$DB_USER_COUNT" -gt 0 ]; then
        echo "   数据库中的用户："
        $PSQL -h "$DB_HOST" -p "$DB_PORT" -U postgres -d "$DB_NAME" -c "
        SELECT id, email, username, created_at 
        FROM users 
        ORDER BY created_at DESC 
        LIMIT 5;
        " 2>/dev/null | grep -v "^$" | grep -v "row" | grep -v "---" | grep -v "id\|email\|username\|created_at" | while read line; do
            if [ -n "$line" ]; then
                echo "     - $line"
            fi
        done
    fi
else
    echo "   ❌ 无法连接到数据库或查询失败"
    DB_USER_COUNT=0
fi
echo ""

# 3. 比较并给出建议
echo "3️⃣  迁移状态分析..."
echo "=========================================="

if [ "$FILE_USER_COUNT" -gt 0 ] && [ "$DB_USER_COUNT" -eq 0 ]; then
    echo "⚠️  发现文件存储中有 $FILE_USER_COUNT 个用户，但数据库中没有用户"
    echo ""
    echo "💡 建议："
    echo "   需要运行数据迁移脚本将用户从文件存储迁移到数据库"
    echo ""
    echo "   执行以下命令进行迁移："
    echo "   node scripts/migrate-to-db.js"
    echo ""
elif [ "$FILE_USER_COUNT" -gt 0 ] && [ "$DB_USER_COUNT" -gt 0 ]; then
    if [ "$FILE_USER_COUNT" -gt "$DB_USER_COUNT" ]; then
        echo "⚠️  文件存储中有 $FILE_USER_COUNT 个用户，数据库中有 $DB_USER_COUNT 个用户"
        echo "   可能有 $((FILE_USER_COUNT - DB_USER_COUNT)) 个用户未迁移"
        echo ""
        echo "💡 建议："
        echo "   运行迁移脚本以迁移剩余的 $((FILE_USER_COUNT - DB_USER_COUNT)) 个用户"
        echo "   node scripts/migrate-to-db.js"
        echo ""
    else
        echo "✅ 用户数据已迁移（数据库中的用户数 >= 文件存储中的用户数）"
    fi
elif [ "$FILE_USER_COUNT" -eq 0 ] && [ "$DB_USER_COUNT" -gt 0 ]; then
    echo "✅ 所有用户数据已在数据库中（文件存储中没有用户）"
elif [ "$FILE_USER_COUNT" -eq 0 ] && [ "$DB_USER_COUNT" -eq 0 ]; then
    echo "⚠️  文件存储和数据库中都没有用户数据"
    echo "   这是新安装的系统，或者数据已丢失"
fi

echo ""
echo "📝 当前存储模式: $STORAGE_MODE"
if [ "$STORAGE_MODE" = "file" ]; then
    echo "   ⚠️  当前使用文件存储模式，管理员列表只会显示数据库中的用户"
    echo "   如果文件存储中有用户但数据库中没有，需要："
    echo "   1. 运行迁移脚本: node scripts/migrate-to-db.js"
    echo "   2. 或者切换存储模式: STORAGE_MODE=dual 或 STORAGE_MODE=db"
elif [ "$STORAGE_MODE" = "db" ]; then
    echo "   ✅ 当前使用数据库存储模式"
    echo "   管理员列表会显示数据库中的所有用户"
elif [ "$STORAGE_MODE" = "dual" ]; then
    echo "   ✅ 当前使用双写模式"
    echo "   新数据会同时写入文件和数据库"
fi
echo ""

