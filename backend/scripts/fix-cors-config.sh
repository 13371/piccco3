#!/bin/bash

# 修复 CORS 配置
# 使用方法：bash scripts/fix-cors-config.sh

echo "🔧 修复 CORS 配置..."
echo ""

# 获取项目目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# 检查 .env 文件
if [ ! -f ".env" ]; then
    echo "❌ 未找到 .env 文件"
    exit 1
fi

# 检查 FRONTEND_ORIGIN 配置
echo "当前 FRONTEND_ORIGIN 配置："
grep "^FRONTEND_ORIGIN=" .env 2>/dev/null || echo "未设置 FRONTEND_ORIGIN"

echo ""
echo "建议的配置："
echo ""

# 获取服务器 IP（如果有）
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s ipinfo.io/ip 2>/dev/null || echo "")

if [ ! -z "$SERVER_IP" ]; then
    echo "检测到服务器 IP: $SERVER_IP"
    echo ""
    echo "建议在 .env 文件中设置："
    echo "  FRONTEND_ORIGIN=http://${SERVER_IP},http://${SERVER_IP}:5173,http://localhost:5173"
    echo ""
    echo "或者如果使用域名："
    echo "  FRONTEND_ORIGIN=http://your-domain.com,http://${SERVER_IP}"
    echo ""
    read -p "是否自动更新 .env 文件？(y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # 备份 .env
        cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
        
        # 更新或添加 FRONTEND_ORIGIN
        if grep -q "^FRONTEND_ORIGIN=" .env; then
            # 更新现有配置
            sed -i "s|^FRONTEND_ORIGIN=.*|FRONTEND_ORIGIN=http://${SERVER_IP},http://${SERVER_IP}:5173,http://localhost:5173|" .env
        else
            # 添加新配置
            echo "" >> .env
            echo "FRONTEND_ORIGIN=http://${SERVER_IP},http://${SERVER_IP}:5173,http://localhost:5173" >> .env
        fi
        
        echo "✅ .env 文件已更新"
        echo ""
        echo "新的配置："
        grep "^FRONTEND_ORIGIN=" .env
    fi
else
    echo "无法自动检测服务器 IP"
    echo ""
    echo "请手动在 .env 文件中设置 FRONTEND_ORIGIN，例如："
    echo "  FRONTEND_ORIGIN=http://8.136.38.126,http://8.136.38.126:5173,http://localhost:5173"
fi

echo ""
echo "=========================================="
echo "📝 下一步："
echo "=========================================="
echo "1. 确认 .env 中的 FRONTEND_ORIGIN 配置正确"
echo "2. 重启应用: pm2 restart piccco-backend --update-env"
echo "3. 检查日志: pm2 logs piccco-backend | grep -i cors"
echo ""

