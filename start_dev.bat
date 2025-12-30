@echo off
echo ========================================
echo 启动开发服务器
echo ========================================
echo.

echo 1. 检查依赖...
if not exist "node_modules" (
    echo 安装前端依赖...
    call npm install
)

if not exist "backend\node_modules" (
    echo 安装后端依赖...
    cd backend
    call npm install
    cd ..
)

echo.
echo 2. 启动后端服务（端口 4000）...
start "后端服务" cmd /k "cd backend && npm start"

echo.
echo 等待后端启动...
timeout /t 3 /nobreak >nul

echo.
echo 3. 启动前端开发服务器（端口 5173）...
start "前端开发服务器" cmd /k "npm run dev"

echo.
echo ========================================
echo 开发服务器已启动！
echo ========================================
echo.
echo 前端: http://localhost:5173
echo 后端: http://localhost:4000
echo.
echo 按任意键退出...
pause >nul







