#!/bin/bash
# 启动开发服务器（Linux/Mac）

echo "========================================"
echo "启动开发服务器"
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
echo "2. 启动后端服务（端口 4000）..."
cd backend
npm start &
BACKEND_PID=$!
cd ..

echo ""
echo "等待后端启动..."
sleep 3

echo ""
echo "3. 启动前端开发服务器（端口 5173）..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "========================================"
echo "开发服务器已启动！"
echo "========================================"
echo ""
echo "前端: http://localhost:5173"
echo "后端: http://localhost:4000"
echo ""
echo "按 Ctrl+C 停止服务"
echo ""

# 等待用户中断
wait






