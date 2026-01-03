#!/bin/bash

# 查看登录相关日志
# 使用方法：bash scripts/view-login-logs.sh

echo "📋 查看登录相关日志..."
echo "=========================================="
echo ""

# 获取项目目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# 查看最近的登录相关日志
echo "最近的登录相关日志（最近 50 行）："
echo ""

if command -v pm2 >/dev/null 2>&1; then
    pm2 logs piccco-backend --lines 100 --nostream | grep -i "login\|auth\|verifyPassword\|密码\|password\|邮箱\|email" | tail -30
else
    echo "⚠️  未找到 PM2"
fi

echo ""
echo "=========================================="
echo "💡 提示："
echo "1. 如果看到 '密码验证失败'，说明密码不匹配"
echo "2. 如果看到 '密码格式不正确'，需要重置密码"
echo "3. 实时查看日志: pm2 logs piccco-backend | grep -i login"
echo ""

