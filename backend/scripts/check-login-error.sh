#!/bin/bash

# 检查登录错误原因
# 使用方法：bash scripts/check-login-error.sh

echo "🔍 检查登录错误原因..."
echo ""

# 1. 检查应用日志
echo "1. 检查应用日志（最近 50 行）..."
if command -v pm2 >/dev/null 2>&1; then
    echo "应用日志："
    pm2 logs piccco-backend --lines 50 --nostream 2>/dev/null | grep -i "error\|login\|auth" | tail -20 || echo "无法获取日志"
else
    echo "⚠️  未找到 PM2"
fi
echo ""

# 2. 检查数据库连接
echo "2. 检查数据库连接..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

if [ -f .env ]; then
    TMP_ENV=$(mktemp)
    sed 's/\r$//' .env > "$TMP_ENV"
    set -a
    source "$TMP_ENV"
    set +a
    rm -f "$TMP_ENV"
    
    DB_NAME=${DB_NAME:-piccco}
    DB_USER=${DB_USER:-piccco_user}
    DB_PASSWORD=${DB_PASSWORD:-}
    USE_PGBOUNCER=${USE_PGBOUNCER:-false}
    DB_PORT=${DB_PORT:-5432}
    
    export PGPASSWORD="$DB_PASSWORD"
    
    if [ -f "/www/server/pgsql/bin/psql" ]; then
        PSQL="/www/server/pgsql/bin/psql"
    else
        PSQL="psql"
    fi
    
    echo "  配置:"
    echo "    USE_PGBOUNCER: $USE_PGBOUNCER"
    echo "    DB_PORT: $DB_PORT"
    echo "    DB_NAME: $DB_NAME"
    echo "    DB_USER: $DB_USER"
    echo ""
    
    # 测试连接
    echo "  测试数据库连接..."
    if $PSQL -h 127.0.0.1 -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
        echo "  ✅ 数据库连接正常"
    else
        echo "  ❌ 数据库连接失败"
        echo "  尝试直接连接 PostgreSQL..."
        if $PSQL -h 127.0.0.1 -p 5432 -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
            echo "  ✅ 直接 PostgreSQL 连接正常（PgBouncer 可能有问题）"
        else
            echo "  ❌ 直接 PostgreSQL 连接也失败"
        fi
    fi
else
    echo "❌ 未找到 .env 文件"
fi
echo ""

# 3. 检查用户表
echo "3. 检查用户表..."
if [ -n "$PSQL" ] && [ -n "$DB_NAME" ] && [ -n "$DB_USER" ]; then
    USER_COUNT=$($PSQL -h 127.0.0.1 -p 5432 -U postgres -d "$DB_NAME" -t -c "
    SELECT COUNT(*) FROM users;
    " 2>/dev/null | tr -d ' ')
    
    if [ -n "$USER_COUNT" ]; then
        echo "  用户数量: $USER_COUNT"
        
        # 检查是否有测试用户
        TEST_EMAIL="zq13371@gmail.com"
        USER_EXISTS=$($PSQL -h 127.0.0.1 -p 5432 -U postgres -d "$DB_NAME" -t -c "
        SELECT COUNT(*) FROM users WHERE email = '$TEST_EMAIL';
        " 2>/dev/null | tr -d ' ')
        
        if [ "$USER_EXISTS" = "1" ]; then
            echo "  ✅ 找到测试用户: $TEST_EMAIL"
        else
            echo "  ⚠️  未找到测试用户: $TEST_EMAIL"
            echo "  提示: 用户可能不存在，需要先注册"
        fi
    else
        echo "  ⚠️  无法查询用户表"
    fi
fi
echo ""

# 4. 检查 JWT_SECRET
echo "4. 检查 JWT_SECRET 配置..."
if [ -f .env ]; then
    JWT_SECRET=$(grep "^JWT_SECRET=" .env | cut -d'=' -f2 | tr -d ' ' | tr -d '"' | tr -d "'")
    if [ -n "$JWT_SECRET" ]; then
        echo "  ✅ JWT_SECRET 已配置"
    else
        echo "  ❌ JWT_SECRET 未配置（这会导致登录失败）"
    fi
else
    echo "  ⚠️  无法检查 JWT_SECRET"
fi
echo ""

# 5. 检查应用健康状态
echo "5. 检查应用健康状态..."
if command -v curl >/dev/null 2>&1; then
    HEALTH=$(curl -s http://localhost:4000/api/health 2>/dev/null)
    if [ -n "$HEALTH" ]; then
        DB_CONNECTED=$(echo "$HEALTH" | grep -o '"connected":[^,]*' | cut -d':' -f2 | tr -d ' ')
        if [ "$DB_CONNECTED" = "true" ]; then
            echo "  ✅ 应用健康检查正常，数据库连接正常"
        else
            echo "  ❌ 应用健康检查显示数据库连接失败"
        fi
    else
        echo "  ⚠️  无法获取健康检查响应"
    fi
else
    echo "  ⚠️  未安装 curl"
fi
echo ""

# 6. 测试登录 API
echo "6. 测试登录 API（模拟请求）..."
if command -v curl >/dev/null 2>&1; then
    RESPONSE=$(curl -s -X POST http://localhost:4000/api/auth/login \
        -H "Content-Type: application/json" \
        -d '{"email":"test@example.com","password":"test123456"}' 2>&1)
    
    if echo "$RESPONSE" | grep -q "500\|Internal Server Error"; then
        echo "  ❌ 登录 API 返回 500 错误"
        echo "  响应: $RESPONSE"
    elif echo "$RESPONSE" | grep -q "400\|邮箱或密码错误"; then
        echo "  ✅ 登录 API 正常（返回预期的错误消息）"
    else
        echo "  响应: $RESPONSE"
    fi
else
    echo "  ⚠️  未安装 curl"
fi
echo ""

echo "=========================================="
echo "📝 建议的修复步骤："
echo "=========================================="
echo ""
echo "1. 如果数据库连接失败："
echo "   - 检查 PgBouncer 是否运行: systemctl status pgbouncer"
echo "   - 检查 .env 配置是否正确"
echo "   - 重启应用: pm2 restart piccco-backend --update-env"
echo ""
echo "2. 如果 JWT_SECRET 未配置："
echo "   - 在 .env 文件中添加: JWT_SECRET=your-random-secret-string"
echo "   - 重启应用: pm2 restart piccco-backend --update-env"
echo ""
echo "3. 如果用户不存在："
echo "   - 需要先注册账号"
echo ""
echo "4. 查看详细错误日志："
echo "   pm2 logs piccco-backend --lines 100"

