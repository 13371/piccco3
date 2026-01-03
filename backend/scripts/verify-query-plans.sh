#!/bin/bash

# 验证查询计划脚本
# 检查关键查询是否使用索引（避免全表扫描）
# 使用方法：bash scripts/verify-query-plans.sh

set -e

echo "🔍 验证查询计划（确保使用索引，避免全表扫描）..."
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

# 1. 检查 notes 表查询
echo "1️⃣ 检查 notes 表查询（user_id + is_deleted + updated_at）..."
$PSQL -h 127.0.0.1 -p 5432 -U postgres -d "$DB_NAME" <<EOF | grep -E "(Index Scan|Seq Scan|Bitmap Index Scan)" || echo "⚠️  未找到索引扫描信息"
EXPLAIN ANALYZE
SELECT * FROM notes 
WHERE user_id = 'test_user_id' 
  AND is_deleted = false
ORDER BY updated_at DESC 
LIMIT 50;
EOF
echo ""

# 2. 检查 users 表查询
echo "2️⃣ 检查 users 表查询（email）..."
$PSQL -h 127.0.0.1 -p 5432 -U postgres -d "$DB_NAME" <<EOF | grep -E "(Index Scan|Seq Scan|Bitmap Index Scan)" || echo "⚠️  未找到索引扫描信息"
EXPLAIN ANALYZE
SELECT * FROM users 
WHERE email = 'test@example.com';
EOF
echo ""

# 3. 检查 folders 表查询
echo "3️⃣ 检查 folders 表查询（user_id + is_deleted）..."
$PSQL -h 127.0.0.1 -p 5432 -U postgres -d "$DB_NAME" <<EOF | grep -E "(Index Scan|Seq Scan|Bitmap Index Scan)" || echo "⚠️  未找到索引扫描信息"
EXPLAIN ANALYZE
SELECT * FROM folders 
WHERE user_id = 'test_user_id' 
  AND is_deleted = false
ORDER BY updated_at DESC;
EOF
echo ""

# 4. 检查 logs 表查询
echo "4️⃣ 检查 logs 表查询（timestamp DESC）..."
$PSQL -h 127.0.0.1 -p 5432 -U postgres -d "$DB_NAME" <<EOF | grep -E "(Index Scan|Seq Scan|Bitmap Index Scan)" || echo "⚠️  未找到索引扫描信息"
EXPLAIN ANALYZE
SELECT * FROM logs 
ORDER BY timestamp DESC 
LIMIT 50;
EOF
echo ""

# 5. 检查 messages 表查询
echo "5️⃣ 检查 messages 表查询（user_id + created_at）..."
$PSQL -h 127.0.0.1 -p 5432 -U postgres -d "$DB_NAME" <<EOF | grep -E "(Index Scan|Seq Scan|Bitmap Index Scan)" || echo "⚠️  未找到索引扫描信息"
EXPLAIN ANALYZE
SELECT * FROM messages 
WHERE user_id = 'test_user_id' 
ORDER BY created_at DESC 
LIMIT 50;
EOF
echo ""

echo "✅ 查询计划验证完成！"
echo ""
echo "📝 说明："
echo "   - Index Scan 或 Bitmap Index Scan = ✅ 使用索引（优秀）"
echo "   - Seq Scan = ❌ 全表扫描（需要优化）"

