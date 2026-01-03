#!/bin/bash

# 检查优化状态 - 显示哪些已完成，哪些还需要做
# 使用方法：bash scripts/check-optimization-status.sh

echo "📊 检查数据库优化状态..."
echo "=========================================="
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

# 读取配置
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
else
    echo "❌ 未找到 .env 文件"
    exit 1
fi

export PGPASSWORD="$DB_PASSWORD"

# 检查项
COMPLETED=0
PENDING=0

echo "检查各项优化状态："
echo ""

# 1. 检查索引
echo -n "1. 数据库索引..."
INDEX_COUNT=$($PSQL -h 127.0.0.1 -p 5432 -U postgres -d "$DB_NAME" -t -c "
SELECT COUNT(*) FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename IN ('users', 'notes', 'folders', 'messages', 'logs', 'urls')
  AND indexname LIKE 'idx_%';
" 2>/dev/null | tr -d ' ')

if [ "$INDEX_COUNT" -ge "20" ]; then
    echo " ✅ 已完成 ($INDEX_COUNT 个索引)"
    COMPLETED=$((COMPLETED + 1))
else
    echo " ⏳ 待完成 (当前: $INDEX_COUNT 个，需要: 20+)"
    PENDING=$((PENDING + 1))
fi

# 2. 检查 PgBouncer
echo -n "2. PgBouncer 连接池..."
if [ "$USE_PGBOUNCER" = "true" ] && [ "$DB_PORT" = "6432" ]; then
    if systemctl is-active --quiet pgbouncer 2>/dev/null; then
        if $PSQL -h 127.0.0.1 -p 6432 -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
            echo " ✅ 已完成并运行中"
            COMPLETED=$((COMPLETED + 1))
        else
            echo " ⚠️  已配置但连接失败"
            PENDING=$((PENDING + 1))
        fi
    else
        echo " ⏳ 已配置但服务未运行"
        PENDING=$((PENDING + 1))
    fi
else
    echo " ⏳ 未配置"
    PENDING=$((PENDING + 1))
fi

# 3. 检查慢查询日志
echo -n "3. 慢查询日志..."
SLOW_QUERY=$($PSQL -h 127.0.0.1 -p 5432 -U postgres -d "$DB_NAME" -t -c "
SHOW log_min_duration_statement;
" 2>/dev/null | tr -d ' ')

if [ -n "$SLOW_QUERY" ] && [ "$SLOW_QUERY" != "-1" ] && [ "$SLOW_QUERY" != "0" ]; then
    echo " ✅ 已启用 (阈值: ${SLOW_QUERY}ms)"
    COMPLETED=$((COMPLETED + 1))
else
    echo " ⏳ 未启用"
    PENDING=$((PENDING + 1))
fi

# 4. 检查应用连接
echo -n "4. 应用数据库连接..."
if command -v pm2 >/dev/null 2>&1 && pm2 list | grep -q "piccco-backend.*online"; then
    if command -v curl >/dev/null 2>&1; then
        HEALTH=$(curl -s http://localhost:4000/api/health 2>/dev/null)
        if echo "$HEALTH" | grep -q '"connected":true'; then
            echo " ✅ 正常"
            COMPLETED=$((COMPLETED + 1))
        else
            echo " ⚠️  连接异常"
            PENDING=$((PENDING + 1))
        fi
    else
        echo " ✅ 应用运行中（无法检查连接）"
        COMPLETED=$((COMPLETED + 1))
    fi
else
    echo " ⚠️  应用未运行"
    PENDING=$((PENDING + 1))
fi

# 5. 检查数据库权限
echo -n "5. 数据库用户权限..."
PERM_COUNT=$($PSQL -h 127.0.0.1 -p 5432 -U postgres -d "$DB_NAME" -t -c "
SELECT COUNT(*) FROM information_schema.table_privileges 
WHERE grantee = '$DB_USER' AND table_schema = 'public' 
  AND privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE');
" 2>/dev/null | tr -d ' ')

if [ "$PERM_COUNT" -gt "0" ]; then
    echo " ✅ 正常"
    COMPLETED=$((COMPLETED + 1))
else
    echo " ⏳ 待配置"
    PENDING=$((PENDING + 1))
fi

echo ""
echo "=========================================="
echo "📊 状态总结"
echo "=========================================="
echo "✅ 已完成: $COMPLETED 项"
echo "⏳ 待完成: $PENDING 项"
echo ""

if [ $PENDING -eq 0 ]; then
    echo "🎉 所有优化已完成！"
    echo ""
    echo "📝 建议的维护操作："
    echo "   1. 定期运行: bash scripts/vacuum-analyze.sh"
    echo "   2. 监控慢查询日志"
    echo "   3. 检查健康状态: curl http://localhost:4000/api/health"
else
    echo "📋 待完成的优化项："
    echo ""
    
    # 根据检查结果给出建议
    if [ "$INDEX_COUNT" -lt "20" ]; then
        echo "  1. 创建数据库索引："
        echo "     bash scripts/apply-indexes.sh"
        echo ""
    fi
    
    if [ "$USE_PGBOUNCER" != "true" ] || [ "$DB_PORT" != "6432" ]; then
        echo "  2. 安装和配置 PgBouncer："
        echo "     bash scripts/install-pgbouncer.sh"
        echo "     bash scripts/fix-userlist-direct.sh"
        echo "     bash scripts/enable-pgbouncer.sh"
        echo ""
    fi
    
    if [ -z "$SLOW_QUERY" ] || [ "$SLOW_QUERY" = "-1" ] || [ "$SLOW_QUERY" = "0" ]; then
        echo "  3. 启用慢查询日志："
        echo "     bash scripts/configure-slow-query-log.sh"
        echo ""
    fi
    
    if [ "$PERM_COUNT" -eq "0" ]; then
        echo "  4. 配置数据库权限："
        echo "     bash scripts/quick-fix-permissions.sh"
        echo ""
    fi
    
    echo "或者运行一键优化脚本："
    echo "  bash scripts/complete-optimization.sh"
    if [ "$USE_PGBOUNCER" != "true" ]; then
        echo "  bash scripts/complete-optimization.sh --with-pgbouncer"
    fi
fi

echo ""
echo "详细检查："
echo "  bash scripts/comprehensive-check.sh"

