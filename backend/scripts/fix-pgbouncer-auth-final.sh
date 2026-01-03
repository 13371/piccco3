#!/bin/bash

# 最终修复 PgBouncer 认证（测试连接后生成哈希）
# 使用方法：bash scripts/fix-pgbouncer-auth-final.sh

set -e

echo "🔧 最终修复 PgBouncer 用户认证..."
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
    echo "❌ 未找到 .env 文件"
    exit 1
fi

DB_NAME=${DB_NAME:-piccco}
DB_USER=${DB_USER:-piccco_user}

if [ -z "$DB_PASSWORD" ]; then
    echo "❌ 错误: DB_PASSWORD 未设置"
    exit 1
fi

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
echo ""

# 1. 测试直接连接 PostgreSQL（不使用 PgBouncer）
echo "1. 测试直接连接 PostgreSQL（验证密码是否正确）..."
export PGPASSWORD="$DB_PASSWORD"

if $PSQL -h 127.0.0.1 -p 5432 -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
    echo "✅ 直接连接 PostgreSQL 成功，密码正确"
else
    echo "❌ 直接连接 PostgreSQL 失败"
    echo "   请检查 .env 文件中的 DB_PASSWORD 是否正确"
    exit 1
fi

# 2. 生成 MD5 哈希（使用正确的格式：md5(password+username)）
echo ""
echo "2. 生成 MD5 密码哈希..."
MD5_HASH=$(echo -n "$DB_PASSWORD$DB_USER" | md5sum | awk '{print "md5"$1}')
echo "   生成的 MD5 哈希: $MD5_HASH"

# 3. 备份现有文件
echo ""
echo "3. 备份现有用户认证文件..."
if [ -f "/etc/pgbouncer/userlist.txt" ]; then
    sudo cp /etc/pgbouncer/userlist.txt /etc/pgbouncer/userlist.txt.backup.$(date +%Y%m%d_%H%M%S)
    echo "✅ 已备份"
fi

# 4. 创建用户认证文件（使用临时文件避免变量扩展问题）
echo ""
echo "4. 创建用户认证文件..."
TMP_FILE=$(mktemp)
cat > "$TMP_FILE" <<EOF
"$DB_USER" "$MD5_HASH"
"postgres" "md5e8a48653851e28c69d0506508fb27fc5"
EOF
sudo cp "$TMP_FILE" /etc/pgbouncer/userlist.txt
rm -f "$TMP_FILE"

echo "✅ 用户认证文件已创建"
echo ""
echo "文件内容："
sudo cat /etc/pgbouncer/userlist.txt
echo ""

# 5. 重启 PgBouncer
echo "5. 重启 PgBouncer..."
sudo systemctl restart pgbouncer
sleep 2

if systemctl is-active --quiet pgbouncer; then
    echo "✅ PgBouncer 重启成功"
else
    echo "❌ PgBouncer 重启失败"
    sudo journalctl -u pgbouncer -n 10 --no-pager
    exit 1
fi

# 6. 测试连接
echo ""
echo "6. 测试通过 PgBouncer 连接..."
if $PSQL -h 127.0.0.1 -p 6432 -U "$DB_USER" -d "$DB_NAME" -c "SELECT version();" >/dev/null 2>&1; then
    echo "✅ 连接测试成功！"
    echo ""
    $PSQL -h 127.0.0.1 -p 6432 -U "$DB_USER" -d "$DB_NAME" -c "SELECT version();" 2>&1 | head -3
else
    echo "❌ 连接测试失败"
    echo ""
    echo "可能的原因："
    echo "  1. MD5 哈希格式不正确"
    echo "  2. PostgreSQL 用户密码与 .env 中的不一致"
    echo ""
    echo "可以尝试重置 PostgreSQL 用户密码："
    echo "  $PSQL -h 127.0.0.1 -p 5432 -U postgres -d postgres -c \"ALTER USER $DB_USER WITH PASSWORD '$DB_PASSWORD';\""
    echo ""
    echo "然后重新运行此脚本"
    exit 1
fi

echo ""
echo "✅ PgBouncer 用户认证修复完成！"
echo ""
echo "📝 下一步："
echo "   1. 更新 .env 文件："
echo "      USE_PGBOUNCER=true"
echo "      DB_PORT=6432"
echo ""
echo "   2. 重启应用："
echo "      pm2 restart piccco-backend --update-env"


