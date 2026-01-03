#!/bin/bash

# 强制更新 CORS 代码并重启
# 使用方法：bash scripts/force-update-cors.sh

echo "🔧 强制更新 CORS 代码..."
echo ""

# 获取项目目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# 1. 检查 Git 状态
echo "1. 检查 Git 状态..."
git status --short

# 2. 拉取最新代码
echo ""
echo "2. 拉取最新代码..."
git fetch origin main
git reset --hard origin/main

if [ $? -ne 0 ]; then
    echo "❌ Git 拉取失败"
    exit 1
fi

echo "✅ 代码已更新"

# 3. 验证代码
echo ""
echo "3. 验证 CORS 代码..."
if grep -q "收到CORS请求，origin:" src/server.js; then
    echo "✅ 新代码已存在"
else
    echo "❌ 新代码不存在，请检查 Git 仓库"
    exit 1
fi

# 4. 显示关键代码行
echo ""
echo "4. 显示关键代码（第119行附近）..."
sed -n '115,125p' src/server.js | cat -n

# 5. 重启应用
echo ""
echo "5. 重启应用..."
if command -v pm2 >/dev/null 2>&1; then
    pm2 restart piccco-backend --update-env
    
    if [ $? -eq 0 ]; then
        echo "✅ 应用已重启"
        echo ""
        echo "等待应用启动..."
        sleep 5
        
        # 检查应用状态
        echo ""
        echo "应用状态："
        pm2 list | grep piccco-backend
    else
        echo "❌ 应用重启失败"
        exit 1
    fi
else
    echo "⚠️  未找到 PM2"
fi

echo ""
echo "=========================================="
echo "✅ 更新完成！"
echo "=========================================="
echo ""
echo "📝 下一步："
echo "1. 尝试登录，触发 CORS 请求"
echo "2. 查看日志: pm2 logs piccco-backend --lines 50 | grep -i cors"
echo "3. 应该看到类似这样的日志："
echo "   [INFO] [cors] 收到CORS请求，origin: http://8.136.38.126"
echo "   [INFO] [cors] ✅ 生产环境：允许 IP/localhost origin: http://8.136.38.126"
echo ""

