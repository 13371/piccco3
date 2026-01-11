#!/bin/bash
# 检查宝塔面板 404 问题

echo "=========================================="
echo "宝塔面板 404 问题诊断"
echo "=========================================="

# 1. 检查宝塔面板服务状态
echo ""
echo "1. 检查宝塔面板服务状态..."
if systemctl is-active --quiet bt; then
    echo "✅ 宝塔面板服务正在运行"
else
    echo "❌ 宝塔面板服务未运行"
    echo "   尝试启动: /etc/init.d/bt start"
fi

# 2. 检查端口监听
echo ""
echo "2. 检查端口 37040 监听状态..."
if netstat -tlnp 2>/dev/null | grep -q ":37040"; then
    echo "✅ 端口 37040 正在监听"
    netstat -tlnp | grep ":37040"
else
    echo "❌ 端口 37040 未监听"
    echo "   可能的原因："
    echo "   - 宝塔面板服务未启动"
    echo "   - 端口配置错误"
fi

# 3. 检查安全入口路径
echo ""
echo "3. 检查安全入口路径..."
if [ -f /www/server/panel/data/admin_path.pl ]; then
    ADMIN_PATH=$(cat /www/server/panel/data/admin_path.pl 2>/dev/null)
    if [ -n "$ADMIN_PATH" ]; then
        echo "✅ 安全入口路径: $ADMIN_PATH"
        echo "   正确的访问地址应该是:"
        echo "   https://8.136.38.126:37040$ADMIN_PATH"
        echo "   或"
        echo "   http://8.136.38.126:37040$ADMIN_PATH"
    else
        echo "⚠️  安全入口路径为空（可能未设置）"
        echo "   尝试访问: https://8.136.38.126:37040"
    fi
else
    echo "⚠️  无法读取安全入口路径配置文件"
fi

# 4. 检查端口配置
echo ""
echo "4. 检查端口配置..."
if [ -f /www/server/panel/data/port.pl ]; then
    PORT=$(cat /www/server/panel/data/port.pl 2>/dev/null)
    echo "✅ 宝塔面板端口: $PORT"
    if [ "$PORT" != "37040" ]; then
        echo "⚠️  端口不匹配！配置的端口是 $PORT，但访问的是 37040"
    fi
else
    echo "⚠️  无法读取端口配置文件"
fi

# 5. 检查防火墙
echo ""
echo "5. 检查防火墙..."
if command -v firewall-cmd &> /dev/null; then
    if firewall-cmd --list-ports 2>/dev/null | grep -q "37040"; then
        echo "✅ 端口 37040 已在防火墙中开放"
    else
        echo "⚠️  端口 37040 未在防火墙中开放"
        echo "   开放命令: firewall-cmd --permanent --add-port=37040/tcp && firewall-cmd --reload"
    fi
elif command -v ufw &> /dev/null; then
    if ufw status | grep -q "37040"; then
        echo "✅ 端口 37040 已在防火墙中开放"
    else
        echo "⚠️  端口 37040 未在防火墙中开放"
        echo "   开放命令: ufw allow 37040/tcp"
    fi
else
    echo "⚠️  未检测到防火墙工具"
fi

# 6. 检查 Nginx（如果使用）
echo ""
echo "6. 检查 Nginx 状态..."
if systemctl is-active --quiet nginx; then
    echo "✅ Nginx 正在运行"
    echo "   检查 Nginx 配置: nginx -t"
else
    echo "⚠️  Nginx 未运行（如果使用 Nginx 代理，需要启动）"
fi

# 7. 检查宝塔面板日志
echo ""
echo "7. 检查宝塔面板错误日志（最近 20 行）..."
if [ -f /www/server/panel/logs/error.log ]; then
    echo "--- 错误日志 ---"
    tail -20 /www/server/panel/logs/error.log
else
    echo "⚠️  错误日志文件不存在"
fi

# 8. 总结和建议
echo ""
echo "=========================================="
echo "诊断总结"
echo "=========================================="
echo ""
echo "如果访问 https://8.136.38.126:37040/home 返回 404："
echo ""
echo "1. 确认访问的是宝塔面板还是前端应用："
echo "   - 宝塔面板: https://8.136.38.126:37040/安全入口路径"
echo "   - 前端应用: http://8.136.38.126 (80端口)"
echo ""
echo "2. 如果访问宝塔面板，需要加上安全入口路径"
echo "   查看安全入口: cat /www/server/panel/data/admin_path.pl"
echo ""
echo "3. 如果访问前端应用，应该使用 80 端口，不是 37040"
echo ""
echo "4. 快速修复命令："
echo "   /etc/init.d/bt restart"
echo ""

