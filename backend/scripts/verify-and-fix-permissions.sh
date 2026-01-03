#!/bin/bash

# 验证并修复数据库权限脚本
# 确保所有表和序列都有正确的权限

echo "🔍 检查应用使用的数据库用户..."
echo ""

# 获取数据库配置
cd /www/wwwroot/piccco3/backend 2>/dev/null || cd "$(dirname "$0")/.."

# 尝试从 .env 读取配置
if [ -f .env ]; then
    DB_USER=$(grep "^DB_USER=" .env | cut -d'=' -f2 | tr -d ' ' | tr -d '"' | tr -d "'")
    DB_NAME=$(grep "^DB_NAME=" .env | cut -d'=' -f2 | tr -d ' ' | tr -d '"' | tr -d "'")
    DB_PASSWORD=$(grep "^DB_PASSWORD=" .env | cut -d'=' -f2 | tr -d ' ' | tr -d '"' | tr -d "'")
fi

# 使用默认值
DB_USER=${DB_USER:-postgres}
DB_NAME=${DB_NAME:-piccco}

echo "📋 数据库: $DB_NAME"
echo "📋 应用用户: $DB_USER"
echo ""

# 检查 psql
if [ -f "/www/server/pgsql/bin/psql" ]; then
    PSQL="/www/server/pgsql/bin/psql"
    export PGPASSWORD="${DB_PASSWORD:-}"
elif command -v psql >/dev/null 2>&1; then
    PSQL="psql"
    export PGPASSWORD="${DB_PASSWORD:-}"
else
    echo "❌ 错误: 未找到 psql 命令"
    exit 1
fi

echo "🔧 开始修复权限..."
echo ""

# 使用 postgres 超级用户执行权限修复
$PSQL -U postgres -d "$DB_NAME" <<EOF
-- 授予 public schema 权限
GRANT USAGE ON SCHEMA public TO $DB_USER;

-- 授予所有现有表权限
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO $DB_USER;

-- 授予所有现有序列权限
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;

-- 授予未来创建的表和序列的默认权限
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO $DB_USER;

-- 确保用户拥有数据库连接权限
GRANT CONNECT ON DATABASE $DB_NAME TO $DB_USER;
EOF

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ 权限修复失败！"
    exit 1
fi

echo ""
echo "✅ 权限修复完成！"
echo ""
echo "🔍 验证权限..."

# 使用应用用户测试连接和查询
export PGPASSWORD="${DB_PASSWORD:-}"

# 测试连接
$PSQL -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "⚠️  警告: 无法使用用户 $DB_USER 连接数据库"
    echo "   可能原因: 密码不正确或用户不存在"
    echo "   请检查 .env 文件中的 DB_PASSWORD"
    echo ""
    echo "   如果用户不存在，请创建:"
    echo "   $PSQL -U postgres -c \"CREATE USER $DB_USER WITH PASSWORD 'your_password';\""
    exit 1
fi

# 测试各个表的权限
echo "测试表权限..."
TABLES=("users" "messages" "notes" "folders" "urls" "user_settings" "message_history" "verification_codes" "logs" "migration_status")

ALL_OK=true
for table in "${TABLES[@]}"; do
    $PSQL -U "$DB_USER" -d "$DB_NAME" -c "SELECT COUNT(*) FROM $table;" >/dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo "  ✅ $table - 权限正常"
    else
        echo "  ❌ $table - 权限错误"
        ALL_OK=false
    fi
done

if [ "$ALL_OK" = true ]; then
    echo ""
    echo "✨ 所有表权限验证通过！"
    echo ""
    echo "📝 下一步："
    echo "   1. 重启应用: pm2 restart piccco-backend --update-env"
    echo "   2. 检查日志: pm2 logs piccco-backend --lines 20"
else
    echo ""
    echo "⚠️  部分表权限验证失败，请检查上述错误"
fi




