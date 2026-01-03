#!/bin/bash

# 诊断删除操作问题
# 使用方法：bash scripts/diagnose-delete-issue.sh

echo "🔍 诊断删除操作问题..."
echo "=========================================="
echo ""

# 获取项目目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# 1. 检查应用状态
echo "1️⃣  检查应用状态..."
if command -v pm2 >/dev/null 2>&1; then
    PM2_STATUS=$(pm2 describe piccco-backend 2>/dev/null | grep -i "status" | head -1 | awk -F: '{print $2}' | tr -d ' ' || echo "")
    
    if [ -z "$PM2_STATUS" ]; then
        if command -v jq >/dev/null 2>&1; then
            PM2_STATUS=$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.name=="piccco-backend") | .pm2_env.status' 2>/dev/null || echo "")
        fi
    fi
    
    if [ "$PM2_STATUS" = "online" ]; then
        echo "   ✅ 应用正在运行"
    else
        echo "   ❌ 应用未运行（状态: ${PM2_STATUS:-unknown}）"
        exit 1
    fi
else
    echo "   ⚠️  未找到 PM2"
    exit 1
fi
echo ""

# 2. 检查数据库中的删除状态
echo "2️⃣  检查数据库中的删除状态..."
if [ -f ".env" ]; then
    source .env 2>/dev/null || true
    
    # 检查数据库连接
    if [ -n "$DB_HOST" ] && [ -n "$DB_USER" ] && [ -n "$DB_NAME" ]; then
        echo "   数据库配置: $DB_USER@$DB_HOST:$DB_PORT/$DB_NAME"
        
        # 查询已删除的文件夹数量
        DELETED_FOLDERS=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM folders WHERE is_deleted = true;" 2>/dev/null | tr -d ' ' || echo "0")
        echo "   已删除的文件夹数量: $DELETED_FOLDERS"
        
        # 查询已删除的笔记数量
        DELETED_NOTES=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM notes WHERE is_deleted = true;" 2>/dev/null | tr -d ' ' || echo "0")
        echo "   已删除的笔记数量: $DELETED_NOTES"
        
        # 查询已删除的网址数量
        DELETED_URLS=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM urls WHERE is_deleted = true;" 2>/dev/null | tr -d ' ' || echo "0")
        echo "   已删除的网址数量: $DELETED_URLS"
        
        # 显示最近删除的项（如果有）
        if [ "$DELETED_FOLDERS" -gt 0 ] || [ "$DELETED_NOTES" -gt 0 ] || [ "$DELETED_URLS" -gt 0 ]; then
            echo ""
            echo "   最近删除的项（前5个）:"
            if [ "$DELETED_FOLDERS" -gt 0 ]; then
                echo "   文件夹:"
                PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USER" -d "$DB_NAME" -c "SELECT id, name, deleted_at FROM folders WHERE is_deleted = true ORDER BY deleted_at DESC LIMIT 5;" 2>/dev/null | head -10
            fi
            if [ "$DELETED_NOTES" -gt 0 ]; then
                echo "   笔记:"
                PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USER" -d "$DB_NAME" -c "SELECT id, LEFT(content, 50) as content_preview, deleted_at FROM notes WHERE is_deleted = true ORDER BY deleted_at DESC LIMIT 5;" 2>/dev/null | head -10
            fi
            if [ "$DELETED_URLS" -gt 0 ]; then
                echo "   网址:"
                PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USER" -d "$DB_NAME" -c "SELECT id, title, deleted_at FROM urls WHERE is_deleted = true ORDER BY deleted_at DESC LIMIT 5;" 2>/dev/null | head -10
            fi
        else
            echo "   ⚠️  数据库中没有已删除的项"
        fi
    else
        echo "   ⚠️  无法读取数据库配置"
    fi
else
    echo "   ⚠️  未找到 .env 文件"
fi
echo ""

# 3. 检查最近的删除日志
echo "3️⃣  检查最近的删除日志（最近20行）..."
if command -v pm2 >/dev/null 2>&1; then
    DELETE_LOGS=$(pm2 logs piccco-backend --lines 100 --nostream 2>/dev/null | grep -i "删除\|delete\|isDeleted\|软删除" | tail -20)
    if [ -n "$DELETE_LOGS" ]; then
        echo "   发现相关日志："
        echo "$DELETE_LOGS" | while read line; do
            echo "   $line"
        done
    else
        echo "   ℹ️  未发现相关删除日志"
    fi
else
    echo "   ⚠️  未找到 PM2"
fi
echo ""

# 4. 检查同步接口
echo "4️⃣  测试同步接口..."
if command -v curl >/dev/null 2>&1; then
    echo "   提示: 同步接口需要认证，请在前端浏览器中检查："
    echo "   1. 打开浏览器开发者工具（F12）"
    echo "   2. 查看 Network 标签"
    echo "   3. 删除一个文件或文件夹"
    echo "   4. 查看是否有同步请求（POST /api/v1/data/sync）"
    echo "   5. 检查请求和响应内容"
else
    echo "   ⚠️  未找到 curl 命令"
fi
echo ""

echo "=========================================="
echo "✅ 诊断完成"
echo "=========================================="
echo ""
echo "📝 如果删除操作不进入回收站，可能的原因："
echo "   1. 删除操作没有正确设置 isDeleted 和 deletedAt"
echo "   2. 同步失败，删除状态没有保存到服务器"
echo "   3. 前端在显示时错误地过滤掉了已删除的项"
echo "   4. 回收站页面没有正确读取已删除的项"
echo ""
echo "💡 建议："
echo "   1. 打开浏览器开发者工具，查看删除操作后的网络请求"
echo "   2. 检查 localStorage 中的数据（piccco-data-storage）"
echo "   3. 查看浏览器控制台是否有错误"
echo "   4. 尝试手动触发同步：在前端调用 syncDataToServer()"
echo ""

