#!/bin/bash

# 彻底重启应用（清除所有可能的缓存）
# 使用方法：bash scripts/nuclear-restart.sh

echo "💥 彻底重启应用（清除所有缓存）..."
echo ""

# 获取项目目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# 1. 验证代码
echo "1. 验证代码已更新..."
if ! grep -q "收到CORS请求，origin:" src/server.js; then
    echo "❌ 代码未更新，请先执行: git pull origin main"
    exit 1
fi
echo "✅ 代码已更新"

# 显示关键代码
echo ""
echo "关键代码（第119行附近）："
sed -n '115,125p' src/server.js | cat -n
echo ""

# 2. 完全停止并删除 PM2 进程
echo "2. 完全停止并删除 PM2 进程..."
pm2 stop piccco-backend 2>/dev/null || true
pm2 delete piccco-backend 2>/dev/null || true
sleep 2

# 3. 杀死所有 Node.js 进程（确保没有残留）
echo "3. 检查并清理残留的 Node.js 进程..."
pkill -f "node.*server.js" 2>/dev/null || true
sleep 1

# 4. 清除可能的缓存
echo "4. 清除缓存..."
# Node.js 模块缓存
rm -rf node_modules/.cache 2>/dev/null || true
# PM2 日志
pm2 flush 2>/dev/null || true
# 临时文件
find . -name "*.log" -type f -delete 2>/dev/null || true
echo "✅ 缓存已清除"

# 5. 使用绝对路径重新启动
echo ""
echo "5. 使用绝对路径重新启动应用..."
ABSOLUTE_PATH="$PROJECT_DIR/src/server.js"
echo "启动路径: $ABSOLUTE_PATH"

# 检查文件是否存在
if [ ! -f "$ABSOLUTE_PATH" ]; then
    echo "❌ 文件不存在: $ABSOLUTE_PATH"
    exit 1
fi

# 启动应用
pm2 start "$ABSOLUTE_PATH" \
    --name piccco-backend \
    --update-env \
    --log-date-format "YYYY-MM-DD HH:mm:ss Z" \
    --merge-logs

if [ $? -eq 0 ]; then
    echo "✅ 应用已启动"
    pm2 save
else
    echo "❌ 应用启动失败"
    exit 1
fi

# 6. 等待启动
echo ""
echo "6. 等待应用启动..."
sleep 5

# 7. 检查状态
echo ""
echo "7. 应用状态："
pm2 list | grep piccco-backend

# 8. 验证代码是否加载
echo ""
echo "8. 验证代码是否加载..."
echo "查看最新的日志（应该看到新的 CORS 日志）："
sleep 2
pm2 logs piccco-backend --lines 10 --nostream | grep -i "cors\|收到CORS" | tail -5 || echo "暂无 CORS 日志（这是正常的，需要触发请求）"

echo ""
echo "=========================================="
echo "✅ 彻底重启完成！"
echo "=========================================="
echo ""
echo "📝 下一步："
echo "1. 尝试登录，触发 CORS 请求"
echo "2. 实时查看日志: pm2 logs piccco-backend | grep -i cors"
echo "3. 应该看到新的详细日志："
echo "   [INFO] [cors] 收到CORS请求，origin: http://8.136.38.126"
echo "   [INFO] [cors] ✅ 生产环境：允许 IP/localhost origin: http://8.136.38.126"
echo ""
echo "如果仍然看到旧日志，请运行："
echo "   bash scripts/debug-cors-issue.sh"
echo ""

