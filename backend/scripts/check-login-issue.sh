#!/bin/bash

# 检查登录问题
# 使用方法：bash scripts/check-login-issue.sh

echo "🔍 检查登录问题..."
echo ""

# 获取项目目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# 1. 检查密码格式
echo "1. 检查数据库中的密码格式..."
if [ -f "/www/server/pgsql/bin/psql" ]; then
    PSQL="/www/server/pgsql/bin/psql"
else
    PSQL="psql"
fi

PWD_INFO=$($PSQL -h 127.0.0.1 -p 5432 -U postgres -d piccco -c "
SELECT 
    email,
    CASE 
        WHEN password LIKE '\$2a\$%' OR password LIKE '\$2b\$%' THEN 'bcrypt ✅'
        ELSE 'raw ❌'
    END as format,
    LENGTH(password) as length,
    LEFT(password, 10) as prefix
FROM users 
WHERE email = 'zq13371@gmail.com';
" 2>&1)

echo "$PWD_INFO"
echo ""

# 2. 检查应用日志（最近的登录错误）
echo "2. 检查应用日志（最近的登录相关错误）..."
if command -v pm2 >/dev/null 2>&1; then
    echo "最近 50 行包含 'login'、'auth' 或 'error' 的日志："
    pm2 logs piccco-backend --lines 100 --nostream 2>/dev/null | grep -i "login\|auth\|error" | tail -20 || echo "无法获取日志"
else
    echo "⚠️  未找到 PM2"
fi
echo ""

# 3. 测试登录 API
echo "3. 测试登录 API..."
if command -v curl >/dev/null 2>&1; then
    echo "发送测试请求（使用错误密码以查看错误响应）..."
    RESPONSE=$(curl -s -X POST http://localhost:4000/api/auth/login \
        -H "Content-Type: application/json" \
        -d '{"email":"zq13371@gmail.com","password":"wrongpassword"}' \
        -w "\nHTTP_CODE:%{http_code}" 2>&1)
    
    HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE" | cut -d':' -f2)
    BODY=$(echo "$RESPONSE" | grep -v "HTTP_CODE")
    
    echo "HTTP 状态码: $HTTP_CODE"
    echo "响应内容: $BODY"
    
    if [ "$HTTP_CODE" = "500" ]; then
        echo "❌ 返回 500 错误，说明服务器端有问题"
    elif [ "$HTTP_CODE" = "400" ]; then
        echo "✅ 返回 400 错误（预期的密码错误响应）"
    fi
else
    echo "⚠️  未安装 curl"
fi
echo ""

# 4. 检查应用是否运行
echo "4. 检查应用状态..."
if command -v pm2 >/dev/null 2>&1; then
    pm2 list | grep piccco-backend || echo "应用未运行"
else
    echo "⚠️  未找到 PM2"
fi
echo ""

# 5. 建议
echo "=========================================="
echo "📝 建议的修复步骤："
echo "=========================================="
echo ""
echo "如果密码格式正确但仍有 500 错误："
echo "  1. 重启应用清除缓存: pm2 restart piccco-backend --update-env"
echo "  2. 查看详细错误日志: pm2 logs piccco-backend --lines 50"
echo ""
echo "如果密码格式不正确："
echo "  1. 重新运行密码重置: bash scripts/reset-password-simple.sh zq13371@gmail.com"
echo ""

