#!/bin/bash

# 修复 SESSION_SECRET 环境变量
# 使用方法：bash scripts/fix-session-secret.sh

echo "🔧 修复 SESSION_SECRET 环境变量..."
echo "=========================================="
echo ""

# 获取项目目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# 检查 .env 文件
if [ ! -f .env ]; then
    echo "❌ .env 文件不存在"
    exit 1
fi

# 检查是否已有 SESSION_SECRET
if grep -q "^SESSION_SECRET=" .env; then
    CURRENT_SECRET=$(grep "^SESSION_SECRET=" .env | cut -d'=' -f2 | tr -d ' ' | tr -d '"' | tr -d "'")
    if [ -n "$CURRENT_SECRET" ]; then
        echo "✅ SESSION_SECRET 已存在"
        echo "   当前值: ${CURRENT_SECRET:0:10}... (已隐藏)"
        echo ""
        echo "   如果应用仍然无法启动，可能需要重启应用："
        echo "   pm2 restart piccco-backend --update-env"
        exit 0
    else
        echo "⚠️  SESSION_SECRET 存在但为空，正在更新..."
    fi
else
    echo "⚠️  SESSION_SECRET 不存在，正在添加..."
fi

# 生成新的 SESSION_SECRET（32 字符的随机字符串）
NEW_SECRET=$(openssl rand -hex 32)

if [ -z "$NEW_SECRET" ]; then
    # 如果 openssl 不可用，使用其他方法生成
    NEW_SECRET=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)
fi

# 如果还是为空，使用默认值（不推荐，但至少能让应用启动）
if [ -z "$NEW_SECRET" ]; then
    NEW_SECRET="piccco-session-secret-change-me-in-production-$(date +%s)"
fi

# 更新或添加 SESSION_SECRET
if grep -q "^SESSION_SECRET=" .env; then
    # 更新现有值
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/^SESSION_SECRET=.*/SESSION_SECRET=$NEW_SECRET/" .env
    else
        # Linux
        sed -i "s/^SESSION_SECRET=.*/SESSION_SECRET=$NEW_SECRET/" .env
    fi
    echo "✅ 已更新 SESSION_SECRET"
else
    # 添加新值
    echo "" >> .env
    echo "# Session 密钥（用于加密 session cookie）" >> .env
    echo "SESSION_SECRET=$NEW_SECRET" >> .env
    echo "✅ 已添加 SESSION_SECRET"
fi

echo ""
echo "=========================================="
echo "✅ SESSION_SECRET 已设置"
echo "=========================================="
echo ""

# 重启应用
echo "🔄 重启应用..."
if command -v pm2 >/dev/null 2>&1; then
    # 先停止并删除
    pm2 stop piccco-backend 2>/dev/null
    pm2 delete piccco-backend 2>/dev/null
    sleep 2
    
    # 重新启动
    if [ -f "ecosystem.config.js" ]; then
        pm2 start ecosystem.config.js --update-env
    elif [ -f "src/server.js" ]; then
        pm2 start src/server.js --name piccco-backend --update-env
    else
        echo "❌ 未找到启动文件"
        exit 1
    fi
    
    pm2 save 2>/dev/null
    sleep 5
    
    # 检查状态
    PM2_STATUS=$(pm2 list | grep piccco-backend | awk '{print $10}' || echo "unknown")
    if [ "$PM2_STATUS" = "online" ]; then
        echo "✅ 应用已启动（状态: online）"
    else
        echo "⚠️  应用状态: $PM2_STATUS"
        echo "   查看日志: pm2 logs piccco-backend --lines 20"
    fi
else
    echo "⚠️  未找到 PM2，请手动重启应用"
fi
echo ""

# 测试健康检查
echo "🧪 测试健康检查..."
sleep 3
if command -v curl >/dev/null 2>&1; then
    HEALTH_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" http://localhost:4000/api/health 2>&1)
    HTTP_CODE=$(echo "$HEALTH_RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
    if [ "$HTTP_CODE" = "200" ]; then
        echo "✅ 健康检查通过 (HTTP $HTTP_CODE)"
    else
        echo "⚠️  健康检查失败 (HTTP $HTTP_CODE)"
        echo "   查看日志: pm2 logs piccco-backend --lines 30"
    fi
else
    echo "⚠️  未找到 curl，跳过健康检查"
fi
echo ""

echo "=========================================="
echo "修复完成！"
echo "=========================================="
echo ""
echo "📝 如果应用仍然无法启动，请查看日志："
echo "   pm2 logs piccco-backend --lines 50"
echo ""

