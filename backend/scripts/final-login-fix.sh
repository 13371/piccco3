#!/bin/bash

# 最终修复登录问题
# 使用方法：bash scripts/final-login-fix.sh

echo "🔧 最终修复登录问题..."
echo ""

# 获取项目目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# 1. 确认配置
echo "1. 确认配置..."
if [ -f ".env" ]; then
    echo "STORAGE_MODE: $(grep "^STORAGE_MODE=" .env | cut -d'=' -f2 || echo '未设置')"
else
    echo "❌ 未找到 .env 文件"
    exit 1
fi
echo ""

# 2. 重启应用以加载新配置
echo "2. 重启应用以加载新配置..."
if command -v pm2 >/dev/null 2>&1; then
    pm2 restart piccco-backend --update-env
    sleep 5
    echo "✅ 应用已重启"
    
    # 检查应用状态
    pm2 list | grep piccco-backend
else
    echo "⚠️  未找到 PM2"
    exit 1
fi
echo ""

# 3. 验证密码格式
echo "3. 验证密码格式..."
if [ -f "/www/server/pgsql/bin/psql" ]; then
    PSQL="/www/server/pgsql/bin/psql"
else
    PSQL="psql"
fi

PWD_CHECK=$($PSQL -h 127.0.0.1 -p 5432 -U postgres -d piccco -t -A -c "
SELECT 
    email,
    CASE 
        WHEN password LIKE '\$2a\$%' OR password LIKE '\$2b\$%' THEN 'bcrypt ✅'
        ELSE 'NOT bcrypt ❌'
    END as format,
    LENGTH(password) as length
FROM users 
WHERE email = 'zq13371@gmail.com';
" 2>&1)

if echo "$PWD_CHECK" | grep -q "bcrypt ✅"; then
    echo "✅ 密码格式正确"
    echo "$PWD_CHECK" | while IFS='|' read -r email format length; do
        echo "  格式: $format"
        echo "  长度: $length"
    done
else
    echo "❌ 密码格式不正确"
    echo "$PWD_CHECK"
fi
echo ""

# 4. 测试登录（使用错误密码）
echo "4. 测试登录 API..."
if command -v curl >/dev/null 2>&1; then
    echo "使用错误密码测试（应该返回 400）..."
    RESPONSE=$(curl -s -X POST http://localhost:4000/api/auth/login \
        -H "Content-Type: application/json" \
        -H "Origin: http://8.136.38.126" \
        -d '{"email":"zq13371@gmail.com","password":"wrongpassword"}' \
        -w "\nHTTP_CODE:%{http_code}" 2>&1)
    
    HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE" | cut -d':' -f2)
    if [ "$HTTP_CODE" = "400" ]; then
        echo "✅ API 正常工作（返回预期的 400 错误）"
    else
        echo "⚠️  意外的响应: HTTP $HTTP_CODE"
    fi
else
    echo "⚠️  未安装 curl"
fi
echo ""

echo "=========================================="
echo "✅ 修复完成！"
echo "=========================================="
echo ""
echo "📝 下一步："
echo "1. 使用刚才重置密码时输入的密码尝试登录"
echo "2. 如果仍然失败，请确认："
echo "   - 输入的密码是否正确（与重置时输入的密码一致）"
echo "   - 查看实时日志: pm2 logs piccco-backend | grep -i login"
echo ""
echo "💡 提示：如果忘记刚才设置的密码，可以重新运行："
echo "   bash scripts/reset-password-simple.sh zq13371@gmail.com"
echo ""

