#!/bin/bash
# 获取本地IP地址（用于移动端测试）

echo "正在获取本地IP地址..."
echo ""

# 尝试多种方法获取IP
if [[ "$OSTYPE" == "darwin"* ]]; then
    # Mac
    IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)
    if [ -z "$IP" ]; then
        IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
    fi
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    IP=$(hostname -I | awk '{print $1}' 2>/dev/null)
    if [ -z "$IP" ]; then
        IP=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7}' | head -1)
    fi
    if [ -z "$IP" ]; then
        IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1 | sed 's/addr://')
    fi
else
    echo "不支持的操作系统，请手动获取IP地址"
    exit 1
fi

if [ -z "$IP" ]; then
    echo "无法自动获取IP地址"
    echo ""
    echo "请手动获取："
    echo "  Windows: ipconfig"
    echo "  Mac/Linux: ifconfig 或 ip addr"
    exit 1
fi

echo "=========================================="
echo "本地IP地址: $IP"
echo "=========================================="
echo ""
echo "在移动设备上访问："
echo "  前端: http://$IP:5173"
echo "  后端: http://$IP:4000"
echo ""
echo "确保："
echo "  1. 手机和电脑连接到同一个WiFi"
echo "  2. 防火墙允许端口 5173 和 4000"
echo ""

















