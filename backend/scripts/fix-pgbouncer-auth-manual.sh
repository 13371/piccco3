#!/bin/bash

# 手动修复 PgBouncer 用户认证文件（简化版）
# 使用方法：bash scripts/fix-pgbouncer-auth-manual.sh

set -e

echo "🔧 手动修复 PgBouncer 用户认证..."
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

echo "配置信息："
echo "  DB_NAME: $DB_NAME"
echo "  DB_USER: $DB_USER"
echo ""

# 验证变量
if [ -z "$DB_USER" ] || [ "$DB_USER" = "" ]; then
    echo "❌ 错误: DB_USER 变量为空"
    echo "   请检查 .env 文件中的 DB_USER 配置"
    exit 1
fi

# 生成 MD5 哈希
MD5_HASH=$(echo -n "$DB_PASSWORD$DB_USER" | md5sum | awk '{print "md5"$1}')
echo "生成的 MD5 哈希: $MD5_HASH"
echo ""

# 创建临时文件
TEMP_FILE=$(mktemp)
echo "创建临时文件: $TEMP_FILE"

# 写入内容（使用 printf 确保变量正确）
printf '"%s" "%s"\n' "$DB_USER" "$MD5_HASH" > "$TEMP_FILE"
printf '"%s" "%s"\n' "postgres" "md5e8a48653851e28c69d0506508fb27fc5" >> "$TEMP_FILE"

# 验证临时文件内容
echo ""
echo "临时文件内容："
cat "$TEMP_FILE"
echo ""

# 检查第一行是否包含用户名
if grep -q "^\"$DB_USER\"" "$TEMP_FILE"; then
    echo "✅ 临时文件内容正确"
else
    echo "❌ 临时文件内容错误"
    echo "第一行应该是: \"$DB_USER\" \"$MD5_HASH\""
    rm -f "$TEMP_FILE"
    exit 1
fi

# 备份现有文件
if [ -f "/etc/pgbouncer/userlist.txt" ]; then
    echo "备份现有文件..."
    sudo cp /etc/pgbouncer/userlist.txt /etc/pgbouncer/userlist.txt.backup.$(date +%Y%m%d_%H%M%S)
fi

# 复制到目标位置
echo "复制到 /etc/pgbouncer/userlist.txt..."
sudo cp "$TEMP_FILE" /etc/pgbouncer/userlist.txt
rm -f "$TEMP_FILE"

# 验证最终文件
echo ""
echo "最终文件内容："
sudo cat /etc/pgbouncer/userlist.txt
echo ""

# 验证第一行
if sudo grep -q "^\"$DB_USER\"" /etc/pgbouncer/userlist.txt; then
    echo "✅ 用户认证文件创建成功"
else
    echo "❌ 用户认证文件创建失败"
    exit 1
fi

# 重启 PgBouncer
echo ""
echo "重启 PgBouncer..."
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
fi

# 测试连接
echo ""
echo "测试连接..."
export PGPASSWORD="$DB_PASSWORD"

if /www/server/pgsql/bin/psql -h 127.0.0.1 -p 6432 -U "$DB_USER" -d "$DB_NAME" -c "SELECT version();" >/dev/null 2>&1; then
    echo "✅ 连接测试成功！"
else
    echo "⚠️  连接测试失败，可能需要检查密码"
fi

echo ""
echo "✅ 修复完成！"

