#!/bin/bash

# 强制重启应用以重新加载管理员密码
# 使用方法：bash scripts/force-restart-admin.sh

echo "🔄 强制重启应用以重新加载管理员密码..."
echo "=========================================="
echo ""

# 获取项目目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# 1. 验证 ADMIN_PASSWORD_HASH 是否存在
echo "1️⃣  验证 ADMIN_PASSWORD_HASH..."
if [ -f .env ]; then
    if grep -q "^ADMIN_PASSWORD_HASH=" .env; then
        HASH_VALUE=$(grep "^ADMIN_PASSWORD_HASH=" .env | cut -d'=' -f2 | tr -d ' ' | tr -d '"' | tr -d "'")
        if [ -n "$HASH_VALUE" ]; then
            echo "   ✅ ADMIN_PASSWORD_HASH 已设置"
            echo "   哈希前缀: ${HASH_VALUE:0:20}..."
            echo "   哈希长度: ${#HASH_VALUE}"
        else
            echo "   ❌ ADMIN_PASSWORD_HASH 值为空"
            exit 1
        fi
    else
        echo "   ❌ ADMIN_PASSWORD_HASH 未设置"
        exit 1
    fi
else
    echo "   ❌ .env 文件不存在"
    exit 1
fi
echo ""

# 2. 停止应用
echo "2️⃣  停止应用..."
if command -v pm2 >/dev/null 2>&1; then
    pm2 stop piccco-backend 2>/dev/null
    pm2 delete piccco-backend 2>/dev/null
    echo "   ✅ 应用已停止"
    sleep 2
    
    # 确保所有相关进程都已停止
    pkill -f "node.*server.js" 2>/dev/null && echo "   ✅ 已清理残留进程" || true
else
    echo "   ⚠️  未找到 PM2"
fi
echo ""

# 3. 清除缓存
echo "3️⃣  清除缓存..."
if [ -d "node_modules/.cache" ]; then
    rm -rf node_modules/.cache
    echo "   ✅ 已清除 node_modules/.cache"
fi

if command -v pm2 >/dev/null 2>&1; then
    pm2 flush 2>/dev/null
    echo "   ✅ 已清除 PM2 日志缓存"
fi
echo ""

# 4. 重新启动应用（使用 --update-env 确保重新加载环境变量）
echo "4️⃣  重新启动应用..."
if command -v pm2 >/dev/null 2>&1; then
    # 检查是否有 ecosystem.config.js
    if [ -f "ecosystem.config.js" ]; then
        pm2 start ecosystem.config.js --update-env
    elif [ -f "src/server.js" ]; then
        pm2 start src/server.js --name piccco-backend --update-env
    else
        echo "   ❌ 未找到启动文件"
        exit 1
    fi
    
    sleep 5
    
    # 检查应用状态
    PM2_STATUS=$(pm2 list | grep piccco-backend | awk '{print $10}' || echo "unknown")
    if [ "$PM2_STATUS" = "online" ]; then
        echo "   ✅ 应用已启动（状态: online）"
    else
        echo "   ⚠️  应用状态: $PM2_STATUS"
        echo "   查看日志: pm2 logs piccco-backend"
    fi
    
    pm2 save 2>/dev/null
else
    echo "   ⚠️  未找到 PM2，请手动启动应用"
fi
echo ""

# 5. 等待应用完全启动
echo "5️⃣  等待应用完全启动..."
sleep 5

# 6. 测试健康检查
echo "6️⃣  测试应用健康状态..."
if command -v curl >/dev/null 2>&1; then
    HEALTH_RESPONSE=$(curl -s http://localhost:4000/api/health 2>/dev/null)
    if echo "$HEALTH_RESPONSE" | grep -q "connected.*true"; then
        echo "   ✅ 应用健康检查通过"
    else
        echo "   ⚠️  应用健康检查失败，但可能仍在启动中"
    fi
else
    echo "   ⚠️  未找到 curl，跳过健康检查"
fi
echo ""

# 7. 验证环境变量是否已加载
echo "7️⃣  验证环境变量是否已加载..."
if command -v curl >/dev/null 2>&1; then
    # 尝试登录（使用错误的密码，应该返回 401）
    LOGIN_RESPONSE=$(curl -s -X POST http://localhost:4000/api/admin/login \
        -H "Content-Type: application/json" \
        -d '{"password":"wrong_password_test"}' \
        -w "\nHTTP_CODE:%{http_code}" 2>/dev/null)
    
    HTTP_CODE=$(echo "$LOGIN_RESPONSE" | grep "HTTP_CODE" | cut -d':' -f2)
    if [ "$HTTP_CODE" = "401" ]; then
        echo "   ✅ 管理员登录端点正常响应（401 表示密码错误，这是预期的）"
    else
        echo "   ⚠️  管理员登录端点响应异常（HTTP $HTTP_CODE）"
    fi
else
    echo "   ⚠️  未找到 curl，跳过验证"
fi
echo ""

echo "=========================================="
echo "✅ 应用重启完成！"
echo "=========================================="
echo ""
echo "📝 下一步："
echo "1. 使用重置时设置的管理员密码尝试登录"
echo "2. 如果仍然失败，查看详细日志："
echo "   pm2 logs piccco-backend | grep -i 'admin\|password'"
echo "3. 确认输入的密码与重置时设置的密码完全一致"
echo "4. 清除浏览器缓存和 Cookie，然后重试"
echo ""

