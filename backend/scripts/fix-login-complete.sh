#!/bin/bash

# 完整修复登录问题
# 使用方法：bash scripts/fix-login-complete.sh [email]

EMAIL="${1:-zq13371@gmail.com}"

echo "🔧 完整修复登录问题..."
echo ""

# 获取项目目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# 1. 检查 .env 文件
echo "1. 检查并更新 .env 配置..."
if [ ! -f ".env" ]; then
    echo "❌ 未找到 .env 文件"
    exit 1
fi

# 检查 STORAGE_MODE
if ! grep -q "^STORAGE_MODE=" .env; then
    echo "添加 STORAGE_MODE=db 到 .env..."
    echo "" >> .env
    echo "STORAGE_MODE=db" >> .env
    echo "✅ STORAGE_MODE 已添加"
elif grep -q "^STORAGE_MODE=file" .env; then
    echo "更新 STORAGE_MODE 为 db..."
    sed -i 's/^STORAGE_MODE=file/STORAGE_MODE=db/' .env
    echo "✅ STORAGE_MODE 已更新为 db"
else
    echo "✅ STORAGE_MODE 已配置"
    grep "^STORAGE_MODE=" .env
fi
echo ""

# 2. 检查密码格式
echo "2. 检查密码格式..."
if [ -f "/www/server/pgsql/bin/psql" ]; then
    PSQL="/www/server/pgsql/bin/psql"
else
    PSQL="psql"
fi

PWD_INFO=$($PSQL -h 127.0.0.1 -p 5432 -U postgres -d piccco -t -A -c "
SELECT 
    CASE 
        WHEN password LIKE '\$2a\$%' OR password LIKE '\$2b\$%' THEN 'bcrypt ✅'
        ELSE 'NOT bcrypt ❌'
    END as format,
    password
FROM users 
WHERE email = '$EMAIL';
" 2>&1)

FORMAT=$(echo "$PWD_INFO" | cut -d'|' -f1)
CURRENT_PASSWORD=$(echo "$PWD_INFO" | cut -d'|' -f2)

if [ "$FORMAT" = "NOT bcrypt ❌" ]; then
    echo "❌ 密码格式不正确，需要转换为 bcrypt"
    echo ""
    echo "当前密码是明文: ${CURRENT_PASSWORD:0:10}..."
    echo ""
    echo "请运行密码重置脚本："
    echo "  bash scripts/reset-password-simple.sh $EMAIL"
    echo ""
    echo "或者手动设置："
    echo "  1. 输入新密码"
    echo "  2. 脚本会自动生成 bcrypt 哈希并更新到数据库"
    echo ""
    exit 1
else
    echo "✅ 密码格式正确"
fi
echo ""

# 3. 重启应用以加载新的 STORAGE_MODE
echo "3. 重启应用以加载新配置..."
if command -v pm2 >/dev/null 2>&1; then
    pm2 restart piccco-backend --update-env
    sleep 3
    echo "✅ 应用已重启"
else
    echo "⚠️  未找到 PM2"
fi
echo ""

# 4. 验证修复
echo "4. 验证修复..."
echo "检查配置："
grep "^STORAGE_MODE=" .env
echo ""

echo "=========================================="
echo "✅ 修复完成！"
echo "=========================================="
echo ""
echo "📝 下一步："
if [ "$FORMAT" = "NOT bcrypt ❌" ]; then
    echo "1. 运行密码重置: bash scripts/reset-password-simple.sh $EMAIL"
    echo "2. 使用新密码登录"
else
    echo "1. 尝试登录"
    echo "2. 如果仍有问题，查看日志: pm2 logs piccco-backend | grep -i login"
fi
echo ""

