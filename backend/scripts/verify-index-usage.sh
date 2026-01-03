#!/bin/bash

# 验证索引使用情况（更详细的检查）
# 使用方法：bash scripts/verify-index-usage.sh

echo "🔍 详细验证索引使用情况..."
echo ""

# 检查 psql
if [ -f "/www/server/pgsql/bin/psql" ]; then
    PSQL="/www/server/pgsql/bin/psql"
else
    PSQL="psql"
fi

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
else
    echo "❌ 未找到 .env 文件"
    exit 1
fi

echo "检查数据库: $DB_NAME"
echo ""

# 1. 检查用户表查询
echo "1. 用户表查询（按 email）..."
QUERY_PLAN=$($PSQL -h 127.0.0.1 -p 5432 -U postgres -d "$DB_NAME" -c "
EXPLAIN (ANALYZE, BUFFERS, VERBOSE) 
SELECT * FROM users WHERE email = 'test@example.com' LIMIT 1;
" 2>&1)

if echo "$QUERY_PLAN" | grep -qi "Index Scan\|Bitmap Index Scan"; then
    echo "  ✅ 使用索引扫描"
    echo "$QUERY_PLAN" | grep -i "Index\|Bitmap" | head -2
elif echo "$QUERY_PLAN" | grep -qi "Seq Scan"; then
    echo "  ⚠️  使用顺序扫描（可能因为数据量小或统计信息过期）"
    echo "$QUERY_PLAN" | grep -i "Seq Scan" | head -1
else
    echo "  ℹ️  查询计划："
    echo "$QUERY_PLAN" | head -5
fi
echo ""

# 2. 检查笔记表查询
echo "2. 笔记表查询（按 user_id 和 is_deleted）..."
QUERY_PLAN=$($PSQL -h 127.0.0.1 -p 5432 -U postgres -d "$DB_NAME" -c "
EXPLAIN (ANALYZE, BUFFERS, VERBOSE) 
SELECT * FROM notes WHERE user_id = 1 AND is_deleted = false LIMIT 10;
" 2>&1)

if echo "$QUERY_PLAN" | grep -qi "Index Scan\|Bitmap Index Scan"; then
    echo "  ✅ 使用索引扫描"
    echo "$QUERY_PLAN" | grep -i "Index\|Bitmap" | head -2
elif echo "$QUERY_PLAN" | grep -qi "Seq Scan"; then
    echo "  ⚠️  使用顺序扫描（可能因为数据量小）"
    echo "$QUERY_PLAN" | grep -i "Seq Scan" | head -1
else
    echo "  ℹ️  查询计划："
    echo "$QUERY_PLAN" | head -5
fi
echo ""

# 3. 检查文件夹表查询
echo "3. 文件夹表查询（按 user_id 和 is_deleted）..."
QUERY_PLAN=$($PSQL -h 127.0.0.1 -p 5432 -U postgres -d "$DB_NAME" -c "
EXPLAIN (ANALYZE, BUFFERS, VERBOSE) 
SELECT * FROM folders WHERE user_id = 1 AND is_deleted = false LIMIT 10;
" 2>&1)

if echo "$QUERY_PLAN" | grep -qi "Index Scan\|Bitmap Index Scan"; then
    echo "  ✅ 使用索引扫描"
    echo "$QUERY_PLAN" | grep -i "Index\|Bitmap" | head -2
elif echo "$QUERY_PLAN" | grep -qi "Seq Scan"; then
    echo "  ⚠️  使用顺序扫描（可能因为数据量小）"
    echo "$QUERY_PLAN" | grep -i "Seq Scan" | head -1
else
    echo "  ℹ️  查询计划："
    echo "$QUERY_PLAN" | head -5
fi
echo ""

# 4. 检查索引统计信息
echo "4. 检查索引使用统计..."
echo "  索引扫描次数（前 10 个）："
$PSQL -h 127.0.0.1 -p 5432 -U postgres -d "$DB_NAME" -c "
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC
LIMIT 10;
" 2>&1 | head -12
echo ""

# 5. 检查表统计信息
echo "5. 检查表统计信息..."
echo "  表大小和行数："
$PSQL -h 127.0.0.1 -p 5432 -U postgres -d "$DB_NAME" -c "
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
    n_live_tup AS row_count,
    last_vacuum,
    last_analyze
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY tablename;
" 2>&1 | head -15
echo ""

# 6. 检查未使用的索引
echo "6. 检查未使用的索引（扫描次数为 0）..."
UNUSED_COUNT=$($PSQL -h 127.0.0.1 -p 5432 -U postgres -d "$DB_NAME" -t -c "
SELECT COUNT(*) 
FROM pg_stat_user_indexes 
WHERE schemaname = 'public' 
  AND idx_scan = 0
  AND indexname NOT LIKE 'pg_toast%';
" 2>&1 | tr -d ' ')

if [ "$UNUSED_COUNT" -gt "0" ]; then
    echo "  ⚠️  发现 $UNUSED_COUNT 个未使用的索引（可能是数据量小或新创建的索引）"
    echo "  未使用的索引列表："
    $PSQL -h 127.0.0.1 -p 5432 -U postgres -d "$DB_NAME" -c "
    SELECT 
        tablename,
        indexname
    FROM pg_stat_user_indexes
    WHERE schemaname = 'public'
      AND idx_scan = 0
      AND indexname NOT LIKE 'pg_toast%'
    ORDER BY tablename, indexname;
    " 2>&1 | head -15
else
    echo "  ✅ 所有索引都有使用记录"
fi
echo ""

# 总结
echo "=========================================="
echo "📊 索引使用情况总结"
echo "=========================================="
echo ""
echo "说明："
echo "  - 如果数据量很小（< 1000 行），PostgreSQL 可能选择顺序扫描"
echo "  - 这是正常的优化行为，因为顺序扫描在小数据量时更快"
echo "  - 当数据量增长后，PostgreSQL 会自动切换到索引扫描"
echo ""
echo "建议："
echo "  - 定期运行 ANALYZE 更新统计信息"
echo "  - 监控慢查询日志，查看实际生产查询的索引使用情况"
echo "  - 当数据量增长后，索引会自动生效"
echo ""
echo "✅ 索引验证完成！"


