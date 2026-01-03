#!/bin/bash

# 执行 VACUUM ANALYZE 脚本
# 使用方法：bash scripts/vacuum-analyze.sh

set -e

echo "🧹 执行 VACUUM ANALYZE（清理垃圾数据并更新统计信息）..."
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

# VACUUM ANALYZE 不能在事务块中运行，所以需要分别执行
echo "清理 users 表..."
$PSQL -h 127.0.0.1 -p 5432 -U postgres -d "$DB_NAME" -c "VACUUM ANALYZE users;" 2>&1
if [ $? -ne 0 ]; then
    echo "⚠️  users 表 VACUUM 失败，继续执行其他表..."
fi

echo "清理 notes 表..."
$PSQL -h 127.0.0.1 -p 5432 -U postgres -d "$DB_NAME" -c "VACUUM ANALYZE notes;" 2>&1
if [ $? -ne 0 ]; then
    echo "⚠️  notes 表 VACUUM 失败，继续执行其他表..."
fi

echo "清理 folders 表..."
$PSQL -h 127.0.0.1 -p 5432 -U postgres -d "$DB_NAME" -c "VACUUM ANALYZE folders;" 2>&1
if [ $? -ne 0 ]; then
    echo "⚠️  folders 表 VACUUM 失败，继续执行其他表..."
fi

echo "清理 messages 表..."
$PSQL -h 127.0.0.1 -p 5432 -U postgres -d "$DB_NAME" -c "VACUUM ANALYZE messages;" 2>&1
if [ $? -ne 0 ]; then
    echo "⚠️  messages 表 VACUUM 失败，继续执行其他表..."
fi

echo "清理 logs 表..."
$PSQL -h 127.0.0.1 -p 5432 -U postgres -d "$DB_NAME" -c "VACUUM ANALYZE logs;" 2>&1
if [ $? -ne 0 ]; then
    echo "⚠️  logs 表 VACUUM 失败，继续执行其他表..."
fi

echo "清理 urls 表..."
$PSQL -h 127.0.0.1 -p 5432 -U postgres -d "$DB_NAME" -c "VACUUM ANALYZE urls;" 2>&1
if [ $? -ne 0 ]; then
    echo "⚠️  urls 表 VACUUM 失败，继续执行其他表..."
fi

echo ""
echo "✅ VACUUM ANALYZE 完成！"
echo ""
echo "📊 表统计信息已更新，查询优化器现在可以使用最新的统计信息来优化查询计划。"

