#!/bin/bash

# 正确重启应用
# 使用方法：bash scripts/restart-app-properly.sh

echo "🔄 正确重启应用..."
echo "=========================================="
echo ""

# 获取项目目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# 1. 完全停止应用
echo "1️⃣  完全停止应用..."
if command -v pm2 >/dev/null 2>&1; then
    # 停止所有相关进程
    pm2 stop piccco-backend 2>/dev/null
    pm2 delete piccco-backend 2>/dev/null
    
    # 等待进程完全停止
    sleep 2
    
    # 检查是否还有残留进程
    PIDS=$(ps aux | grep -E "node.*server\.js|node.*piccco" | grep -v grep | awk '{print $2}' || echo "")
    if [ -n "$PIDS" ]; then
        echo "   发现残留进程，正在终止..."
        echo "$PIDS" | xargs kill -9 2>/dev/null
        sleep 1
    fi
    
    echo "   ✅ 应用已完全停止"
else
    echo "   ⚠️  未找到 PM2"
fi
echo ""

# 2. 清除缓存
echo "2️⃣  清除缓存..."
if [ -d "node_modules/.cache" ]; then
    rm -rf node_modules/.cache
    echo "   ✅ 已清除 node_modules/.cache"
fi

if command -v pm2 >/dev/null 2>&1; then
    pm2 flush 2>/dev/null
    echo "   ✅ 已清除 PM2 日志缓存"
fi
echo ""

# 3. 检查配置文件
echo "3️⃣  检查配置文件..."
if [ -f ".env" ]; then
    echo "   ✅ .env 文件存在"
    
    # 检查关键配置
    if grep -q "^STORAGE_MODE=db" .env; then
        echo "   ✅ STORAGE_MODE=db 已设置"
    else
        echo "   ⚠️  STORAGE_MODE 未设置为 db"
    fi
    
    if grep -q "^SESSION_SECRET=" .env; then
        echo "   ✅ SESSION_SECRET 已设置"
    else
        echo "   ❌ SESSION_SECRET 未设置"
        echo "   运行: bash scripts/fix-session-secret.sh"
        exit 1
    fi
else
    echo "   ❌ .env 文件不存在"
    exit 1
fi
echo ""

# 4. 重新启动应用
echo "4️⃣  重新启动应用..."
if command -v pm2 >/dev/null 2>&1; then
    # 检查启动文件
    if [ -f "ecosystem.config.js" ]; then
        echo "   使用 ecosystem.config.js 启动..."
        pm2 start ecosystem.config.js --update-env
    elif [ -f "src/server.js" ]; then
        echo "   使用 src/server.js 启动..."
        pm2 start src/server.js --name piccco-backend --update-env
    else
        echo "   ❌ 未找到启动文件"
        exit 1
    fi
    
    # 保存配置
    pm2 save 2>/dev/null
    
    # 等待启动
    echo "   等待应用启动..."
    sleep 5
    
    # 检查状态
    PM2_STATUS=$(pm2 list | grep piccco-backend | awk '{print $10}' || echo "unknown")
    RESTART_COUNT=$(pm2 list | grep piccco-backend | awk '{print $8}' || echo "0")
    
    echo ""
    echo "   应用状态: $PM2_STATUS"
    echo "   重启次数: $RESTART_COUNT"
    
    if [ "$PM2_STATUS" = "online" ]; then
        echo "   ✅ 应用已成功启动"
    else
        echo "   ⚠️  应用状态异常: $PM2_STATUS"
        echo "   查看日志: pm2 logs piccco-backend --lines 30"
    fi
else
    echo "   ⚠️  未找到 PM2"
    exit 1
fi
echo ""

# 5. 测试健康检查
echo "5️⃣  测试健康检查..."
sleep 3
if command -v curl >/dev/null 2>&1; then
    HEALTH_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" http://localhost:4000/api/health 2>&1)
    HTTP_CODE=$(echo "$HEALTH_RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
    BODY=$(echo "$HEALTH_RESPONSE" | grep -v "HTTP_CODE:")
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo "   ✅ 健康检查通过 (HTTP $HTTP_CODE)"
        echo "   响应: $BODY" | head -c 100
        echo "..."
    else
        echo "   ⚠️  健康检查失败 (HTTP $HTTP_CODE)"
        echo "   查看日志: pm2 logs piccco-backend --lines 30"
    fi
else
    echo "   ⚠️  未找到 curl，跳过健康检查"
fi
echo ""

# 6. 显示日志（最近几行）
echo "6️⃣  显示最近日志..."
if command -v pm2 >/dev/null 2>&1; then
    echo "   最近的日志："
    pm2 logs piccco-backend --lines 10 --nostream | tail -10
else
    echo "   ⚠️  未找到 PM2"
fi
echo ""

echo "=========================================="
echo "✅ 重启完成！"
echo "=========================================="
echo ""
echo "📝 下一步："
echo "1. 检查应用状态: pm2 list | grep piccco-backend"
echo "2. 查看日志: pm2 logs piccco-backend"
echo "3. 测试登录: bash scripts/test-login.sh zq13371@gmail.com YOUR_PASSWORD"
echo ""

