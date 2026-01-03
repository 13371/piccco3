#!/bin/bash

# 快速修复数据库权限脚本
# 使用方法：在服务器上执行：bash scripts/quick-fix-permissions.sh

echo "🔧 开始修复数据库权限..."
echo ""

# 获取数据库配置（从环境变量或使用默认值）
DB_NAME="${DB_NAME:-piccco}"
DB_USER="${DB_USER:-postgres}"

echo "📋 数据库: $DB_NAME"
echo "📋 应用用户: $DB_USER"
echo ""

# 检查 psql 是否可用
if [ -f "/www/server/pgsql/bin/psql" ]; then
    PSQL="/www/server/pgsql/bin/psql"
elif command -v psql >/dev/null 2>&1; then
    PSQL="psql"
else
    echo "❌ 错误: 未找到 psql 命令"
    echo "   请确保 PostgreSQL 已正确安装"
    exit 1
fi

# 执行权限修复 SQL
echo "执行权限修复 SQL..."
$PSQL -U postgres -d "$DB_NAME" <<EOF
-- 授予 public schema 权限
GRANT USAGE ON SCHEMA public TO $DB_USER;

-- 授予所有表权限
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO $DB_USER;

-- 授予所有序列权限
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;

-- 授予未来创建的表和序列的默认权限
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO $DB_USER;
EOF

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 权限修复成功！"
    echo ""
    echo "🔍 验证权限..."
    $PSQL -U "$DB_USER" -d "$DB_NAME" -c "SELECT COUNT(*) FROM users;" 2>&1
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✨ 权限验证通过！应用现在应该可以正常访问数据库了。"
        echo ""
        echo "📝 下一步："
        echo "   1. 重启应用: pm2 restart piccco-backend"
        echo "   2. 检查日志: pm2 logs piccco-backend --lines 20"
    else
        echo ""
        echo "⚠️  权限验证失败，请检查："
        echo "   1. 数据库用户 '$DB_USER' 是否存在"
        echo "   2. 数据库密码是否正确（查看 .env 文件中的 DB_PASSWORD）"
    fi
else
    echo ""
    echo "❌ 权限修复失败，请检查："
    echo "   1. PostgreSQL 是否正在运行"
    echo "   2. postgres 用户密码是否正确"
    echo "   3. 数据库 '$DB_NAME' 是否存在"
fi


