#!/bin/bash

# 修复 PgBouncer 用户认证文件
# 使用方法：bash scripts/fix-pgbouncer-auth.sh

set -e

echo "🔧 修复 PgBouncer 用户认证..."
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
    echo "   请在 .env 文件中设置 DB_PASSWORD"
    exit 1
fi

echo "配置信息："
echo "  DB_NAME: $DB_NAME"
echo "  DB_USER: $DB_USER"
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

# 方法 1: 从 PostgreSQL 获取密码哈希（最可靠）
echo "1. 从 PostgreSQL 获取用户密码哈希..."
export PGPASSWORD="$DB_PASSWORD"

# 获取用户的密码哈希
USER_HASH=$($PSQL -h 127.0.0.1 -p 5432 -U postgres -d postgres -t -c "SELECT rolpassword FROM pg_authid WHERE rolname = '$DB_USER';" 2>/dev/null | tr -d ' ')

if [ -n "$USER_HASH" ] && [ "$USER_HASH" != "" ]; then
    echo "✅ 从 PostgreSQL 获取到密码哈希"
    MD5_HASH="$USER_HASH"
else
    echo "⚠️  无法从 PostgreSQL 获取密码哈希，使用 MD5 生成..."
    # 方法 2: 生成 MD5 哈希
    MD5_HASH=$(echo -n "$DB_PASSWORD$DB_USER" | md5sum | awk '{print "md5"$1}')
    echo "   生成的 MD5 哈希: $MD5_HASH"
fi

# 备份现有文件
if [ -f "/etc/pgbouncer/userlist.txt" ]; then
    echo ""
    echo "2. 备份现有用户认证文件..."
    sudo cp /etc/pgbouncer/userlist.txt /etc/pgbouncer/userlist.txt.backup.$(date +%Y%m%d_%H%M%S)
    echo "✅ 已备份"
fi

# 创建新的用户认证文件
echo ""
echo "3. 创建新的用户认证文件..."

# 获取 postgres 用户的密码哈希（如果需要）
POSTGRES_HASH=$($PSQL -h 127.0.0.1 -p 5432 -U postgres -d postgres -t -c "SELECT rolpassword FROM pg_authid WHERE rolname = 'postgres';" 2>/dev/null | tr -d ' ')

if [ -z "$POSTGRES_HASH" ] || [ "$POSTGRES_HASH" = "" ]; then
    # 如果无法获取，使用默认方式
    POSTGRES_HASH="md5$(echo -n 'postgres' | md5sum | awk '{print $1}')"
fi

# 创建用户列表文件（先创建临时文件，然后复制，确保变量正确）
TEMP_FILE=$(mktemp)
cat > "$TEMP_FILE" <<EOF
"$DB_USER" "$MD5_HASH"
"postgres" "$POSTGRES_HASH"
EOF

# 复制到目标位置
sudo cp "$TEMP_FILE" /etc/pgbouncer/userlist.txt
rm -f "$TEMP_FILE"

echo "✅ 用户认证文件已创建"
echo ""
echo "文件内容："
sudo cat /etc/pgbouncer/userlist.txt
echo ""
echo "验证文件内容（应该包含用户名和哈希）："
echo "  期望格式: \"$DB_USER\" \"$MD5_HASH\""
echo ""

# 重启 PgBouncer
echo "4. 重启 PgBouncer 以应用新配置..."
if command -v systemctl >/dev/null 2>&1; then
    sudo systemctl restart pgbouncer
    sleep 2
    
    if systemctl is-active --quiet pgbouncer; then
        echo "✅ PgBouncer 重启成功"
    else
        echo "❌ PgBouncer 重启失败"
        echo "查看日志：sudo journalctl -u pgbouncer -n 20"
        exit 1
    fi
else
    echo "⚠️  systemctl 不可用，请手动重启 PgBouncer"
    echo "   sudo pkill pgbouncer"
    echo "   sudo pgbouncer -d /etc/pgbouncer/pgbouncer.ini"
fi

# 测试连接
echo ""
echo "5. 测试连接..."
export PGPASSWORD="$DB_PASSWORD"

if $PSQL -h 127.0.0.1 -p 6432 -U "$DB_USER" -d "$DB_NAME" -c "SELECT version();" >/dev/null 2>&1; then
    echo "✅ 连接测试成功！"
    $PSQL -h 127.0.0.1 -p 6432 -U "$DB_USER" -d "$DB_NAME" -c "SELECT version();" 2>&1 | head -3
else
    echo "❌ 连接测试失败"
    echo ""
    echo "可能的原因："
    echo "  1. 密码哈希不匹配"
    echo "  2. PostgreSQL 用户密码与 .env 中的不一致"
    echo ""
    echo "请检查："
    echo "  1. .env 文件中的 DB_PASSWORD 是否正确"
    echo "  2. PostgreSQL 中 piccco_user 的密码是否匹配"
    echo ""
    echo "手动测试："
    echo "  export PGPASSWORD='your_password'"
    echo "  $PSQL -h 127.0.0.1 -p 6432 -U $DB_USER -d $DB_NAME -c 'SELECT version();'"
    exit 1
fi

echo ""
echo "✅ PgBouncer 用户认证修复完成！"

