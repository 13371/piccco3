#!/bin/bash

# 快速修复 userlist.txt（使用临时文件）
# 使用方法：bash scripts/quick-fix-userlist.sh

set -e

echo "🔧 快速修复 PgBouncer userlist.txt..."
echo ""

# 读取配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

if [ -f .env ]; then
    DB_USER=$(grep "^DB_USER=" .env | cut -d'=' -f2 | tr -d ' ' | tr -d '"' | tr -d "'")
    DB_PASSWORD=$(grep "^DB_PASSWORD=" .env | cut -d'=' -f2 | tr -d ' ' | tr -d '"' | tr -d "'")
else
    echo "❌ 未找到 .env 文件"
    exit 1
fi

DB_USER=${DB_USER:-piccco_user}

if [ -z "$DB_PASSWORD" ]; then
    echo "❌ 错误: DB_PASSWORD 未设置"
    exit 1
fi

# 生成 MD5 哈希
MD5_HASH=$(echo -n "$DB_PASSWORD$DB_USER" | md5sum | awk '{print "md5"$1}')

echo "配置信息："
echo "  DB_USER: $DB_USER"
echo "  MD5_HASH: $MD5_HASH"
echo ""

# 备份
if [ -f "/etc/pgbouncer/userlist.txt" ]; then
    sudo cp /etc/pgbouncer/userlist.txt /etc/pgbouncer/userlist.txt.backup.$(date +%Y%m%d_%H%M%S)
    echo "✅ 已备份现有文件"
fi

# 创建临时文件（使用 printf 避免变量扩展问题）
TMP_FILE=$(mktemp)
printf '"%s" "%s"\n' "$DB_USER" "$MD5_HASH" > "$TMP_FILE"
printf '"%s" "%s"\n' "postgres" "md5e8a48653851e28c69d0506508fb27fc5" >> "$TMP_FILE"

# 验证临时文件内容
echo "临时文件内容："
cat "$TMP_FILE"
echo ""

# 复制到目标位置
sudo cp "$TMP_FILE" /etc/pgbouncer/userlist.txt
sudo chmod 644 /etc/pgbouncer/userlist.txt
rm -f "$TMP_FILE"

echo "✅ 用户认证文件已创建"
echo ""
echo "文件内容："
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
fi

