#!/bin/bash

# 修复重复邮箱的迁移问题
# 使用方法：bash scripts/fix-duplicate-email-migration.sh [email]

EMAIL="${1:-zq13371@gmail.com}"

echo "🔧 修复重复邮箱的迁移问题..."
echo "=========================================="
echo ""
echo "处理邮箱: $EMAIL"
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
else
    echo "❌ 未找到 .env 文件"
    exit 1
fi

# 检查 psql
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

DB_PORT="5432"

# 1. 检查数据库中的用户
echo "1️⃣  检查数据库中的用户..."
DB_USER=$($PSQL -h "$DB_HOST" -p "$DB_PORT" -U postgres -d "$DB_NAME" -t -c "
SELECT id, email, username, created_at 
FROM users 
WHERE email = '$EMAIL';
" 2>/dev/null | tr -d ' ')

if [ -z "$DB_USER" ]; then
    echo "   ❌ 数据库中未找到该邮箱的用户"
    exit 1
fi

DB_USER_ID=$(echo "$DB_USER" | cut -d'|' -f1)
DB_USERNAME=$(echo "$DB_USER" | cut -d'|' -f3)
DB_CREATED_AT=$(echo "$DB_USER" | cut -d'|' -f4)

echo "   ✅ 找到数据库中的用户："
echo "      ID: $DB_USER_ID"
echo "      邮箱: $EMAIL"
echo "      用户名: $DB_USERNAME"
echo "      创建时间: $DB_CREATED_AT"
echo ""

# 2. 检查文件存储中的用户
echo "2️⃣  检查文件存储中的用户..."
FILE_STORAGE_DIR="$PROJECT_DIR/data/users"
FILE_USER_FILE=$(find "$FILE_STORAGE_DIR" -name "*.json" -type f 2>/dev/null | xargs grep -l "\"email\":\"$EMAIL\"" 2>/dev/null | head -1)

if [ -z "$FILE_USER_FILE" ]; then
    echo "   ⚠️  文件存储中未找到该邮箱的用户"
    echo "   可能已经迁移或文件已删除"
    echo ""
    echo "💡 建议："
    echo "   如果数据库中的用户数据完整，可以忽略此问题"
    echo "   如果需要迁移文件存储中的用户数据，请检查文件存储目录"
    exit 0
fi

FILE_USER_ID=$(grep -o '"id":"[^"]*"' "$FILE_USER_FILE" 2>/dev/null | head -1 | cut -d'"' -f4)
FILE_USERNAME=$(grep -o '"username":"[^"]*"' "$FILE_USER_FILE" 2>/dev/null | head -1 | cut -d'"' -f4)

echo "   ✅ 找到文件存储中的用户："
echo "      ID: $FILE_USER_ID"
echo "      邮箱: $EMAIL"
echo "      用户名: $FILE_USERNAME"
echo ""

# 3. 比较并给出建议
echo "3️⃣  分析冲突..."
if [ "$DB_USER_ID" = "$FILE_USER_ID" ]; then
    echo "   ✅ 用户ID相同，可能是同一用户"
    echo "   数据可能已经迁移，或者需要更新"
else
    echo "   ⚠️  用户ID不同，存在冲突："
    echo "      数据库用户ID: $DB_USER_ID"
    echo "      文件存储用户ID: $FILE_USER_ID"
    echo ""
    echo "💡 这种情况需要手动处理："
    echo "   1. 如果数据库中的用户是正确的，可以忽略文件存储中的用户"
    echo "   2. 如果需要合并数据，需要手动迁移文件存储中的用户数据到数据库用户"
    echo "   3. 或者删除数据库中的用户，重新迁移文件存储中的用户"
fi
echo ""

# 4. 检查用户数据
echo "4️⃣  检查用户数据..."
DB_DATA_COUNT=$($PSQL -h "$DB_HOST" -p "$DB_PORT" -U postgres -d "$DB_NAME" -t -c "
SELECT 
    (SELECT COUNT(*) FROM folders WHERE user_id = '$DB_USER_ID') +
    (SELECT COUNT(*) FROM notes WHERE user_id = '$DB_USER_ID') +
    (SELECT COUNT(*) FROM urls WHERE user_id = '$DB_USER_ID');
" 2>/dev/null | tr -d ' ')

if [ -n "$DB_DATA_COUNT" ] && [ "$DB_DATA_COUNT" != "" ]; then
    echo "   数据库中的用户数据："
    FOLDERS_COUNT=$($PSQL -h "$DB_HOST" -p "$DB_PORT" -U postgres -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM folders WHERE user_id = '$DB_USER_ID';" 2>/dev/null | tr -d ' ')
    NOTES_COUNT=$($PSQL -h "$DB_HOST" -p "$DB_PORT" -U postgres -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM notes WHERE user_id = '$DB_USER_ID';" 2>/dev/null | tr -d ' ')
    URLS_COUNT=$($PSQL -h "$DB_HOST" -p "$DB_PORT" -U postgres -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM urls WHERE user_id = '$DB_USER_ID';" 2>/dev/null | tr -d ' ')
    
    echo "      文件夹: $FOLDERS_COUNT"
    echo "      笔记: $NOTES_COUNT"
    echo "      URL: $URLS_COUNT"
    echo ""
    
    if [ "$DB_DATA_COUNT" -gt 0 ]; then
        echo "   ✅ 数据库中的用户已有数据"
    else
        echo "   ⚠️  数据库中的用户没有数据"
        echo "   可能需要迁移文件存储中的用户数据"
    fi
fi
echo ""

echo "=========================================="
echo "✅ 检查完成"
echo "=========================================="
echo ""
echo "📝 建议："
if [ "$DB_USER_ID" != "$FILE_USER_ID" ]; then
    echo "   由于用户ID不同，需要手动处理："
    echo "   1. 如果数据库中的用户是正确的，可以忽略文件存储中的用户"
    echo "   2. 如果需要迁移文件存储中的数据，可以使用以下命令："
    echo "      node -e \""
    echo "        const fileUserDataStore = require('./src/store/userDataStore');"
    echo "        const dbUserDataDao = require('./src/db/dao/userDataDao');"
    echo "        (async () => {"
    echo "          const userData = await fileUserDataStore.getUserData('$FILE_USER_ID');"
    echo "          await dbUserDataDao.saveUserData('$DB_USER_ID', userData);"
    echo "        })();"
    echo "      \""
else
    echo "   用户ID相同，数据可能已经同步"
    echo "   如果数据不完整，可以重新运行迁移脚本（它会跳过已存在的用户）"
fi
echo ""

