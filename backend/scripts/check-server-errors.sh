#!/bin/bash

# 检查服务器错误
# 使用方法：bash scripts/check-server-errors.sh

echo "🔍 检查服务器错误..."
echo ""

# 获取项目目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# 1. 检查应用是否运行
echo "1. 检查应用状态..."
if command -v pm2 >/dev/null 2>&1; then
    pm2 list | grep piccco-backend || echo "❌ 应用未运行"
    echo ""
else
    echo "⚠️  未找到 PM2"
    echo ""
fi

# 2. 查看最近的错误日志
echo "2. 查看最近的错误日志（最后 50 行）..."
if command -v pm2 >/dev/null 2>&1; then
    echo "--- 包含 'error'、'Error'、'ERROR' 的日志 ---"
    pm2 logs piccco-backend --lines 100 --nostream 2>/dev/null | grep -i "error\|exception\|failed\|失败" | tail -30 || echo "无错误日志"
    echo ""
    echo "--- 登录相关错误 ---"
    pm2 logs piccco-backend --lines 100 --nostream 2>/dev/null | grep -i "login\|auth" | tail -20 || echo "无登录相关日志"
    echo ""
    echo "--- 发送验证码相关错误 ---"
    pm2 logs piccco-backend --lines 100 --nostream 2>/dev/null | grep -i "send-code\|verification\|mail" | tail -20 || echo "无验证码相关日志"
else
    echo "⚠️  未找到 PM2"
fi
echo ""

# 3. 检查环境变量
echo "3. 检查关键环境变量..."
if [ -f ".env" ]; then
    echo "检查 .env 文件中的关键变量："
    grep -E "^(STORAGE_MODE|JWT_SECRET|DB_HOST|DB_NAME|DB_USER|SMTP_HOST|SMTP_USER|SMTP_PASS)=" .env 2>/dev/null | sed 's/=.*/=***/' || echo "未找到 .env 文件"
else
    echo "⚠️  未找到 .env 文件"
fi
echo ""

# 4. 测试数据库连接
echo "4. 测试数据库连接..."
if [ -f "/www/server/pgsql/bin/psql" ]; then
    PSQL="/www/server/pgsql/bin/psql"
else
    PSQL="psql"
fi

DB_TEST=$($PSQL -h 127.0.0.1 -p 5432 -U postgres -d piccco -c "SELECT 1;" 2>&1)
if [ $? -eq 0 ]; then
    echo "✅ 数据库连接正常"
else
    echo "❌ 数据库连接失败: $DB_TEST"
fi
echo ""

# 5. 检查用户密码格式
echo "5. 检查用户密码格式..."
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

if [ $? -eq 0 ] && [ ! -z "$PWD_CHECK" ]; then
    echo "$PWD_CHECK" | while IFS='|' read -r email format length; do
        echo "  邮箱: $email"
        echo "  格式: $format"
        echo "  长度: $length"
    done
else
    echo "⚠️  无法检查密码格式"
fi
echo ""

# 6. 建议
echo "=========================================="
echo "📝 建议的修复步骤："
echo "=========================================="
echo ""
echo "如果看到数据库连接错误："
echo "  1. 检查 PostgreSQL 是否运行: systemctl status postgresql"
echo "  2. 检查 .env 中的数据库配置"
echo ""
echo "如果看到密码格式错误："
echo "  1. 运行: bash scripts/reset-password-simple.sh zq13371@gmail.com"
echo ""
echo "如果看到邮件服务错误："
echo "  1. 检查 .env 中的 SMTP 配置"
echo "  2. 或者暂时禁用邮件验证（如果不需要）"
echo ""
echo "如果看到其他错误："
echo "  1. 查看完整日志: pm2 logs piccco-backend"
echo "  2. 重启应用: pm2 restart piccco-backend --update-env"
echo ""

