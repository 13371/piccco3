#!/bin/bash

# 强制重新加载应用（清除所有缓存）
# 使用方法：bash scripts/force-reload-app.sh

echo "🔄 强制重新加载应用..."
echo ""

# 获取项目目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# 1. 检查代码
echo "1. 验证代码已更新..."
if ! grep -q "收到CORS请求，origin:" src/server.js; then
    echo "❌ 代码未更新，请先执行: git pull origin main"
    exit 1
fi
echo "✅ 代码已更新"

# 2. 显示关键代码行
echo ""
echo "2. 显示关键代码（第119行附近）..."
sed -n '115,125p' src/server.js | cat -n

# 3. 完全停止应用
echo ""
echo "3. 完全停止应用..."
if command -v pm2 >/dev/null 2>&1; then
    pm2 stop piccco-backend
    sleep 2
    
    # 确保进程已停止
    pm2 delete piccco-backend 2>/dev/null || true
    sleep 1
    
    echo "✅ 应用已完全停止"
else
    echo "⚠️  未找到 PM2"
    exit 1
fi

# 4. 清除可能的缓存
echo ""
echo "4. 清除 Node.js 缓存..."
find . -name "*.js.map" -delete 2>/dev/null || true
find . -type d -name ".cache" -exec rm -rf {} + 2>/dev/null || true
echo "✅ 缓存已清除"

# 5. 重新启动应用
echo ""
echo "5. 重新启动应用..."
if [ -f "ecosystem.config.js" ]; then
    pm2 start ecosystem.config.js --update-env
elif [ -f "package.json" ]; then
    # 从 package.json 读取启动命令
    START_CMD=$(node -e "console.log(require('./package.json').scripts.start || 'node src/server.js')")
    pm2 start "$START_CMD" --name piccco-backend --update-env
else
    pm2 start src/server.js --name piccco-backend --update-env
fi

if [ $? -eq 0 ]; then
    echo "✅ 应用已重新启动"
    echo ""
    echo "等待应用启动..."
    sleep 5
    
    # 检查应用状态
    echo ""
    echo "应用状态："
    pm2 list | grep piccco-backend
    
    # 保存 PM2 配置
    pm2 save
else
    echo "❌ 应用启动失败"
    exit 1
fi

echo ""
echo "=========================================="
echo "✅ 重新加载完成！"
echo "=========================================="
echo ""
echo "📝 下一步："
echo "1. 尝试登录，触发 CORS 请求"
echo "2. 查看实时日志: pm2 logs piccco-backend"
echo "3. 应该看到新的详细日志："
echo "   [INFO] [cors] 收到CORS请求，origin: http://8.136.38.126"
echo "   [INFO] [cors] ✅ 生产环境：允许 IP/localhost origin: http://8.136.38.126"
echo ""

