#!/bin/bash

# 启用 PgBouncer 并更新应用配置
# 使用方法：bash scripts/enable-pgbouncer.sh

set -e

echo "🔧 启用 PgBouncer 并更新应用配置..."
echo ""

# 获取项目目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

if [ ! -f .env ]; then
    echo "❌ 未找到 .env 文件"
    exit 1
fi

# 备份 .env 文件
if [ ! -f .env.backup ]; then
    cp .env .env.backup
    echo "✅ 已备份 .env 文件为 .env.backup"
fi

# 清理 Windows 行结束符
TMP_ENV=$(mktemp)
sed 's/\r$//' .env > "$TMP_ENV"

# 检查是否已启用 PgBouncer
if grep -q "^USE_PGBOUNCER=true" "$TMP_ENV"; then
    echo "✅ PgBouncer 已启用"
else
    echo "📝 更新 .env 文件以启用 PgBouncer..."
    
    # 添加或更新 USE_PGBOUNCER
    if grep -q "^USE_PGBOUNCER=" "$TMP_ENV"; then
        sed -i 's/^USE_PGBOUNCER=.*/USE_PGBOUNCER=true/' "$TMP_ENV"
    else
        echo "" >> "$TMP_ENV"
        echo "# PgBouncer 配置" >> "$TMP_ENV"
        echo "USE_PGBOUNCER=true" >> "$TMP_ENV"
    fi
    
    # 添加或更新 DB_PORT
    if grep -q "^DB_PORT=" "$TMP_ENV"; then
        sed -i 's/^DB_PORT=.*/DB_PORT=6432/' "$TMP_ENV"
    else
        echo "DB_PORT=6432" >> "$TMP_ENV"
    fi
    
    # 复制回 .env（保持 Unix 行结束符）
    cp "$TMP_ENV" .env
    echo "✅ .env 文件已更新"
fi

rm -f "$TMP_ENV"

# 显示配置
echo ""
echo "当前数据库配置："
grep -E "^(USE_PGBOUNCER|DB_PORT|DB_HOST|DB_NAME|DB_USER)=" .env | sed 's/\(PASSWORD=\).*/\1***/' || true
echo ""

# 测试 PgBouncer 连接
echo "测试 PgBouncer 连接..."
if [ -f "/www/server/pgsql/bin/psql" ]; then
    PSQL="/www/server/pgsql/bin/psql"
else
    PSQL="psql"
fi

# 读取密码
TMP_ENV2=$(mktemp)
sed 's/\r$//' .env > "$TMP_ENV2"
set -a
source "$TMP_ENV2"
set +a
rm -f "$TMP_ENV2"

export PGPASSWORD="$DB_PASSWORD"
if $PSQL -h 127.0.0.1 -p 6432 -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
    echo "✅ PgBouncer 连接测试成功"
else
    echo "❌ PgBouncer 连接测试失败"
    echo "请先运行: bash scripts/fix-userlist-direct.sh"
    exit 1
fi

# 重启应用
echo ""
echo "重启应用..."
if command -v pm2 >/dev/null 2>&1; then
    echo "使用 PM2 重启..."
    pm2 restart piccco-backend --update-env || pm2 restart all --update-env
    sleep 2
    pm2 list
    echo ""
    echo "✅ 应用已重启"
    echo ""
    echo "查看日志: pm2 logs piccco-backend"
else
    echo "⚠️  未找到 PM2，请手动重启应用"
    echo ""
    echo "如果使用 systemd:"
    echo "  sudo systemctl restart piccco-backend"
    echo ""
    echo "如果使用其他方式，请手动重启应用进程"
fi

echo ""
echo "✅ PgBouncer 配置完成！"
echo ""
echo "📝 验证步骤："
echo "   1. 检查应用日志，确认数据库连接正常"
echo "   2. 访问 /api/health 端点，检查数据库连接状态"
echo "   3. 监控 PgBouncer 连接池: $PSQL -h 127.0.0.1 -p 6432 -U postgres -d pgbouncer -c 'SHOW POOLS;'"

