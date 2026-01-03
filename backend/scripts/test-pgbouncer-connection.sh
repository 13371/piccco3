#!/bin/bash

# 测试 PgBouncer 连接脚本
# 使用方法：bash scripts/test-pgbouncer-connection.sh

echo "🔍 测试 PgBouncer 连接..."
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

# 设置密码环境变量
if [ -n "$DB_PASSWORD" ]; then
    export PGPASSWORD="$DB_PASSWORD"
fi

echo "配置信息："
echo "  DB_NAME: $DB_NAME"
echo "  DB_USER: $DB_USER"
echo "  PgBouncer 端口: 6432"
echo ""

# 1. 测试应用用户连接
echo "1. 测试应用用户连接（通过 PgBouncer）..."
if $PSQL -h 127.0.0.1 -p 6432 -U "$DB_USER" -d "$DB_NAME" -c "SELECT version();" >/dev/null 2>&1; then
    echo "✅ 应用用户连接成功"
    $PSQL -h 127.0.0.1 -p 6432 -U "$DB_USER" -d "$DB_NAME" -c "SELECT version();" 2>&1 | head -3
else
    echo "❌ 应用用户连接失败"
    echo ""
    echo "可能的原因："
    echo "  1. 用户认证文件配置不正确"
    echo "  2. 密码不匹配"
    echo ""
    echo "请检查："
    echo "  sudo cat /etc/pgbouncer/userlist.txt"
    echo ""
    echo "手动测试（需要输入密码）："
    echo "  $PSQL -h 127.0.0.1 -p 6432 -U $DB_USER -d $DB_NAME -c 'SELECT version();'"
fi

echo ""

# 2. 测试管理连接
echo "2. 测试管理连接（查看连接池状态）..."
if $PSQL -h 127.0.0.1 -p 6432 -U postgres -d pgbouncer -c "SHOW POOLS;" >/dev/null 2>&1; then
    echo "✅ 管理连接成功"
    echo ""
    echo "连接池状态："
    $PSQL -h 127.0.0.1 -p 6432 -U postgres -d pgbouncer -c "SHOW POOLS;" 2>&1
else
    echo "⚠️  管理连接失败（可能需要 postgres 用户密码）"
    echo ""
    echo "手动测试："
    echo "  $PSQL -h 127.0.0.1 -p 6432 -U postgres -d pgbouncer -c 'SHOW POOLS;'"
fi

echo ""
echo "✅ 测试完成！"
echo ""
echo "📝 如果连接成功，下一步："
echo "   1. 更新 .env 文件："
echo "      USE_PGBOUNCER=true"
echo "      DB_PORT=6432"
echo ""
echo "   2. 重启应用："
echo "      pm2 restart piccco-backend --update-env"


