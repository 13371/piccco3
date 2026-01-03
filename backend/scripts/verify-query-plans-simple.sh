#!/bin/bash

# 简化版查询计划验证脚本
# 使用方法：bash scripts/verify-query-plans-simple.sh

set -e

echo "🔍 验证查询计划（简化版）..."
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

echo "📋 数据库: $DB_NAME"
echo ""

# 验证函数
check_query() {
    local name=$1
    local sql=$2
    
    echo "检查: $name"
    result=$($PSQL -h 127.0.0.1 -p 5432 -U postgres -d "$DB_NAME" -c "$sql" 2>&1)
    
    if echo "$result" | grep -qE "Index Scan using|Bitmap Index Scan"; then
        scan_type=$(echo "$result" | grep -E "Index Scan using|Bitmap Index Scan" | head -1 | sed 's/^[[:space:]]*//')
        echo "  ✅ $scan_type"
        echo "  ✅ 使用索引扫描（优秀）"
    elif echo "$result" | grep -q "Seq Scan"; then
        echo "  ❌ 全表扫描（需要优化）"
    else
        echo "  ⚠️  无法确定扫描类型"
        echo "$result" | head -3 | sed 's/^/    /'
    fi
    echo ""
}

# 1. notes 表
check_query "notes 表 (user_id + is_deleted + updated_at)" \
    "EXPLAIN ANALYZE SELECT * FROM notes WHERE user_id = 'test_user_id' AND is_deleted = false ORDER BY updated_at DESC LIMIT 50;"

# 2. users 表
check_query "users 表 (email)" \
    "EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'test@example.com';"

# 3. folders 表
check_query "folders 表 (user_id + is_deleted)" \
    "EXPLAIN ANALYZE SELECT * FROM folders WHERE user_id = 'test_user_id' AND is_deleted = false ORDER BY updated_at DESC;"

# 4. logs 表
check_query "logs 表 (timestamp DESC)" \
    "EXPLAIN ANALYZE SELECT * FROM logs ORDER BY timestamp DESC LIMIT 50;"

# 5. messages 表
check_query "messages 表 (user_id + created_at)" \
    "EXPLAIN ANALYZE SELECT * FROM messages WHERE user_id = 'test_user_id' ORDER BY created_at DESC LIMIT 50;"

echo "✅ 查询计划验证完成！"
echo ""
echo "📝 说明："
echo "   - Index Scan 或 Bitmap Index Scan = ✅ 使用索引（优秀）"
echo "   - Seq Scan = ❌ 全表扫描（需要优化）"

