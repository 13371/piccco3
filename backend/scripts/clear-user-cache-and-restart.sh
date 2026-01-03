#!/bin/bash

# 清除用户缓存并重启应用（解决密码更新后登录失败的问题）
# 使用方法：bash scripts/clear-user-cache-and-restart.sh [email]

EMAIL="${1:-zq13371@gmail.com}"

echo "🔄 清除用户缓存并重启应用..."
echo "=========================================="
echo ""
echo "用户: $EMAIL"
echo ""

# 获取项目目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# 1. 停止应用
echo "1️⃣  停止应用..."
if command -v pm2 >/dev/null 2>&1; then
    pm2 stop piccco-backend 2>/dev/null
    pm2 delete piccco-backend 2>/dev/null
    echo "   ✅ 应用已停止"
    sleep 2
else
    echo "   ⚠️  未找到 PM2"
fi
echo ""

# 2. 清除所有 Node.js 缓存
echo "2️⃣  清除缓存..."
if [ -d "node_modules/.cache" ]; then
    rm -rf node_modules/.cache
    echo "   ✅ 已清除 node_modules/.cache"
fi

# 清除 PM2 日志缓存
if command -v pm2 >/dev/null 2>&1; then
    pm2 flush 2>/dev/null
    echo "   ✅ 已清除 PM2 日志缓存"
fi

# 杀死所有可能残留的 Node.js 进程
pkill -f "node.*server.js" 2>/dev/null && echo "   ✅ 已清理残留进程" || true
echo ""

# 3. 验证数据库中的密码格式
echo "3️⃣  验证数据库中的密码..."
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
    
    PASSWORD_INFO=$($PSQL -h "$DB_HOST" -p "$ADMIN_DB_PORT" -U postgres -d "$DB_NAME" -t -c "
    SELECT 
        CASE 
            WHEN password LIKE '\$2a\$%' OR password LIKE '\$2b\$%' OR password LIKE '\$2y\$%' THEN 'bcrypt'
            ELSE 'raw'
        END as format,
        LENGTH(password) as length,
        LEFT(password, 20) as prefix
    FROM users 
    WHERE email = '$EMAIL';
    " 2>&1)
    
    if echo "$PASSWORD_INFO" | grep -q "bcrypt.*60"; then
        echo "   ✅ 密码格式正确（bcrypt，长度 60）"
        PREFIX=$(echo "$PASSWORD_INFO" | awk '{print $3}')
        echo "   密码前缀: $PREFIX"
    else
        echo "   ⚠️  密码格式可能不正确："
        echo "$PASSWORD_INFO"
    fi
fi
echo ""

# 4. 重新启动应用
echo "4️⃣  重新启动应用..."
if command -v pm2 >/dev/null 2>&1; then
    # 检查是否有 ecosystem.config.js
    if [ -f "ecosystem.config.js" ]; then
        pm2 start ecosystem.config.js --update-env
    elif [ -f "src/server.js" ]; then
        pm2 start src/server.js --name piccco-backend --update-env
    else
        echo "   ❌ 未找到启动文件"
        exit 1
    fi
    
    sleep 5
    
    # 检查应用状态
    PM2_STATUS=$(pm2 list | grep piccco-backend | awk '{print $10}' || echo "unknown")
    if [ "$PM2_STATUS" = "online" ]; then
        echo "   ✅ 应用已启动（状态: online）"
    else
        echo "   ⚠️  应用状态: $PM2_STATUS"
        echo "   查看日志: pm2 logs piccco-backend"
    fi
    
    pm2 save 2>/dev/null
else
    echo "   ⚠️  未找到 PM2，请手动启动应用"
fi
echo ""

# 5. 等待应用完全启动
echo "5️⃣  等待应用完全启动..."
sleep 5

# 6. 测试健康检查
echo "6️⃣  测试应用健康状态..."
if command -v curl >/dev/null 2>&1; then
    HEALTH_RESPONSE=$(curl -s http://localhost:4000/api/health 2>/dev/null)
    if echo "$HEALTH_RESPONSE" | grep -q "connected.*true"; then
        echo "   ✅ 应用健康检查通过"
    else
        echo "   ⚠️  应用健康检查失败，但可能仍在启动中"
    fi
else
    echo "   ⚠️  未找到 curl，跳过健康检查"
fi
echo ""

echo "=========================================="
echo "✅ 缓存清除和应用重启完成！"
echo "=========================================="
echo ""
echo "📝 下一步："
echo "1. 使用重置时设置的密码尝试登录"
echo "2. 如果仍然失败，查看详细日志："
echo "   pm2 logs piccco-backend | grep -i 'login\|auth\|verifyPassword\|密码'"
echo "3. 确认输入的密码与重置时设置的密码完全一致"
echo "4. 如果忘记密码，可以再次重置："
echo "   bash scripts/reset-password-simple.sh $EMAIL"
echo ""

