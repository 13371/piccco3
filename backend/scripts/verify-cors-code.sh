#!/bin/bash

# 验证 CORS 代码是否正确部署
# 使用方法：bash scripts/verify-cors-code.sh

echo "🔍 验证 CORS 代码..."
echo ""

# 获取项目目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# 1. 检查代码中是否有新的日志
echo "1. 检查 server.js 中的 CORS 代码..."
if grep -q "收到CORS请求，origin:" src/server.js; then
    echo "✅ 找到新的 CORS 日志代码"
else
    echo "❌ 未找到新的 CORS 日志代码，代码可能未更新"
    echo ""
    echo "请执行："
    echo "  git pull origin main"
    exit 1
fi

# 2. 检查第119行附近的代码
echo ""
echo "2. 检查 server.js 第119行附近的代码..."
sed -n '110,130p' src/server.js | cat -n

# 3. 检查应用是否运行
echo ""
echo "3. 检查应用状态..."
if command -v pm2 >/dev/null 2>&1; then
    pm2 list | grep piccco-backend || echo "应用未运行"
else
    echo "⚠️  未找到 PM2"
fi

# 4. 检查最近的日志
echo ""
echo "4. 检查最近的 CORS 日志（应该看到详细日志）..."
if command -v pm2 >/dev/null 2>&1; then
    pm2 logs piccco-backend --lines 30 --nostream 2>/dev/null | grep -i "cors\|收到CORS" | tail -10 || echo "无 CORS 日志"
else
    echo "⚠️  未找到 PM2"
fi

echo ""
echo "=========================================="
echo "📝 如果代码已更新但日志未显示："
echo "=========================================="
echo "1. 确认已拉取最新代码: git pull origin main"
echo "2. 重启应用: pm2 restart piccco-backend --update-env"
echo "3. 等待几秒后查看日志: pm2 logs piccco-backend --lines 50"
echo ""

