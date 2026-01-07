#!/bin/bash
# 宝塔面板修复脚本

echo "=========================================="
echo "宝塔面板修复脚本"
echo "=========================================="

# 1. 检查宝塔面板服务
echo "1. 检查宝塔面板服务状态..."
if systemctl is-active --quiet bt; then
    echo "✅ 宝塔面板服务正在运行"
else
    echo "❌ 宝塔面板服务未运行，正在启动..."
    /etc/init.d/bt restart
    sleep 3
fi

# 2. 检查端口
echo ""
echo "2. 检查端口 37040..."
PORT=$(cat /www/server/panel/data/port.pl 2>/dev/null || echo "未找到")
echo "   配置的端口: $PORT"

if netstat -tlnp 2>/dev/null | grep -q ":37040"; then
    echo "✅ 端口 37040 正在监听"
else
    echo "❌ 端口 37040 未监听"
    echo "   尝试重启宝塔面板..."
    /etc/init.d/bt restart
    sleep 5
    if netstat -tlnp 2>/dev/null | grep -q ":37040"; then
        echo "✅ 端口已启动"
    else
        echo "❌ 端口仍未启动，请检查防火墙和宝塔面板日志"
    fi
fi

# 3. 检查安全入口
echo ""
echo "3. 检查安全入口路径..."
if [ -f "/www/server/panel/data/admin_path.pl" ]; then
    ADMIN_PATH=$(cat /www/server/panel/data/admin_path.pl 2>/dev/null)
    if [ -n "$ADMIN_PATH" ]; then
        echo "   ⚠️  已设置安全入口: $ADMIN_PATH"
        echo "   访问地址应该是: https://8.136.38.126:37040/$ADMIN_PATH"
    else
        echo "   ✅ 未设置安全入口"
    fi
else
    echo "   ✅ 未设置安全入口"
fi

# 4. 检查防火墙
echo ""
echo "4. 检查防火墙..."
if command -v firewall-cmd &> /dev/null; then
    if systemctl is-active --quiet firewalld; then
        if firewall-cmd --list-ports 2>/dev/null | grep -q "37040"; then
            echo "✅ 端口 37040 已在防火墙中开放"
        else
            echo "⚠️  端口 37040 未在防火墙中开放"
            read -p "是否开放端口 37040? (y/n) " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                firewall-cmd --permanent --add-port=37040/tcp
                firewall-cmd --reload
                echo "✅ 端口已开放"
            fi
        fi
    else
        echo "   Firewalld 未运行"
    fi
fi

# 5. 查看宝塔面板日志
echo ""
echo "5. 查看宝塔面板日志（最近10行）..."
if [ -f "/www/server/panel/logs/error.log" ]; then
    echo "   错误日志:"
    tail -10 /www/server/panel/logs/error.log
else
    echo "   ⚠️  日志文件不存在"
fi

# 6. 尝试修复
echo ""
echo "6. 尝试修复宝塔面板..."
/etc/init.d/bt restart
sleep 3

# 7. 显示访问信息
echo ""
echo "=========================================="
echo "访问信息"
echo "=========================================="
PORT=$(cat /www/server/panel/data/port.pl 2>/dev/null || echo "37040")
ADMIN_PATH=$(cat /www/server/panel/data/admin_path.pl 2>/dev/null || echo "")

if [ -n "$ADMIN_PATH" ]; then
    echo "访问地址: https://8.136.38.126:$PORT/$ADMIN_PATH"
else
    echo "访问地址: https://8.136.38.126:$PORT"
fi

echo ""
echo "如果仍然无法访问，请检查："
echo "1. 服务器防火墙是否开放端口 $PORT"
echo "2. 云服务器安全组是否开放端口 $PORT"
echo "3. 宝塔面板服务是否正常运行: systemctl status bt"
echo "=========================================="




















