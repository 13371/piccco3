#!/bin/bash

# 数据库优化脚本
# 功能：
# 1. 应用索引优化
# 2. 分析表统计信息
# 3. 检查全表扫描
# 4. 执行 VACUUM ANALYZE

set -e

echo "🔧 开始数据库优化..."
echo ""

# 获取项目目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# 读取数据库配置
cd "$PROJECT_DIR"
if [ -f .env ]; then
    DB_NAME=$(grep "^DB_NAME=" .env | cut -d'=' -f2 | tr -d ' ' | tr -d '"' | tr -d "'")
    DB_USER=$(grep "^DB_USER=" .env | cut -d'=' -f2 | tr -d ' ' | tr -d '"' | tr -d "'")
    DB_PASSWORD=$(grep "^DB_PASSWORD=" .env | cut -d'=' -f2 | tr -d ' ' | tr -d '"' | tr -d "'")
else
    DB_NAME="piccco"
    DB_USER="piccco_user"
    DB_PASSWORD=""
fi

DB_NAME=${DB_NAME:-piccco}
DB_USER=${DB_USER:-piccco_user}

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

# 设置密码（如果需要）
if [ -n "$DB_PASSWORD" ]; then
    export PGPASSWORD="$DB_PASSWORD"
fi

echo "📋 数据库: $DB_NAME"
echo "📋 用户: $DB_USER"
echo ""

# 1. 应用索引优化（需要使用 postgres 超级用户）
echo "1️⃣ 应用索引优化..."
if [ -f "$PROJECT_DIR/migrations/003_optimize_indexes.sql" ]; then
    # 使用 postgres 超级用户执行索引创建
    if [ -f "/www/server/pgsql/bin/psql" ]; then
        POSTGRES_PSQL="/www/server/pgsql/bin/psql"
    else
        POSTGRES_PSQL="psql"
    fi
    $POSTGRES_PSQL -h 127.0.0.1 -p 5432 -U postgres -d "$DB_NAME" -f "$PROJECT_DIR/migrations/003_optimize_indexes.sql"
    echo "✅ 索引优化完成"
else
    echo "⚠️  未找到索引优化脚本: migrations/003_optimize_indexes.sql"
fi

echo ""

# 2. 分析表统计信息
echo "2️⃣ 更新表统计信息..."
$PSQL_CMD -U "$DB_USER" -d "$DB_NAME" <<EOF
ANALYZE users;
ANALYZE folders;
ANALYZE notes;
ANALYZE urls;
ANALYZE messages;
ANALYZE logs;
ANALYZE user_settings;
EOF
echo "✅ 统计信息更新完成"

echo ""

# 3. 检查全表扫描
echo "3️⃣ 检查全表扫描..."
echo "检查 notes 表..."
$PSQL_CMD -U "$DB_USER" -d "$DB_NAME" <<EOF
EXPLAIN ANALYZE
SELECT * FROM notes 
WHERE user_id = 'test_user_id' 
ORDER BY updated_at DESC 
LIMIT 50;
EOF

echo ""
echo "检查 users 表..."
$PSQL_CMD -U "$DB_USER" -d "$DB_NAME" <<EOF
EXPLAIN ANALYZE
SELECT * FROM users 
WHERE email = 'test@example.com';
EOF

echo ""
echo "检查 logs 表..."
$PSQL_CMD -U "$DB_USER" -d "$DB_NAME" <<EOF
EXPLAIN ANALYZE
SELECT * FROM logs 
ORDER BY timestamp DESC 
LIMIT 50;
EOF

echo ""

# 4. 执行 VACUUM ANALYZE
echo "4️⃣ 执行 VACUUM ANALYZE（清理垃圾数据）..."
$PSQL_CMD -U "$DB_USER" -d "$DB_NAME" <<EOF
VACUUM ANALYZE users;
VACUUM ANALYZE folders;
VACUUM ANALYZE notes;
VACUUM ANALYZE urls;
VACUUM ANALYZE messages;
VACUUM ANALYZE logs;
VACUUM ANALYZE user_settings;
EOF
echo "✅ VACUUM ANALYZE 完成"

echo ""
echo "✨ 数据库优化完成！"
echo ""
echo "📝 建议："
echo "   1. 定期执行此脚本（建议每周一次）"
echo "   2. 监控慢查询日志"
echo "   3. 检查索引使用情况"

