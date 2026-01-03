#!/bin/bash

# 验证密码格式
# 使用方法：bash scripts/verify-password-format.sh [email]

EMAIL="${1:-zq13371@gmail.com}"

echo "🔍 验证用户密码格式..."
echo ""

# 获取项目目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# 检查 psql
if [ -f "/www/server/pgsql/bin/psql" ]; then
    PSQL="/www/server/pgsql/bin/psql"
else
    PSQL="psql"
fi

echo "检查用户: $EMAIL"
echo ""

# 查询密码格式
PWD_INFO=$($PSQL -h 127.0.0.1 -p 5432 -U postgres -d piccco -t -A -c "
SELECT 
    email,
    CASE 
        WHEN password LIKE '\$2a\$%' THEN 'bcrypt (2a) ✅'
        WHEN password LIKE '\$2b\$%' THEN 'bcrypt (2b) ✅'
        WHEN password LIKE '\$2y\$%' THEN 'bcrypt (2y) ✅'
        WHEN password LIKE '\$2x\$%' THEN 'bcrypt (2x) ⚠️'
        ELSE 'NOT bcrypt ❌'
    END as format,
    LENGTH(password) as length,
    LEFT(password, 20) as prefix
FROM users 
WHERE email = '$EMAIL';
" 2>&1)

if [ $? -ne 0 ]; then
    echo "❌ 查询失败: $PWD_INFO"
    exit 1
fi

# 解析结果
EMAIL_FOUND=$(echo "$PWD_INFO" | cut -d'|' -f1)
FORMAT=$(echo "$PWD_INFO" | cut -d'|' -f2)
LENGTH=$(echo "$PWD_INFO" | cut -d'|' -f3)
PREFIX=$(echo "$PWD_INFO" | cut -d'|' -f4)

if [ -z "$EMAIL_FOUND" ]; then
    echo "❌ 用户不存在: $EMAIL"
    exit 1
fi

echo "📊 密码信息："
echo "  邮箱: $EMAIL_FOUND"
echo "  格式: $FORMAT"
echo "  长度: $LENGTH"
echo "  前缀: $PREFIX"
echo ""

# 判断格式
if echo "$FORMAT" | grep -q "✅"; then
    if [ "$LENGTH" = "60" ]; then
        echo "✅ 密码格式正确！"
        echo ""
        echo "📝 如果仍然无法登录，可能的原因："
        echo "  1. 密码输入错误（请确认密码是否正确）"
        echo "  2. 应用缓存（已重启，应该已清除）"
        echo "  3. 前端发送的密码格式问题"
        echo ""
        echo "🔧 建议："
        echo "  1. 确认密码是否正确输入"
        echo "  2. 尝试使用密码重置功能重新设置密码"
        echo "  3. 检查浏览器控制台的网络请求，查看发送的密码格式"
    else
        echo "⚠️  密码长度异常（应该是 60 字符）"
    fi
else
    echo "❌ 密码格式不正确！"
    echo ""
    echo "🔧 修复方法："
    echo "  bash scripts/reset-password-simple.sh $EMAIL"
fi

