#!/bin/bash

# 应用索引优化脚本（使用 postgres 超级用户）
# 使用方法：bash scripts/apply-indexes.sh

set -e

echo "🔧 应用数据库索引优化..."
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
echo "📋 使用 postgres 超级用户执行"
echo ""

# 检查索引优化脚本
if [ ! -f "$PROJECT_DIR/migrations/003_optimize_indexes.sql" ]; then
    echo "❌ 未找到索引优化脚本: migrations/003_optimize_indexes.sql"
    exit 1
fi

# 验证数据库连接
echo "验证数据库连接..."
if ! $PSQL -h 127.0.0.1 -p 5432 -U postgres -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
    echo "❌ 错误: 无法连接到数据库 '$DB_NAME'"
    echo ""
    echo "请先运行测试脚本检查连接："
    echo "  bash scripts/test-db-connection.sh"
    exit 1
fi

# 使用 postgres 超级用户执行
echo "执行索引优化脚本..."
if $PSQL -h 127.0.0.1 -p 5432 -U postgres -d "$DB_NAME" -f "$PROJECT_DIR/migrations/003_optimize_indexes.sql" 2>&1; then
    echo ""
    echo "✅ 索引优化完成！"
    echo ""
    echo "🔍 验证索引..."
    
    # 验证索引是否创建成功（使用 -c 参数避免 heredoc 问题）
    $PSQL -h 127.0.0.1 -p 5432 -U postgres -d "$DB_NAME" -c "SELECT schemaname, tablename, indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename IN ('users', 'notes', 'folders', 'messages', 'logs', 'urls') ORDER BY tablename, indexname;"
    
    echo ""
    echo "✨ 索引优化完成！"
else
    echo ""
    echo "❌ 索引优化失败"
    exit 1
fi

