#!/bin/bash

# 列出所有数据库
# 使用方法：bash scripts/list-databases.sh

echo "📋 列出所有数据库..."
echo ""

# 检查 psql
if [ -f "/www/server/pgsql/bin/psql" ]; then
    PSQL="/www/server/pgsql/bin/psql"
elif command -v psql >/dev/null 2>&1; then
    PSQL="psql"
else
    echo "❌ 错误: 未找到 psql 命令"
    exit 1
fi

# 使用 TCP/IP 连接
PSQL_CMD="$PSQL -h 127.0.0.1 -p 5432"

echo "可用的数据库："
$PSQL_CMD -U postgres -l

echo ""
echo "📝 提示：如果看到 'piccco' 数据库，请检查："
echo "   1. .env 文件中的 DB_NAME 配置"
echo "   2. 数据库名称是否大小写敏感"

