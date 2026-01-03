#!/bin/bash

# 检查更新用户名API端点
# 使用方法：bash scripts/check-api-endpoint.sh

echo "🔍 检查更新用户名API端点..."
echo "=========================================="
echo ""

# 获取项目目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# 1. 检查应用是否运行
echo "1️⃣  检查应用状态..."
if command -v pm2 >/dev/null 2>&1; then
    # 方法1: 使用 pm2 list（最可靠）
    # PM2 list 列顺序: id name user watching namespace version mode pid uptime ↺ status cpu mem
    # status 是第11列（↺ 是第10列），mode 是第7列
    PM2_STATUS=$(pm2 list 2>/dev/null | grep piccco-backend | awk '{print $11}' || echo "")
    PM2_MODE=$(pm2 list 2>/dev/null | grep piccco-backend | awk '{print $7}' || echo "")
    
    # 如果方法1失败，尝试方法2: 使用 pm2 jlist 和 jq
    if [ -z "$PM2_STATUS" ] || [ "$PM2_STATUS" = "" ]; then
        if command -v jq >/dev/null 2>&1; then
            PM2_STATUS=$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.name=="piccco-backend") | .pm2_env.status' 2>/dev/null || echo "")
            PM2_MODE=$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.name=="piccco-backend") | .pm2_env.exec_mode' 2>/dev/null || echo "")
        fi
    fi
    
    # 如果方法2也失败，尝试方法3: 直接检查端口
    if [ -z "$PM2_STATUS" ] || [ "$PM2_STATUS" = "" ]; then
        if command -v netstat >/dev/null 2>&1; then
            if netstat -tlnp 2>/dev/null | grep -q ":4000 "; then
                PM2_STATUS="online (detected by port)"
            fi
        elif command -v ss >/dev/null 2>&1; then
            if ss -tlnp 2>/dev/null | grep -q ":4000 "; then
                PM2_STATUS="online (detected by port)"
            fi
        fi
    fi
    
    if [ "$PM2_STATUS" = "online" ] || echo "$PM2_STATUS" | grep -q "online"; then
        echo "   ✅ 应用正在运行（状态: $PM2_STATUS, 模式: ${PM2_MODE:-unknown}）"
    else
        echo "   ❌ 应用未运行（状态: ${PM2_STATUS:-unknown}）"
        echo "   请启动应用: pm2 start src/server.js --name piccco-backend --update-env"
        exit 1
    fi
else
    echo "   ⚠️  未找到 PM2"
fi
echo ""

# 2. 检查端口是否监听
echo "2️⃣  检查端口监听..."
if command -v netstat >/dev/null 2>&1; then
    PORT_LISTEN=$(netstat -tlnp 2>/dev/null | grep ":4000 " || echo "")
    if [ -n "$PORT_LISTEN" ]; then
        echo "   ✅ 端口 4000 正在监听"
    else
        echo "   ❌ 端口 4000 未监听"
        echo "   应用可能未正常启动"
    fi
elif command -v ss >/dev/null 2>&1; then
    PORT_LISTEN=$(ss -tlnp 2>/dev/null | grep ":4000 " || echo "")
    if [ -n "$PORT_LISTEN" ]; then
        echo "   ✅ 端口 4000 正在监听"
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
    HEALTH_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" http://localhost:4000/api/health 2>/dev/null)
    HTTP_CODE=$(echo "$HEALTH_RESPONSE" | grep "HTTP_CODE" | cut -d':' -f2)
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo "   ✅ 健康检查端点正常（HTTP $HTTP_CODE）"
    else
        echo "   ❌ 健康检查端点异常（HTTP $HTTP_CODE）"
    fi
else
    echo "   ⚠️  未找到 curl 命令"
fi
echo ""

# 4. 测试 GET /api/auth/me 端点（需要token，这里只测试路由是否存在）
echo "4️⃣  检查 API 路由..."
if command -v curl >/dev/null 2>&1; then
    # 测试不带token的请求（应该返回401）
    ME_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X GET http://localhost:4000/api/auth/me 2>/dev/null)
    ME_HTTP_CODE=$(echo "$ME_RESPONSE" | grep "HTTP_CODE" | cut -d':' -f2)
    
    if [ "$ME_HTTP_CODE" = "401" ] || [ "$ME_HTTP_CODE" = "403" ]; then
        echo "   ✅ GET /api/auth/me 路由存在（HTTP $ME_HTTP_CODE，需要认证）"
    else
        echo "   ⚠️  GET /api/auth/me 响应异常（HTTP $ME_HTTP_CODE）"
    fi
    
    # 测试 PATCH /api/auth/me 端点（应该返回401或405）
    PATCH_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X PATCH http://localhost:4000/api/auth/me 2>/dev/null)
    PATCH_HTTP_CODE=$(echo "$PATCH_RESPONSE" | grep "HTTP_CODE" | cut -d':' -f2)
    
    if [ "$PATCH_HTTP_CODE" = "401" ] || [ "$PATCH_HTTP_CODE" = "403" ] || [ "$PATCH_HTTP_CODE" = "405" ]; then
        echo "   ✅ PATCH /api/auth/me 路由存在（HTTP $PATCH_HTTP_CODE）"
    else
        echo "   ⚠️  PATCH /api/auth/me 响应异常（HTTP $PATCH_HTTP_CODE）"
    fi
else
    echo "   ⚠️  未找到 curl 命令"
fi
echo ""

# 5. 检查CORS配置
echo "5️⃣  检查CORS配置..."
if [ -f "src/server.js" ]; then
    if grep -q "cors" src/server.js; then
        echo "   ✅ CORS 中间件已配置"
        
        # 检查是否允许所有来源
        if grep -q "origin.*true\|origin.*\*" src/server.js; then
            echo "   ✅ CORS 允许所有来源或IP地址"
        else
            echo "   ⚠️  CORS 配置可能限制某些来源"
        fi
    else
        echo "   ❌ 未找到 CORS 配置"
    fi
else
    echo "   ⚠️  未找到 server.js 文件"
fi
echo ""

# 6. 检查应用日志
echo "6️⃣  检查应用日志（最近10行）..."
if command -v pm2 >/dev/null 2>&1; then
    echo "   最近的日志："
    pm2 logs piccco-backend --lines 10 --nostream 2>/dev/null | tail -10 | while read line; do
        if echo "$line" | grep -q "error\|Error\|ERROR\|failed\|Failed"; then
            echo "   ⚠️  $line"
        fi
    done
else
    echo "   ⚠️  未找到 PM2"
fi
echo ""

echo "=========================================="
echo "✅ 检查完成"
echo "=========================================="
echo ""
echo "📝 如果API端点正常但前端仍然报错，可能的原因："
echo "   1. 前端请求的URL不正确（应该是 /api/auth/me）"
echo "   2. 前端未正确发送 JWT token"
echo "   3. 浏览器CORS策略阻止了请求"
echo "   4. 网络连接问题"
echo ""
echo "💡 建议："
echo "   1. 打开浏览器开发者工具，查看 Network 标签"
echo "   2. 检查请求的URL、方法和Headers"
echo "   3. 查看控制台是否有CORS错误"
echo "   4. 检查后端日志: pm2 logs piccco-backend | grep -i 'auth\|me\|cors'"
echo ""

