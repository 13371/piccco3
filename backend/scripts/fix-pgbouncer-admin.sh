#!/bin/bash

# 修复 PgBouncer 管理界面访问
# 使用方法：bash scripts/fix-pgbouncer-admin.sh

set -e

echo "🔧 修复 PgBouncer 管理界面访问..."
echo ""

# 检查 psql
if [ -f "/www/server/pgsql/bin/psql" ]; then
    PSQL="/www/server/pgsql/bin/psql"
else
    PSQL="psql"
fi

# 1. 检查当前 userlist.txt
echo "1. 检查当前 userlist.txt..."
if [ -f "/etc/pgbouncer/userlist.txt" ]; then
    echo "当前内容："
    sudo cat /etc/pgbouncer/userlist.txt
    echo ""
else
    echo "❌ 未找到 userlist.txt"
    exit 1
fi

# 2. 获取 postgres 用户的密码哈希
echo "2. 获取 postgres 用户的密码哈希..."
echo "请输入 postgres 用户的密码（用于生成 MD5 哈希）："
read -s POSTGRES_PASSWORD

if [ -z "$POSTGRES_PASSWORD" ]; then
    echo "❌ 密码不能为空"
    exit 1
fi

# 生成 MD5 哈希
POSTGRES_MD5=$(echo -n "$POSTGRES_PASSWORD"postgres | md5sum | awk '{print "md5"$1}')
echo "生成的 MD5 哈希: $POSTGRES_MD5"
echo ""

# 3. 读取应用用户配置
echo "3. 读取应用用户配置..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

if [ -f .env ]; then
    TMP_ENV=$(mktemp)
    sed 's/\r$//' .env > "$TMP_ENV"
    set -a
    source "$TMP_ENV"
    set +a
    rm -f "$TMP_ENV"
    
    DB_USER=${DB_USER:-piccco_user}
    DB_PASSWORD=${DB_PASSWORD:-}
    
    if [ -z "$DB_PASSWORD" ]; then
        echo "❌ 无法读取 DB_PASSWORD"
        exit 1
    fi
    
    # 生成应用用户的 MD5 哈希
    APP_MD5=$(echo -n "$DB_PASSWORD$DB_USER" | md5sum | awk '{print "md5"$1}')
    
    echo "应用用户: $DB_USER"
    echo "应用用户 MD5: $APP_MD5"
    echo ""
else
    echo "❌ 未找到 .env 文件"
    exit 1
fi

# 4. 备份并更新 userlist.txt
echo "4. 更新 userlist.txt..."
sudo cp /etc/pgbouncer/userlist.txt /etc/pgbouncer/userlist.txt.backup.$(date +%Y%m%d_%H%M%S)

# 创建新的 userlist.txt
TMP_FILE=$(mktemp)
printf '"%s" "%s"\n' "$DB_USER" "$APP_MD5" > "$TMP_FILE"
printf '"%s" "%s"\n' "postgres" "$POSTGRES_MD5" >> "$TMP_FILE"

# 验证
echo "新文件内容："
cat "$TMP_FILE"
echo ""

# 复制到目标位置
sudo cp "$TMP_FILE" /etc/pgbouncer/userlist.txt
sudo chmod 644 /etc/pgbouncer/userlist.txt
rm -f "$TMP_FILE"

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

# 6. 测试管理界面连接
echo ""
echo "6. 测试管理界面连接..."
export PGPASSWORD="$POSTGRES_PASSWORD"
if $PSQL -h 127.0.0.1 -p 6432 -U postgres -d pgbouncer -c "SHOW POOLS;" >/dev/null 2>&1; then
    echo "✅ 管理界面连接成功！"
    echo ""
    echo "连接池信息："
    $PSQL -h 127.0.0.1 -p 6432 -U postgres -d pgbouncer -c "SHOW POOLS;" 2>&1 | head -10
else
    echo "❌ 管理界面连接失败"
    echo ""
    echo "可能的原因："
    echo "  1. postgres 用户密码不正确"
    echo "  2. pgbouncer.ini 中 admin_users 配置不正确"
    echo ""
    echo "可以检查 pgbouncer.ini:"
    echo "  sudo grep admin_users /etc/pgbouncer/pgbouncer.ini"
fi

echo ""
echo "✅ 修复完成！"

