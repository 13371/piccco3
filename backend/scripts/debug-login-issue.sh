#!/bin/bash

# 调试登录问题
# 使用方法：bash scripts/debug-login-issue.sh [email]

EMAIL="${1:-zq13371@gmail.com}"

echo "🔍 调试登录问题..."
echo "=========================================="
echo ""

# 获取项目目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# 1. 检查用户是否存在
echo "1️⃣  检查用户是否存在..."
if [ -f .env ]; then
    TMP_ENV=$(mktemp)
    sed 's/\r$//' .env > "$TMP_ENV"
    set -a
    source "$TMP_ENV"
    set +a
    rm -f "$TMP_ENV"
    
    DB_NAME=${DB_NAME:-piccco}
    DB_HOST=${DB_HOST:-127.0.0.1}
    ADMIN_DB_PORT="5432"
    
    # 尝试获取 postgres 用户密码
    POSTGRES_PASSWORD=$(grep "^POSTGRES_PASSWORD=" .env 2>/dev/null | cut -d'=' -f2 | tr -d ' ' | tr -d '"' | tr -d "'" || echo "")
    if [ -n "$POSTGRES_PASSWORD" ]; then
        export PGPASSWORD="$POSTGRES_PASSWORD"
    else
        export PGPASSWORD="${DB_PASSWORD:-}"
    fi
    
    if [ -f "/www/server/pgsql/bin/psql" ]; then
        PSQL="/www/server/pgsql/bin/psql"
    else
        PSQL="psql"
    fi
    
    USER_INFO=$($PSQL -h "$DB_HOST" -p "$ADMIN_DB_PORT" -U postgres -d "$DB_NAME" -t -c "
    SELECT 
        email,
        username,
        CASE 
            WHEN password LIKE '\$2a\$%' OR password LIKE '\$2b\$%' OR password LIKE '\$2y\$%' THEN 'bcrypt ✅'
            ELSE 'raw ❌'
        END as password_format,
        LENGTH(password) as password_length,
        LEFT(password, 15) as password_prefix
    FROM users 
    WHERE email = '$EMAIL';
    " 2>&1)
    
    if echo "$USER_INFO" | grep -q "bcrypt"; then
        echo "   ✅ 用户存在，密码格式正确"
        echo "$USER_INFO" | while IFS='|' read -r email username format length prefix; do
            echo "   邮箱: $(echo $email | xargs)"
            echo "   用户名: $(echo $username | xargs)"
            echo "   密码格式: $(echo $format | xargs)"
            echo "   密码长度: $(echo $length | xargs)"
            echo "   密码前缀: $(echo $prefix | xargs)"
        done
    else
        echo "   ❌ 用户不存在或密码格式不正确"
        echo "$USER_INFO"
    fi
else
    echo "   ❌ .env 文件不存在"
fi
echo ""

# 2. 检查 STORAGE_MODE
echo "2️⃣  检查 STORAGE_MODE..."
if [ -f .env ]; then
    if grep -q "^STORAGE_MODE=db" .env; then
        echo "   ✅ STORAGE_MODE=db 已设置"
    else
        CURRENT_MODE=$(grep "^STORAGE_MODE=" .env 2>/dev/null | cut -d'=' -f2 | tr -d ' ' || echo "未设置")
        echo "   ⚠️  STORAGE_MODE=$CURRENT_MODE（应该是 db）"
    fi
else
    echo "   ❌ .env 文件不存在"
fi
echo ""

# 3. 检查应用日志（最近的登录尝试）
echo "3️⃣  检查应用日志（最近的登录尝试）..."
if command -v pm2 >/dev/null 2>&1; then
    PM2_STATUS=$(pm2 list | grep piccco-backend | awk '{print $10}' || echo "")
    if [ "$PM2_STATUS" = "online" ]; then
        echo "   最近的登录相关日志："
        pm2 logs piccco-backend --lines 50 --nostream | grep -i "login\|auth\|verifyPassword\|密码\|password" | tail -20
    else
        echo "   ⚠️  应用未运行"
    fi
else
    echo "   ⚠️  未找到 PM2"
fi
echo ""

# 4. 检查应用状态
echo "4️⃣  检查应用状态..."
if command -v pm2 >/dev/null 2>&1; then
    PM2_STATUS=$(pm2 list | grep piccco-backend | awk '{print $10}' || echo "unknown")
    RESTART_COUNT=$(pm2 list | grep piccco-backend | awk '{print $8}' || echo "0")
    echo "   状态: $PM2_STATUS"
    echo "   重启次数: $RESTART_COUNT"
    
    if [ "$PM2_STATUS" != "online" ]; then
        echo "   ⚠️  应用未正常运行"
    fi
else
    echo "   ⚠️  未找到 PM2"
fi
echo ""

echo "=========================================="
echo "调试完成"
echo "=========================================="
echo ""
echo "💡 建议："
echo "1. 如果密码格式不正确，运行："
echo "   bash scripts/reset-password-simple.sh $EMAIL"
echo ""
echo "2. 如果 STORAGE_MODE 不是 db，运行："
echo "   bash scripts/fix-login-final.sh $EMAIL"
echo ""
echo "3. 清除缓存并重启应用："
echo "   bash scripts/clear-cache-and-restart.sh $EMAIL"
echo ""

