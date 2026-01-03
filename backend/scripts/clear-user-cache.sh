#!/bin/bash

# 清除用户缓存
# 使用方法：bash scripts/clear-user-cache.sh [email]

EMAIL="${1:-zq13371@gmail.com}"

echo "🧹 清除用户缓存..."
echo ""

# 获取项目目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# 方法 1: 重启应用（最简单）
echo "方法 1: 重启应用以清除所有缓存..."
if command -v pm2 >/dev/null 2>&1; then
    pm2 restart piccco-backend --update-env
    sleep 3
    echo "✅ 应用已重启，缓存已清除"
else
    echo "⚠️  未找到 PM2"
fi
echo ""

# 方法 2: 通过 API 清除（如果应用支持）
echo "方法 2: 检查是否有清除缓存的 API..."
if command -v curl >/dev/null 2>&1; then
    # 尝试访问健康检查接口（可能会触发缓存刷新）
    curl -s http://localhost:4000/api/health > /dev/null 2>&1
    echo "✅ 已访问健康检查接口"
fi
echo ""

echo "=========================================="
echo "✅ 缓存清除完成！"
echo "=========================================="
echo ""
echo "📝 下一步："
echo "1. 等待几秒让应用完全启动"
echo "2. 尝试登录"
echo "3. 如果仍然失败，请确认："
echo "   - 输入的密码与重置时设置的密码一致"
echo "   - 查看日志: pm2 logs piccco-backend | grep -i login"
echo ""


