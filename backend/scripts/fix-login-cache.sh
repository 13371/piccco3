#!/bin/bash

# 修复登录缓存问题
# 使用方法：bash scripts/fix-login-cache.sh [email]

EMAIL="${1:-zq13371@gmail.com}"

echo "🔧 修复登录缓存问题..."
echo ""

# 获取项目目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# 1. 清除数据库中的用户缓存（通过更新用户触发缓存清除）
echo "1. 清除用户缓存..."
if [ -f "/www/server/pgsql/bin/psql" ]; then
    PSQL="/www/server/pgsql/bin/psql"
else
    PSQL="psql"
fi

# 通过更新 updated_at 来触发缓存清除（实际上缓存是在应用层的）
# 这里我们只是确保数据库中的数据是最新的
$PSQL -h 127.0.0.1 -p 5432 -U postgres -d piccco -c "
UPDATE users 
SET updated_at = CURRENT_TIMESTAMP 
WHERE email = '$EMAIL';
" > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "✅ 数据库更新成功"
else
    echo "⚠️  数据库更新失败（可能不影响）"
fi
echo ""

# 2. 重启应用以清除内存缓存
echo "2. 重启应用以清除内存缓存..."
if command -v pm2 >/dev/null 2>&1; then
    echo "正在重启 piccco-backend..."
    pm2 restart piccco-backend --update-env
    
    if [ $? -eq 0 ]; then
        echo "✅ 应用重启成功"
        echo ""
        echo "等待应用启动..."
        sleep 3
        
        # 检查应用状态
        pm2 list | grep piccco-backend
    else
        echo "❌ 应用重启失败"
        exit 1
    fi
else
    echo "⚠️  未找到 PM2，请手动重启应用"
fi
echo ""

# 3. 验证密码格式
echo "3. 验证密码格式..."
bash scripts/verify-password-format.sh "$EMAIL"
echo ""

echo "=========================================="
echo "✅ 修复完成！"
echo "=========================================="
echo ""
echo "📝 下一步："
echo "  1. 等待应用完全启动（约 5-10 秒）"
echo "  2. 尝试使用新密码登录"
echo "  3. 如果仍有问题，运行: bash scripts/check-login-issue.sh"
echo ""

