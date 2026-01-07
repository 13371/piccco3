#!/bin/bash
# 使用 postgres 超级用户执行迁移脚本
# 用于解决权限问题

set -e

echo "=========================================="
echo "使用 postgres 超级用户执行数据库迁移"
echo "=========================================="
echo ""

# 从 .env 文件读取数据库配置
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# 默认值
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-piccco}
POSTGRES_USER=${POSTGRES_USER:-postgres}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-${DB_PASSWORD:-}}

if [ -z "$POSTGRES_PASSWORD" ]; then
    echo "错误：未设置 POSTGRES_PASSWORD 环境变量"
    echo "请设置：export POSTGRES_PASSWORD='your_postgres_password'"
    exit 1
fi

echo "使用 postgres 用户连接数据库..."
echo "  主机: $DB_HOST"
echo "  端口: $DB_PORT"
echo "  数据库: $DB_NAME"
echo "  用户: $POSTGRES_USER"
echo ""

# 设置环境变量，让 Node.js 脚本使用 postgres 用户
# 使用 env 命令确保环境变量传递给子进程
env POSTGRES_USER="$POSTGRES_USER" POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
    DB_HOST="$DB_HOST" DB_PORT="$DB_PORT" DB_NAME="$DB_NAME" \
    node scripts/run-migration-005-006.js

