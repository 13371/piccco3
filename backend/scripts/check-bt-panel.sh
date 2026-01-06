#!/bin/bash
# 宝塔面板状态检查脚本

echo "=========================================="
echo "宝塔面板状态检查"
echo "=========================================="

# 1. 检查宝塔面板进程
echo "1. 检查宝塔面板进程..."
if pgrep -f "python.*panel" > /dev/null; then
    echo "✅ 宝塔面板进程正在运行"
    ps aux | grep -E "python.*panel|bt" | grep -v grep
else
    echo "❌ 宝塔面板进程未运行"
fi

echo ""

# 2. 检查端口
echo "2. 检查端口 37040..."
if netstat -tlnp 2>/dev/null | grep -q ":37040"; then
    echo "✅ 端口 37040 正在监听"
    netstat -tlnp | grep ":37040"
else
    echo "❌ 端口 37040 未监听"
    echo "   尝试查找其他端口..."
    netstat -tlnp 2>/dev/null | grep -E "python|panel" || echo "   未找到相关端口"
fi

echo ""

# 3. 检查宝塔面板配置
echo "3. 检查宝塔面板配置..."
if [ -f "/www/server/panel/data/port.pl" ]; then
    PORT=$(cat /www/server/panel/data/port.pl 2>/dev/null)
    echo "   配置的端口: $PORT"
else
    echo "   ⚠️  端口配置文件不存在"
fi

if [ -f "/www/server/panel/data/admin_path.pl" ]; then
    PATH=$(cat /www/server/panel/data/admin_path.pl 2>/dev/null)
    echo "   安全入口路径: $PATH"
else
    echo "   ⚠️  安全入口配置文件不存在"
fi

echo ""

# 4. 检查防火墙
echo "4. 检查防火墙..."
if command -v firewall-cmd &> /dev/null; then
    if systemctl is-active --quiet firewalld; then
        echo "   Firewalld 正在运行"
        firewall-cmd --list-ports 2>/dev/null | grep -q "37040" && echo "   ✅ 端口 37040 已开放" || echo "   ❌ 端口 37040 未开放"
    else
        echo "   Firewalld 未运行"
    fi
elif command -v ufw &> /dev/null; then
    if ufw status | grep -q "Status: active"; then
        echo "   UFW 正在运行"
        ufw status | grep -q "37040" && echo "   ✅ 端口 37040 已开放" || echo "   ❌ 端口 37040 未开放"
    else
        echo "   UFW 未运行"
    fi
else
    echo "   ⚠️  未检测到防火墙管理工具"
fi

echo ""

# 5. 检查 Nginx
echo "5. 检查 Nginx..."
if systemctl is-active --quiet nginx; then
    echo "✅ Nginx 正在运行"
    systemctl status nginx --no-pager -l | head -5
else
    echo "❌ Nginx 未运行"
fi

echo ""

# 6. 检查宝塔面板日志
echo "6. 检查宝塔面板日志（最近10行）..."
if [ -f "/www/server/panel/logs/error.log" ]; then
    echo "   错误日志:"
    tail -10 /www/server/panel/logs/error.log
else
    echo "   ⚠️  日志文件不存在"
fi

echo ""

# 7. 建议的修复命令
echo "=========================================="
echo "建议的修复步骤:"
echo "=========================================="
echo "1. 重启宝塔面板:"
echo "   /etc/init.d/bt restart"
echo ""
echo "2. 如果端口不对，检查配置:"
echo "   cat /www/server/panel/data/port.pl"
echo ""
echo "3. 如果设置了安全入口，检查路径:"
echo "   cat /www/server/panel/data/admin_path.pl"
echo ""
echo "4. 检查防火墙:"
echo "   firewall-cmd --list-ports"
echo "   # 如果需要开放端口:"
echo "   firewall-cmd --permanent --add-port=37040/tcp"
echo "   firewall-cmd --reload"
echo ""



















