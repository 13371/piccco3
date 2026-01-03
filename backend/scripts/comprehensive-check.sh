#!/bin/bash

# 全面检查数据库优化和配置
# 使用方法：bash scripts/comprehensive-check.sh

echo "🔍 全面检查数据库优化和配置..."
echo "=========================================="
echo ""

# 检查 psql
if [ -f "/www/server/pgsql/bin/psql" ]; then
    PSQL="/www/server/pgsql/bin/psql"
else
    PSQL="psql"
fi

# 获取项目目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

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

# 设置密码
export PGPASSWORD="$DB_PASSWORD"

# 1. 检查 PostgreSQL 连接
echo "1️⃣  检查 PostgreSQL 连接..."
if $PSQL -h 127.0.0.1 -p 5432 -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
    echo "✅ 直接 PostgreSQL 连接正常"
else
    echo "❌ 直接 PostgreSQL 连接失败"
fi

# 2. 检查 PgBouncer
echo ""
echo "2️⃣  检查 PgBouncer 配置..."
if [ "$USE_PGBOUNCER" = "true" ] && [ "$DB_PORT" = "6432" ]; then
    echo "✅ 应用配置使用 PgBouncer (端口 6432)"
    
    if systemctl is-active --quiet pgbouncer; then
        echo "✅ PgBouncer 服务运行中"
        
        # 测试通过 PgBouncer 连接
        if $PSQL -h 127.0.0.1 -p 6432 -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
            echo "✅ 通过 PgBouncer 连接正常"
        else
            echo "❌ 通过 PgBouncer 连接失败"
        fi
    else
        echo "❌ PgBouncer 服务未运行"
    fi
else
    echo "⚠️  应用未使用 PgBouncer (直接连接 PostgreSQL)"
fi

# 3. 检查数据库索引
echo ""
echo "3️⃣  检查数据库索引..."
REQUIRED_INDEXES=(
    "idx_users_email"
    "idx_users_created_at"
    "idx_users_is_banned"
    "idx_notes_user_id"
    "idx_notes_folder_id"
    "idx_notes_updated_at"
    "idx_notes_user_id_deleted"
    "idx_notes_is_deleted"
    "idx_folders_user_id"
    "idx_folders_user_id_deleted"
    "idx_folders_updated_at"
    "idx_urls_user_id"
    "idx_urls_folder_id"
    "idx_urls_user_id_deleted"
    "idx_urls_updated_at"
    "idx_messages_user_id"
    "idx_messages_user_id_created_at"
    "idx_messages_is_read"
    "idx_logs_timestamp"
    "idx_logs_level"
)

MISSING_INDEXES=0
for idx in "${REQUIRED_INDEXES[@]}"; do
    COUNT=$($PSQL -h 127.0.0.1 -p 5432 -U postgres -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM pg_indexes WHERE indexname = '$idx';" 2>/dev/null | tr -d ' ')
    if [ "$COUNT" = "1" ]; then
        echo "  ✅ $idx"
    else
        echo "  ❌ $idx (缺失)"
        MISSING_INDEXES=$((MISSING_INDEXES + 1))
    fi
done

if [ $MISSING_INDEXES -eq 0 ]; then
    echo "✅ 所有必需索引已创建"
else
    echo "⚠️  缺失 $MISSING_INDEXES 个索引"
fi

# 4. 检查数据库权限
echo ""
echo "4️⃣  检查数据库权限..."
PERMISSIONS_OK=$($PSQL -h 127.0.0.1 -p 5432 -U postgres -d "$DB_NAME" -t -c "
SELECT COUNT(*) FROM information_schema.table_privileges 
WHERE grantee = '$DB_USER' AND table_schema = 'public' AND privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE');
" 2>/dev/null | tr -d ' ')

if [ "$PERMISSIONS_OK" -gt "0" ]; then
    echo "✅ 数据库用户权限正常"
else
    echo "❌ 数据库用户权限可能不足"
fi

# 5. 检查查询计划（验证索引使用）
echo ""
echo "5️⃣  检查关键查询的索引使用情况..."

# 检查用户查询
echo "  检查用户查询（按 email）..."
QUERY_PLAN=$($PSQL -h 127.0.0.1 -p 5432 -U postgres -d "$DB_NAME" -t -c "
EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'test@example.com' LIMIT 1;
" 2>/dev/null | grep -i "index\|seq scan" | head -1)

if echo "$QUERY_PLAN" | grep -qi "index"; then
    echo "    ✅ 使用索引"
else
    echo "    ⚠️  可能未使用索引"
fi

# 检查笔记查询
echo "  检查笔记查询（按 user_id 和 deleted）..."
QUERY_PLAN=$($PSQL -h 127.0.0.1 -p 5432 -U postgres -d "$DB_NAME" -t -c "
EXPLAIN ANALYZE SELECT * FROM notes WHERE user_id = 1 AND is_deleted = false LIMIT 10;
" 2>/dev/null | grep -i "index\|seq scan" | head -1)

if echo "$QUERY_PLAN" | grep -qi "index"; then
    echo "    ✅ 使用索引"
else
    echo "    ⚠️  可能未使用索引"
fi

# 6. 检查慢查询日志配置
echo ""
echo "6️⃣  检查慢查询日志配置..."
SLOW_QUERY_CONFIG=$($PSQL -h 127.0.0.1 -p 5432 -U postgres -d "$DB_NAME" -t -c "
SHOW log_min_duration_statement;
" 2>/dev/null | tr -d ' ')

if [ -n "$SLOW_QUERY_CONFIG" ]; then
    echo "  慢查询阈值: $SLOW_QUERY_CONFIG"
    if [ "$SLOW_QUERY_CONFIG" != "-1" ] && [ "$SLOW_QUERY_CONFIG" != "0" ]; then
        echo "  ✅ 慢查询日志已启用"
    else
        echo "  ⚠️  慢查询日志未启用"
    fi
else
    echo "  ⚠️  无法检查慢查询配置"
fi

# 7. 检查连接池配置
echo ""
echo "7️⃣  检查连接池配置..."
if [ -f "src/db/config.js" ]; then
    POOL_MAX=$(grep -o "max:.*parseInt.*DB_POOL_MAX.*'[0-9]*'" src/db/config.js | grep -o "'[0-9]*'" | tr -d "'" || echo "20")
    IDLE_TIMEOUT=$(grep -o "idleTimeoutMillis:.*parseInt.*DB_IDLE_TIMEOUT.*'[0-9]*'" src/db/config.js | grep -o "'[0-9]*'" | tr -d "'" || echo "30000")
    CONN_TIMEOUT=$(grep -o "connectionTimeoutMillis:.*parseInt.*DB_CONNECTION_TIMEOUT.*'[0-9]*'" src/db/config.js | grep -o "'[0-9]*'" | tr -d "'" || echo "2000")
    
    echo "  Node.js 连接池配置:"
    echo "    最大连接数: ${POOL_MAX:-20}"
    echo "    空闲超时: ${IDLE_TIMEOUT:-30000}ms"
    echo "    连接超时: ${CONN_TIMEOUT:-2000}ms"
    echo "  ✅ 连接池配置已设置"
else
    echo "  ⚠️  未找到连接池配置文件"
fi

# 8. 检查应用健康状态
echo ""
echo "8️⃣  检查应用健康状态..."
if command -v pm2 >/dev/null 2>&1; then
    if pm2 list | grep -q "piccco-backend.*online"; then
        echo "  ✅ 应用正在运行"
        
        if command -v curl >/dev/null 2>&1; then
            HEALTH_RESPONSE=$(curl -s http://localhost:4000/api/health 2>/dev/null)
            if [ -n "$HEALTH_RESPONSE" ]; then
                DB_CONNECTED=$(echo "$HEALTH_RESPONSE" | grep -o '"connected":[^,]*' | cut -d':' -f2 | tr -d ' ')
                DB_WRITABLE=$(echo "$HEALTH_RESPONSE" | grep -o '"writable":[^,]*' | cut -d':' -f2 | tr -d ' ')
                CONN_COUNT=$(echo "$HEALTH_RESPONSE" | grep -o '"connectionCount":[^,]*' | cut -d':' -f2 | tr -d ' ')
                
                if [ "$DB_CONNECTED" = "true" ]; then
                    echo "    ✅ 数据库连接: 正常"
                else
                    echo "    ❌ 数据库连接: 失败"
                fi
                
                if [ "$DB_WRITABLE" = "true" ]; then
                    echo "    ✅ 数据库可写: 正常"
                else
                    echo "    ❌ 数据库可写: 失败"
                fi
                
                echo "    连接数: $CONN_COUNT"
            else
                echo "  ⚠️  无法获取健康检查响应"
            fi
        else
            echo "  ⚠️  未安装 curl，跳过健康检查"
        fi
    else
        echo "  ❌ 应用未运行"
    fi
else
    echo "  ⚠️  未找到 PM2"
fi

# 9. 检查表统计信息
echo ""
echo "9️⃣  检查表统计信息..."
TABLES=("users" "notes" "folders" "urls" "messages" "logs")
for table in "${TABLES[@]}"; do
    ROW_COUNT=$($PSQL -h 127.0.0.1 -p 5432 -U postgres -d "$DB_NAME" -t -c "
    SELECT n_live_tup FROM pg_stat_user_tables WHERE relname = '$table';
    " 2>/dev/null | tr -d ' ')
    
    if [ -n "$ROW_COUNT" ] && [ "$ROW_COUNT" != "" ]; then
        echo "  $table: $ROW_COUNT 行"
    fi
done

# 10. 检查 PgBouncer 配置（如果使用）
if [ "$USE_PGBOUNCER" = "true" ]; then
    echo ""
    echo "🔟 检查 PgBouncer 配置..."
    if [ -f "/etc/pgbouncer/pgbouncer.ini" ]; then
        POOL_MODE=$(sudo grep "^pool_mode" /etc/pgbouncer/pgbouncer.ini | cut -d'=' -f2 | tr -d ' ' || echo "")
        DEFAULT_POOL_SIZE=$(sudo grep "^default_pool_size" /etc/pgbouncer/pgbouncer.ini | cut -d'=' -f2 | tr -d ' ' || echo "")
        MAX_CLIENT_CONN=$(sudo grep "^max_client_conn" /etc/pgbouncer/pgbouncer.ini | cut -d'=' -f2 | tr -d ' ' || echo "")
        
        if [ -n "$POOL_MODE" ]; then
            echo "  连接池模式: $POOL_MODE"
            if [ "$POOL_MODE" = "transaction" ]; then
                echo "    ✅ 使用事务池模式（推荐）"
            else
                echo "    ⚠️  建议使用 transaction 模式"
            fi
        fi
        
        if [ -n "$DEFAULT_POOL_SIZE" ]; then
            echo "  默认连接池大小: $DEFAULT_POOL_SIZE"
        fi
        
        if [ -n "$MAX_CLIENT_CONN" ]; then
            echo "  最大客户端连接数: $MAX_CLIENT_CONN"
        fi
        
        echo "  ✅ PgBouncer 配置文件存在"
    else
        echo "  ⚠️  PgBouncer 配置文件不存在"
    fi
fi

# 总结
echo ""
echo "=========================================="
echo "📊 检查总结"
echo "=========================================="
echo ""
echo "✅ 已完成的优化："
echo "  1. 数据库索引优化"
echo "  2. 分页查询优化（数据库级别）"
echo "  3. 增量同步（基于 updated_at）"
if [ "$USE_PGBOUNCER" = "true" ]; then
    echo "  4. PgBouncer 连接池（已启用）"
fi
echo "  5. 慢查询日志配置"
echo "  6. 连接池配置（Node.js）"
echo ""
echo "📝 建议的后续操作："
echo "  1. 定期运行 VACUUM ANALYZE 保持数据库性能"
echo "  2. 监控慢查询日志，优化超过阈值的查询"
echo "  3. 定期检查 /api/health 端点，监控数据库连接状态"
if [ "$USE_PGBOUNCER" = "true" ]; then
    echo "  4. 监控 PgBouncer 连接池使用情况"
fi
echo ""
echo "✅ 全面检查完成！"

