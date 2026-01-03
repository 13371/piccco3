#!/bin/bash

# 检查数据库索引脚本
# 使用方法：bash scripts/check-indexes.sh

set -e

echo "🔍 检查数据库索引..."
echo ""

# 获取项目目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# 读取数据库配置
cd "$PROJECT_DIR"
if [ -f .env ]; then
    DB_NAME=$(grep "^DB_NAME=" .env | cut -d'=' -f2 | tr -d ' ' | tr -d '"' | tr -d "'")
else
    DB_NAME="piccco"
fi

DB_NAME=${DB_NAME:-piccco}

# 检查 psql
if [ -f "/www/server/pgsql/bin/psql" ]; then
    PSQL="/www/server/pgsql/bin/psql"
elif command -v psql >/dev/null 2>&1; then
    PSQL="psql"
else
    echo "❌ 错误: 未找到 psql 命令"
    exit 1
fi

# 使用 TCP/IP 连接（避免 socket 连接问题）
PSQL_CMD="$PSQL -h 127.0.0.1 -p 5432"

echo "📋 数据库: $DB_NAME"
echo ""

# 定义必需的索引
declare -A REQUIRED_INDEXES=(
    ["users.idx_users_email"]="UNIQUE INDEX idx_users_email ON users(email)"
    ["users.idx_users_created_at"]="INDEX idx_users_created_at ON users(created_at)"
    ["users.idx_users_status"]="INDEX idx_users_status ON users(is_banned)"
    ["notes.idx_notes_user_id"]="INDEX idx_notes_user_id ON notes(user_id)"
    ["notes.idx_notes_updated_at"]="INDEX idx_notes_updated_at ON notes(updated_at)"
    ["notes.idx_notes_is_deleted"]="INDEX idx_notes_is_deleted ON notes(is_deleted)"
    ["notes.idx_notes_user_id_deleted"]="INDEX idx_notes_user_id_deleted ON notes(user_id, is_deleted)"
    ["notes.idx_notes_user_id_updated_at"]="INDEX idx_notes_user_id_updated_at ON notes(user_id, updated_at DESC)"
    ["folders.idx_folders_user_id"]="INDEX idx_folders_user_id ON folders(user_id)"
    ["folders.idx_folders_user_id_deleted"]="INDEX idx_folders_user_id_deleted ON folders(user_id, is_deleted)"
    ["folders.idx_folders_updated_at"]="INDEX idx_folders_updated_at ON folders(updated_at)"
    ["messages.idx_messages_user_id"]="INDEX idx_messages_user_id ON messages(user_id)"
    ["messages.idx_messages_user_id_created_at"]="INDEX idx_messages_user_id_created_at ON messages(user_id, created_at DESC)"
    ["messages.idx_messages_is_read"]="INDEX idx_messages_is_read ON messages(is_read)"
    ["messages.idx_messages_user_id_read"]="INDEX idx_messages_user_id_read ON messages(user_id, is_read) WHERE is_read = false"
    ["logs.idx_logs_created_at"]="INDEX idx_logs_timestamp ON logs(timestamp DESC)"
    ["logs.idx_logs_level"]="INDEX idx_logs_level ON logs(level)"
    ["urls.idx_urls_user_id"]="INDEX idx_urls_user_id ON urls(user_id)"
    ["urls.idx_urls_user_id_deleted"]="INDEX idx_urls_user_id_deleted ON urls(user_id, is_deleted)"
    ["urls.idx_urls_updated_at"]="INDEX idx_urls_updated_at ON urls(updated_at)"
)

# 获取所有现有索引
echo "📊 当前索引列表："
echo ""

$PSQL_CMD -U postgres -d "$DB_NAME" <<EOF
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('users', 'notes', 'folders', 'messages', 'logs', 'urls')
ORDER BY tablename, indexname;
EOF

echo ""
echo "🔍 检查缺失的索引..."
echo ""

# 检查每个必需的索引
MISSING_COUNT=0
for key in "${!REQUIRED_INDEXES[@]}"; do
    table=$(echo "$key" | cut -d'.' -f1)
    index=$(echo "$key" | cut -d'.' -f2)
    
    exists=$($PSQL_CMD -U postgres -d "$DB_NAME" -t -c "
        SELECT COUNT(*) 
        FROM pg_indexes 
        WHERE schemaname = 'public' 
          AND tablename = '$table' 
          AND indexname = '$index';
    " | tr -d ' ')
    
    if [ "$exists" = "0" ]; then
        echo "❌ 缺失: $table.$index"
        MISSING_COUNT=$((MISSING_COUNT + 1))
    else
        echo "✅ 存在: $table.$index"
    fi
done

echo ""
if [ $MISSING_COUNT -eq 0 ]; then
    echo "✨ 所有必需的索引都已创建！"
else
    echo "⚠️  发现 $MISSING_COUNT 个缺失的索引"
    echo ""
    echo "请执行以下命令创建缺失的索引："
    echo "  bash scripts/apply-indexes.sh"
fi

