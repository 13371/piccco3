#!/bin/bash

# 测试数据库连接脚本
# 使用方法：bash scripts/test-db-connection.sh

echo "🔍 测试数据库连接..."
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

echo "配置信息："
echo "  DB_NAME: $DB_NAME"
echo "  DB_USER: $DB_USER"
echo "  PSQL: $PSQL"
echo ""

# 测试连接
echo "1. 测试 PostgreSQL 连接（使用 postgres 用户）..."
if $PSQL -h 127.0.0.1 -p 5432 -U postgres -c "SELECT version();" >/dev/null 2>&1; then
    echo "✅ PostgreSQL 连接成功"
else
    echo "❌ PostgreSQL 连接失败"
    echo "   尝试连接命令："
    echo "   $PSQL -h 127.0.0.1 -p 5432 -U postgres -c 'SELECT version();'"
    exit 1
fi

echo ""
echo "2. 检查数据库是否存在..."
# 获取数据库列表并清理（去除空格）
DB_LIST=$($PSQL -h 127.0.0.1 -p 5432 -U postgres -lqt 2>/dev/null | cut -d \| -f 1 | tr -d ' ' | grep -v "^$" | grep -v "template" | grep -v "^postgres$")

if echo "$DB_LIST" | grep -q "^${DB_NAME}$"; then
    echo "✅ 数据库 '$DB_NAME' 存在"
else
    echo "⚠️  数据库 '$DB_NAME' 在列表中未找到，但尝试直接连接..."
    # 尝试直接连接验证
    if $PSQL -h 127.0.0.1 -p 5432 -U postgres -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
        echo "✅ 数据库 '$DB_NAME' 可以连接（可能名称匹配问题）"
    else
        echo "❌ 数据库 '$DB_NAME' 不存在或无法连接"
        echo ""
        echo "可用的数据库列表："
        echo "$DB_LIST"
        exit 1
    fi
fi

echo ""
echo "3. 测试数据库连接（使用 postgres 用户）..."
if $PSQL -h 127.0.0.1 -p 5432 -U postgres -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
    echo "✅ 数据库 '$DB_NAME' 连接成功"
else
    echo "❌ 数据库 '$DB_NAME' 连接失败"
    exit 1
fi

echo ""
echo "4. 测试应用用户连接..."
if [ -n "$DB_PASSWORD" ]; then
    export PGPASSWORD="$DB_PASSWORD"
fi

if $PSQL -h 127.0.0.1 -p 5432 -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
    echo "✅ 应用用户 '$DB_USER' 连接成功"
else
    echo "⚠️  应用用户 '$DB_USER' 连接失败（可能需要密码或权限）"
fi

echo ""
echo "✅ 数据库连接测试完成！"

