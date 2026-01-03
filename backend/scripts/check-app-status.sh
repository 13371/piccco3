#!/bin/bash

# 检查应用状态
# 使用方法：bash scripts/check-app-status.sh

echo "🔍 检查应用状态..."
echo "=========================================="
echo ""

# 获取项目目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# 1. 检查 PM2 状态
echo "1️⃣  检查 PM2 状态..."
if command -v pm2 >/dev/null 2>&1; then
    echo "   PM2 进程列表："
    pm2 list
    echo ""
    
    # 检查 piccco-backend 状态
    PM2_STATUS=$(pm2 list | grep piccco-backend | awk '{print $10}' || echo "not found")
    if [ "$PM2_STATUS" = "online" ]; then
        echo "   ✅ piccco-backend 状态: online"
    elif [ "$PM2_STATUS" = "errored" ]; then
        echo "   ❌ piccco-backend 状态: errored"
        echo "   查看错误日志："
        pm2 logs piccco-backend --lines 20 --nostream
    elif [ "$PM2_STATUS" = "stopped" ]; then
        echo "   ⚠️  piccco-backend 状态: stopped"
    else
        echo "   ❌ piccco-backend 未找到"
    fi
else
    echo "   ❌ 未找到 PM2"
fi
echo ""

# 2. 检查应用端口
echo "2️⃣  检查应用端口..."
if command -v netstat >/dev/null 2>&1; then
    PORT_4000=$(netstat -tlnp 2>/dev/null | grep ":4000 " || echo "")
    if [ -n "$PORT_4000" ]; then
        echo "   ✅ 端口 4000 正在监听："
        echo "   $PORT_4000"
    else
        echo "   ❌ 端口 4000 未监听"
    fi
elif command -v ss >/dev/null 2>&1; then
    PORT_4000=$(ss -tlnp 2>/dev/null | grep ":4000 " || echo "")
    if [ -n "$PORT_4000" ]; then
        echo "   ✅ 端口 4000 正在监听："
        echo "   $PORT_4000"
    else
        echo "   ❌ 端口 4000 未监听"
    fi
else
    echo "   ⚠️  未找到 netstat 或 ss 命令"
fi
echo ""

# 3. 测试健康检查端点
echo "3️⃣  测试健康检查端点..."
if command -v curl >/dev/null 2>&1; then
    HEALTH_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" http://localhost:4000/api/health 2>&1)
    HTTP_CODE=$(echo "$HEALTH_RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
    BODY=$(echo "$HEALTH_RESPONSE" | grep -v "HTTP_CODE:")
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo "   ✅ 健康检查通过 (HTTP $HTTP_CODE)"
        echo "   响应: $BODY"
    else
        echo "   ❌ 健康检查失败 (HTTP $HTTP_CODE)"
        echo "   响应: $BODY"
    fi
else
    echo "   ⚠️  未找到 curl 命令"
fi
echo ""

# 4. 检查应用日志（最近的错误）
echo "4️⃣  检查应用日志（最近 30 行）..."
if command -v pm2 >/dev/null 2>&1; then
    PM2_STATUS=$(pm2 list | grep piccco-backend | awk '{print $10}' || echo "")
    if [ "$PM2_STATUS" != "not found" ]; then
        echo "   最近的日志："
        pm2 logs piccco-backend --lines 30 --nostream | tail -30
    else
        echo "   ⚠️  应用未运行，无法查看日志"
    fi
else
    echo "   ⚠️  未找到 PM2"
fi
echo ""

# 5. 检查 Node.js 进程
echo "5️⃣  检查 Node.js 进程..."
NODE_PROCESSES=$(ps aux | grep -E "node.*server\.js|node.*piccco" | grep -v grep || echo "")
if [ -n "$NODE_PROCESSES" ]; then
    echo "   找到 Node.js 进程："
    echo "$NODE_PROCESSES"
else
    echo "   ⚠️  未找到 Node.js 进程"
fi
echo ""

# 6. 检查应用文件
echo "6️⃣  检查应用文件..."
if [ -f "src/server.js" ]; then
    echo "   ✅ src/server.js 存在"
else
    echo "   ❌ src/server.js 不存在"
fi

if [ -f ".env" ]; then
    echo "   ✅ .env 文件存在"
    # 检查关键配置
    if grep -q "^STORAGE_MODE=db" .env; then
        echo "   ✅ STORAGE_MODE=db 已设置"
    else
        echo "   ⚠️  STORAGE_MODE 未设置为 db"
    fi
else
    echo "   ❌ .env 文件不存在"
fi
echo ""

echo "=========================================="
echo "检查完成"
echo "=========================================="
echo ""
echo "💡 如果应用未运行，尝试："
echo "   pm2 start src/server.js --name piccco-backend --update-env"
echo "   或"
echo "   pm2 start ecosystem.config.js --update-env"
echo ""

