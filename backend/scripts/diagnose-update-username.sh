#!/bin/bash

# 诊断更新用户名API问题
# 使用方法：bash scripts/diagnose-update-username.sh [email] [password]

echo "🔍 诊断更新用户名API问题..."
echo "=========================================="
echo ""

# 获取项目目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# 1. 检查应用状态
echo "1️⃣  检查应用状态..."
if command -v pm2 >/dev/null 2>&1; then
    # 方法1: 优先使用 pm2 describe（最可靠，返回结构化信息）
    PM2_STATUS=$(pm2 describe piccco-backend 2>/dev/null | grep -i "status" | head -1 | awk -F: '{print $2}' | tr -d ' ' || echo "")
    
    # 方法2: 使用 pm2 jlist 和 jq（如果 jq 可用）
    if [ -z "$PM2_STATUS" ] || [ "$PM2_STATUS" = "" ]; then
        if command -v jq >/dev/null 2>&1; then
            PM2_STATUS=$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.name=="piccco-backend") | .pm2_env.status' 2>/dev/null || echo "")
        fi
    fi
    
    # 方法3: 使用 pm2 list，但先去除表格边框字符
    if [ -z "$PM2_STATUS" ] || [ "$PM2_STATUS" = "" ]; then
        # 去除表格边框字符（│、└、├等），然后提取 status
        PM2_STATUS=$(pm2 list 2>/dev/null | grep piccco-backend | sed 's/│/ /g' | sed 's/└/ /g' | sed 's/├/ /g' | tr -s ' ' | awk '{for(i=1;i<=NF;i++) if($i=="online" || $i=="stopped" || $i=="errored") print $i}' | head -1 || echo "")
    fi
    
    # 方法4: 直接检查端口（作为最后手段）
    if [ -z "$PM2_STATUS" ] || [ "$PM2_STATUS" = "" ]; then
        if command -v netstat >/dev/null 2>&1; then
            if netstat -tlnp 2>/dev/null | grep -q ":4000 "; then
                PM2_STATUS="online"
            fi
        elif command -v ss >/dev/null 2>&1; then
            if ss -tlnp 2>/dev/null | grep -q ":4000 "; then
                PM2_STATUS="online"
            fi
        fi
    fi
    
    # 验证状态
    if [ "$PM2_STATUS" = "online" ]; then
        echo "   ✅ 应用正在运行（状态: $PM2_STATUS）"
    else
        echo "   ❌ 应用未运行（状态: ${PM2_STATUS:-unknown}）"
        echo "   请启动应用: pm2 start src/server.js --name piccco-backend --update-env"
        echo ""
        echo "   调试信息:"
        echo "   PM2 进程列表:"
        pm2 list 2>/dev/null | head -5
        echo ""
        echo "   PM2 describe 输出:"
        pm2 describe piccco-backend 2>/dev/null | head -10
        exit 1
    fi
else
    echo "   ⚠️  未找到 PM2"
    exit 1
fi
echo ""

# 2. 测试健康检查
echo "2️⃣  测试健康检查端点..."
HEALTH_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" http://localhost:4000/api/health 2>/dev/null)
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | grep "HTTP_CODE" | cut -d':' -f2)
if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ 健康检查正常（HTTP $HTTP_CODE）"
else
    echo "   ❌ 健康检查失败（HTTP $HTTP_CODE）"
fi
echo ""

# 3. 测试 PATCH /api/auth/me（无token，应该返回401或403）
echo "3️⃣  测试 PATCH /api/auth/me 端点（无token）..."
PATCH_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X PATCH http://localhost:4000/api/auth/me \
  -H "Content-Type: application/json" \
  -d '{"username":"test"}' 2>/dev/null)
PATCH_HTTP_CODE=$(echo "$PATCH_RESPONSE" | grep "HTTP_CODE" | cut -d':' -f2)
PATCH_BODY=$(echo "$PATCH_RESPONSE" | grep -v "HTTP_CODE")

if [ "$PATCH_HTTP_CODE" = "401" ] || [ "$PATCH_HTTP_CODE" = "403" ]; then
    echo "   ✅ 端点存在（HTTP $PATCH_HTTP_CODE，需要认证）"
    echo "   响应: $PATCH_BODY"
elif [ "$PATCH_HTTP_CODE" = "405" ]; then
    echo "   ⚠️  方法不允许（HTTP $PATCH_HTTP_CODE）"
    echo "   响应: $PATCH_BODY"
else
    echo "   ❌ 端点异常（HTTP $PATCH_HTTP_CODE）"
    echo "   响应: $PATCH_BODY"
fi
echo ""

# 4. 如果提供了邮箱和密码，尝试登录并测试
if [ -n "$1" ] && [ -n "$2" ]; then
    echo "4️⃣  测试登录并获取Token..."
    LOGIN_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST http://localhost:4000/api/auth/login \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"$1\",\"password\":\"$2\"}" 2>/dev/null)
    LOGIN_HTTP_CODE=$(echo "$LOGIN_RESPONSE" | grep "HTTP_CODE" | cut -d':' -f2)
    LOGIN_BODY=$(echo "$LOGIN_RESPONSE" | grep -v "HTTP_CODE")
    
    if [ "$LOGIN_HTTP_CODE" = "200" ]; then
        TOKEN=$(echo "$LOGIN_BODY" | grep -o '"token":"[^"]*"' | cut -d'"' -f4 || echo "")
        if [ -n "$TOKEN" ]; then
            echo "   ✅ 登录成功，Token已获取"
            echo ""
            
            echo "5️⃣  使用Token测试 PATCH /api/auth/me..."
            UPDATE_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X PATCH http://localhost:4000/api/auth/me \
              -H "Content-Type: application/json" \
              -H "Authorization: Bearer $TOKEN" \
              -d '{"username":"test_updated"}' 2>/dev/null)
            UPDATE_HTTP_CODE=$(echo "$UPDATE_RESPONSE" | grep "HTTP_CODE" | cut -d':' -f2)
            UPDATE_BODY=$(echo "$UPDATE_RESPONSE" | grep -v "HTTP_CODE")
            
            if [ "$UPDATE_HTTP_CODE" = "200" ]; then
                echo "   ✅ 更新用户名成功（HTTP $UPDATE_HTTP_CODE）"
                echo "   响应: $UPDATE_BODY"
            else
                echo "   ❌ 更新用户名失败（HTTP $UPDATE_HTTP_CODE）"
                echo "   响应: $UPDATE_BODY"
            fi
        else
            echo "   ⚠️  登录成功但未找到Token"
        fi
    else
        echo "   ❌ 登录失败（HTTP $LOGIN_HTTP_CODE）"
        echo "   响应: $LOGIN_BODY"
    fi
else
    echo "4️⃣  跳过Token测试（未提供邮箱和密码）"
    echo "   提示: 运行 bash scripts/diagnose-update-username.sh <email> <password> 进行完整测试"
fi
echo ""

# 5. 检查CORS配置
echo "6️⃣  检查CORS配置..."
if [ -f "src/server.js" ]; then
    if grep -q "cors" src/server.js; then
        echo "   ✅ CORS 中间件已配置"
        
        # 检查是否允许IP地址
        if grep -q "8.136.38.126\|origin.*true\|origin.*\*" src/server.js; then
            echo "   ✅ CORS 配置允许IP地址或所有来源"
        else
            echo "   ⚠️  CORS 配置可能未允许IP地址"
            echo "   请检查 FRONTEND_ORIGIN 环境变量"
        fi
    else
        echo "   ❌ 未找到 CORS 配置"
    fi
else
    echo "   ⚠️  未找到 server.js 文件"
fi
echo ""

# 6. 检查最近的错误日志
echo "7️⃣  检查最近的错误日志（最近20行）..."
if command -v pm2 >/dev/null 2>&1; then
    ERROR_LOGS=$(pm2 logs piccco-backend --lines 50 --nostream 2>/dev/null | grep -i "error\|failed\|auth\|me\|PATCH" | tail -20)
    if [ -n "$ERROR_LOGS" ]; then
        echo "   发现相关日志："
        echo "$ERROR_LOGS" | while read line; do
            echo "   $line"
        done
    else
        echo "   ℹ️  未发现相关错误日志"
    fi
fi
echo ""

echo "=========================================="
echo "✅ 诊断完成"
echo "=========================================="
echo ""
echo "📝 如果API端点正常但前端仍然报错，请检查："
echo "   1. 浏览器开发者工具 -> Network 标签"
echo "   2. 查看失败的请求："
echo "      - URL是否正确（应该是 /api/auth/me）"
echo "      - 方法是否为 PATCH"
echo "      - Headers中是否包含 Authorization: Bearer <token>"
echo "      - 响应状态码和错误信息"
echo "   3. 检查控制台是否有CORS错误"
echo "   4. 确认Token是否过期（尝试重新登录）"
echo ""

