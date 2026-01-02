#!/bin/bash
# 启动开发服务器（Linux/Mac，支持移动端测试）

echo "========================================"
echo "启动开发服务器（支持移动端测试）"
echo "========================================"
echo ""

# 检查依赖
echo "1. 检查依赖..."
if [ ! -d "node_modules" ]; then
    echo "   安装前端依赖..."
    npm install
fi

if [ ! -d "backend/node_modules" ]; then
    echo "   安装后端依赖..."
    cd backend
    npm install
    cd ..
fi

echo ""
echo "2. 获取本地IP地址..."

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
fi

if [ -z "$IP" ]; then
    echo "   无法自动获取IP，请手动查看: ifconfig 或 ip addr"
    IP="你的IP地址"
else
    echo "   本地IP: $IP"
fi

echo ""
echo "3. 启动后端服务（端口 4000）..."
cd backend
npm start &
BACKEND_PID=$!
cd ..

echo ""
echo "等待后端启动..."
sleep 3

echo ""
echo "4. 启动前端开发服务器（端口 5173）..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "========================================"
echo "开发服务器已启动！"
echo "========================================"
echo ""
echo "本地访问："
echo "  前端: http://localhost:5173"
echo "  后端: http://localhost:4000"
echo ""
echo "移动设备访问（需在同一WiFi）："
echo "  前端: http://$IP:5173"
echo "  后端: http://$IP:4000"
echo ""
echo "提示："
echo "  - 确保手机和电脑连接到同一个WiFi"
echo "  - 如果无法访问，检查防火墙设置"
echo ""
echo "按 Ctrl+C 停止服务"
echo ""

# 等待用户中断
wait














