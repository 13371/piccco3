#!/bin/bash

# 直接修复 userlist.txt（使用 source .env）
# 使用方法：bash scripts/fix-userlist-direct.sh

set -e

echo "🔧 直接修复 PgBouncer userlist.txt..."
echo ""

# 获取项目目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

if [ ! -f .env ]; then
    echo "❌ 未找到 .env 文件"
    exit 1
fi

# 清理 Windows 行结束符并创建临时 .env 文件
TMP_ENV=$(mktemp)
sed 's/\r$//' .env > "$TMP_ENV"

# 使用 source 读取环境变量（更可靠）
set -a
source "$TMP_ENV"
set +a

# 清理临时文件
rm -f "$TMP_ENV"

DB_USER=${DB_USER:-piccco_user}
DB_PASSWORD=${DB_PASSWORD:-}

if [ -z "$DB_PASSWORD" ]; then
    echo "❌ 错误: DB_PASSWORD 未设置"
    exit 1
fi

# 清理变量（去除引号和空格）
DB_USER=$(echo "$DB_USER" | tr -d ' ' | tr -d '"' | tr -d "'")
DB_PASSWORD=$(echo "$DB_PASSWORD" | tr -d ' ' | tr -d '"' | tr -d "'")

echo "配置信息："
echo "  DB_USER: [$DB_USER]"
echo "  DB_PASSWORD 长度: ${#DB_PASSWORD}"
echo ""

# 生成 MD5 哈希
MD5_HASH=$(echo -n "$DB_PASSWORD$DB_USER" | md5sum | awk '{print "md5"$1}')
echo "  MD5_HASH: $MD5_HASH"
echo ""

# 备份
if [ -f "/etc/pgbouncer/userlist.txt" ]; then
    sudo cp /etc/pgbouncer/userlist.txt /etc/pgbouncer/userlist.txt.backup.$(date +%Y%m%d_%H%M%S)
    echo "✅ 已备份现有文件"
fi

# 创建临时文件（使用 printf，确保变量正确）
TMP_FILE=$(mktemp)

# 验证变量不为空
if [ -z "$DB_USER" ] || [ "$DB_USER" = "" ]; then
    echo "❌ 错误: DB_USER 为空"
    echo "请检查 .env 文件中的 DB_USER 设置"
    exit 1
fi

printf '"%s" "%s"\n' "$DB_USER" "$MD5_HASH" > "$TMP_FILE"
printf '"%s" "%s"\n' "postgres" "md5e8a48653851e28c69d0506508fb27fc5" >> "$TMP_FILE"

# 验证临时文件内容
echo "临时文件内容："
cat "$TMP_FILE"
echo ""

# 检查第一行是否包含用户名
if grep -q "^\"$DB_USER\"" "$TMP_FILE"; then
    echo "✅ 临时文件验证通过"
else
    echo "❌ 临时文件验证失败：用户名不匹配"
    echo "请检查变量读取"
    exit 1
fi

# 复制到目标位置
sudo cp "$TMP_FILE" /etc/pgbouncer/userlist.txt
sudo chmod 644 /etc/pgbouncer/userlist.txt
rm -f "$TMP_FILE"

echo "✅ 用户认证文件已创建"
echo ""
echo "最终文件内容："
sudo cat /etc/pgbouncer/userlist.txt
echo ""

# 重启 PgBouncer
echo "重启 PgBouncer..."
sudo systemctl restart pgbouncer
sleep 2

if systemctl is-active --quiet pgbouncer; then
    echo "✅ PgBouncer 重启成功"
else
    echo "❌ PgBouncer 重启失败"
    sudo journalctl -u pgbouncer -n 10 --no-pager
    exit 1
fi

# 测试连接
echo ""
echo "测试连接..."
if [ -f "/www/server/pgsql/bin/psql" ]; then
    PSQL="/www/server/pgsql/bin/psql"
else
    PSQL="psql"
fi

export PGPASSWORD="$DB_PASSWORD"
if $PSQL -h 127.0.0.1 -p 6432 -U "$DB_USER" -d piccco -c "SELECT version();" >/dev/null 2>&1; then
    echo "✅ 连接测试成功！"
    $PSQL -h 127.0.0.1 -p 6432 -U "$DB_USER" -d piccco -c "SELECT version();" 2>&1 | head -3
else
    echo "❌ 连接测试失败"
    echo ""
    echo "请检查："
    echo "  1. PostgreSQL 用户密码是否正确"
    echo "  2. 可能需要重置密码："
    echo "     $PSQL -h 127.0.0.1 -p 5432 -U postgres -d postgres -c \"ALTER USER $DB_USER WITH PASSWORD '$DB_PASSWORD';\""
    echo ""
    echo "然后重新运行此脚本"
fi

