@echo off
setlocal enabledelayedexpansion
echo ========================================
echo 启动开发服务器（支持移动端测试）
echo ========================================
echo.

REM 切换到项目目录
cd /d "%~dp0"

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
echo 2. 获取本地IP地址...
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
    set IP=%%a
    set IP=!IP:~1!
    goto :found_ip
)

:found_ip
if "%IP%"=="" (
    echo   无法自动获取IP，请手动查看: ipconfig
    set IP=你的IP地址
)

echo    本地IP: %IP%
echo.

echo 3. 启动后端服务（端口 4000）...
start "后端服务" cmd /k "cd /d %~dp0backend && npm start"

echo.
echo 等待后端启动...
timeout /t 3 /nobreak >nul

echo.
echo 4. 启动前端开发服务器（端口 5173）...
start "前端开发服务器" cmd /k "cd /d %~dp0 && npm run dev"

echo.
echo ========================================
echo 开发服务器已启动！
echo ========================================
echo.
echo 本地访问：
echo   前端: http://localhost:5173
echo   后端: http://localhost:4000
echo.
echo 移动设备访问（需在同一WiFi）：
echo   前端: http://%IP%:5173
echo   后端: http://%IP%:4000
echo.
echo 提示：
echo   - 确保手机和电脑连接到同一个WiFi
echo   - 如果无法访问，检查防火墙设置
echo.
echo 按任意键退出...
pause >nul














