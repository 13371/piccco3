#!/bin/bash

# 快速修复 CORS 问题
# 使用方法：bash scripts/quick-fix-cors.sh

echo "🔧 快速修复 CORS 问题..."
echo ""

# 获取项目目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# 1. 拉取最新代码
echo "1. 拉取最新代码..."
git pull origin main

if [ $? -ne 0 ]; then
    echo "❌ Git 拉取失败"
    exit 1
fi
echo "✅ 代码已更新"

# 2. 验证代码
echo ""
echo "2. 验证 CORS 代码..."
if grep -q "收到CORS请求，origin:" src/server.js; then
    echo "✅ 新代码已存在"
else
    echo "❌ 新代码不存在"
    exit 1
fi

# 3. 完全停止并重新启动应用
echo ""
echo "3. 完全重新加载应用..."
if command -v pm2 >/dev/null 2>&1; then
    # 停止并删除
    pm2 stop piccco-backend 2>/dev/null || true
    pm2 delete piccco-backend 2>/dev/null || true
    sleep 2
    
    # 重新启动
    if [ -f "ecosystem.config.js" ]; then
        pm2 start ecosystem.config.js --update-env
    elif [ -f "package.json" ]; then
        START_CMD=$(node -e "console.log(require('./package.json').scripts.start || 'node src/server.js')" 2>/dev/null || echo "node src/server.js")
        pm2 start "$START_CMD" --name piccco-backend --update-env
    else
        pm2 start src/server.js --name piccco-backend --update-env
    fi
    
    if [ $? -eq 0 ]; then
        echo "✅ 应用已重新启动"
        pm2 save
    else
        echo "❌ 应用启动失败"
        exit 1
    fi
else
    echo "⚠️  未找到 PM2"
    exit 1
fi

# 4. 等待启动
echo ""
echo "4. 等待应用启动..."
sleep 5

# 5. 检查状态
echo ""
echo "5. 应用状态："
pm2 list | grep piccco-backend

echo ""
echo "=========================================="
echo "✅ 修复完成！"
echo "=========================================="
echo ""
echo "📝 下一步："
echo "1. 尝试登录，触发 CORS 请求"
echo "2. 查看日志: pm2 logs piccco-backend --lines 50 | grep -i cors"
echo "3. 应该看到新的详细日志："
echo "   [INFO] [cors] 收到CORS请求，origin: http://8.136.38.126"
echo "   [INFO] [cors] ✅ 生产环境：允许 IP/localhost origin: http://8.136.38.126"
echo ""

