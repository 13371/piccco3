#!/bin/bash

# 验证 PgBouncer 配置和连接
# 使用方法：bash scripts/verify-pgbouncer.sh

echo "🔍 验证 PgBouncer 配置..."
echo ""

# 检查 psql
if [ -f "/www/server/pgsql/bin/psql" ]; then
    PSQL="/www/server/pgsql/bin/psql"
else
    PSQL="psql"
fi

# 1. 检查 PgBouncer 服务状态
echo "1. 检查 PgBouncer 服务状态..."
if systemctl is-active --quiet pgbouncer; then
    echo "✅ PgBouncer 服务运行中"
else
    echo "❌ PgBouncer 服务未运行"
    exit 1
fi

# 2. 检查连接池状态
echo ""
echo "2. 检查连接池状态..."
if $PSQL -h 127.0.0.1 -p 6432 -U postgres -d pgbouncer -c "SHOW POOLS;" >/dev/null 2>&1; then
    echo "✅ 可以连接到 PgBouncer 管理界面"
    echo ""
    echo "连接池信息："
    $PSQL -h 127.0.0.1 -p 6432 -U postgres -d pgbouncer -c "SHOW POOLS;" 2>&1 | head -10
else
    echo "❌ 无法连接到 PgBouncer 管理界面"
fi

# 3. 检查应用配置
echo ""
echo "3. 检查应用配置..."
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
    
    echo "  USE_PGBOUNCER: ${USE_PGBOUNCER:-未设置}"
    echo "  DB_PORT: ${DB_PORT:-未设置}"
    echo "  DB_HOST: ${DB_HOST:-未设置}"
    echo "  DB_NAME: ${DB_NAME:-未设置}"
    echo "  DB_USER: ${DB_USER:-未设置}"
    
    if [ "$USE_PGBOUNCER" = "true" ] && [ "$DB_PORT" = "6432" ]; then
        echo "✅ 应用配置正确"
    else
        echo "⚠️  应用配置可能不正确"
    fi
else
    echo "❌ 未找到 .env 文件"
fi

# 4. 测试应用数据库连接
echo ""
echo "4. 测试应用数据库连接..."
if command -v pm2 >/dev/null 2>&1; then
    # 检查应用是否运行
    if pm2 list | grep -q "piccco-backend.*online"; then
        echo "✅ 应用正在运行"
        
        # 检查健康端点
        echo ""
        echo "5. 检查应用健康状态..."
        sleep 1
        if command -v curl >/dev/null 2>&1; then
            HEALTH_RESPONSE=$(curl -s http://localhost:4000/api/health 2>/dev/null || echo "")
            if [ -n "$HEALTH_RESPONSE" ]; then
                echo "✅ 健康检查端点响应正常"
                echo "$HEALTH_RESPONSE" | head -20
            else
                echo "⚠️  健康检查端点无响应（可能应用还在启动中）"
            fi
        else
            echo "⚠️  未安装 curl，跳过健康检查"
        fi
    else
        echo "❌ 应用未运行"
    fi
else
    echo "⚠️  未找到 PM2，跳过应用检查"
fi

# 5. 检查 PgBouncer 统计信息
echo ""
echo "6. 检查 PgBouncer 统计信息..."
if $PSQL -h 127.0.0.1 -p 6432 -U postgres -d pgbouncer -c "SHOW STATS;" >/dev/null 2>&1; then
    echo "连接统计："
    $PSQL -h 127.0.0.1 -p 6432 -U postgres -d pgbouncer -c "SHOW STATS;" 2>&1 | head -10
else
    echo "⚠️  无法获取统计信息"
fi

# 6. 检查应用日志（最近几行）
echo ""
echo "7. 检查应用日志（最近 10 行）..."
if command -v pm2 >/dev/null 2>&1; then
    pm2 logs piccco-backend --lines 10 --nostream 2>/dev/null | tail -10 || echo "无法获取日志"
fi

echo ""
echo "✅ 验证完成！"
echo ""
echo "📝 如果发现问题："
echo "   1. 检查 PgBouncer 日志: sudo journalctl -u pgbouncer -n 50"
echo "   2. 检查应用日志: pm2 logs piccco-backend"
echo "   3. 检查连接池: $PSQL -h 127.0.0.1 -p 6432 -U postgres -d pgbouncer -c 'SHOW POOLS;'"


