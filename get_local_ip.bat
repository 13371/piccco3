@echo off
REM 获取本地IP地址（Windows）

echo 正在获取本地IP地址...
echo.

for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
    set IP=%%a
    set IP=!IP:~1!
    goto :found
)

:found
if "%IP%"=="" (
    echo 无法获取IP地址
    echo.
    echo 请手动运行: ipconfig
    exit /b 1
)

echo ==========================================
echo 本地IP地址: %IP%
echo ==========================================
echo.
echo 在移动设备上访问：
echo   前端: http://%IP%:5173
echo   后端: http://%IP%:4000
echo.
echo 确保：
echo   1. 手机和电脑连接到同一个WiFi
echo   2. 防火墙允许端口 5173 和 4000
echo.

pause

















