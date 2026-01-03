#!/bin/bash

# 调试 CORS 问题
# 使用方法：bash scripts/debug-cors-issue.sh

echo "🔍 调试 CORS 问题..."
echo ""

# 获取项目目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# 1. 检查文件中的代码
echo "1. 检查 src/server.js 中的代码..."
echo "第119行附近："
sed -n '115,125p' src/server.js | cat -n
echo ""

# 2. 检查是否有新的日志代码
echo "2. 检查是否有新的 CORS 日志代码..."
if grep -q "收到CORS请求，origin:" src/server.js; then
    echo "✅ 文件中有新代码"
else
    echo "❌ 文件中没有新代码"
fi
echo ""

# 3. 检查 PM2 启动的路径
echo "3. 检查 PM2 配置..."
pm2 describe piccco-backend 2>/dev/null | grep -E "script path|exec cwd|interpreter" || echo "无法获取 PM2 信息"
echo ""

# 4. 检查实际运行的进程
echo "4. 检查实际运行的进程..."
ps aux | grep "node.*server.js" | grep -v grep || echo "未找到运行中的进程"
echo ""

# 5. 检查是否有多个 server.js 文件
echo "5. 查找所有 server.js 文件..."
find . -name "server.js" -type f 2>/dev/null
echo ""

# 6. 检查是否有编译后的文件
echo "6. 检查是否有编译后的文件..."
find . -name "*.js.map" -o -name "dist" -type d 2>/dev/null | head -5
echo ""

# 7. 测试直接运行代码
echo "7. 测试代码语法..."
if node -c src/server.js 2>&1; then
    echo "✅ 代码语法正确"
else
    echo "❌ 代码有语法错误"
fi
echo ""

# 8. 检查 Node.js 模块缓存位置
echo "8. 检查 Node.js 版本和模块路径..."
node --version
echo "模块路径:"
node -e "console.log(require.resolve('cors'))" 2>/dev/null || echo "无法解析模块路径"
echo ""

# 9. 建议
echo "=========================================="
echo "📝 建议的修复步骤："
echo "=========================================="
echo ""
echo "如果代码文件正确但应用仍使用旧代码："
echo "  1. 完全清除 PM2 和 Node.js 缓存："
echo "     pm2 delete piccco-backend"
echo "     rm -rf node_modules/.cache 2>/dev/null"
echo "     pm2 kill  # 完全重启 PM2"
echo "     pm2 start src/server.js --name piccco-backend --update-env"
echo ""
echo "  2. 或者使用绝对路径启动："
echo "     pm2 start $PROJECT_DIR/src/server.js --name piccco-backend --update-env"
echo ""
echo "  3. 检查是否有 ecosystem.config.js 覆盖了启动路径"
echo ""

