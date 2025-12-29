@echo off
chcp 65001 >nul
echo ==========================================
echo 上传代码到GitHub仓库 piccco3
echo ==========================================
echo.

echo 请按照以下步骤操作：
echo.
echo 1. 打开你的GitHub仓库页面
echo 2. 点击绿色的 "<> 代码" 按钮
echo 3. 复制HTTPS地址（类似：https://github.com/用户名/piccco3.git）
echo.
set /p REPO_URL="请输入你的GitHub仓库地址: "

if "%REPO_URL%"=="" (
    echo 错误：未输入仓库地址
    pause
    exit /b 1
)

echo.
echo 正在添加远程仓库...
git remote add origin %REPO_URL%
if errorlevel 1 (
    echo 警告：远程仓库可能已存在，尝试更新...
    git remote set-url origin %REPO_URL%
)

echo.
echo 正在重命名分支为main...
git branch -M main

echo.
echo 正在推送代码到GitHub...
echo 注意：如果提示需要认证，请使用Personal Access Token（不是密码）
echo.
git push -u origin main

if errorlevel 1 (
    echo.
    echo ==========================================
    echo 推送失败！可能的原因：
    echo 1. 需要认证 - 请使用Personal Access Token
    echo 2. 仓库地址错误 - 请检查地址是否正确
    echo 3. 权限不足 - 确认你有仓库的写入权限
    echo.
    echo 获取Token：https://github.com/settings/tokens
    echo ==========================================
) else (
    echo.
    echo ==========================================
    echo 成功！代码已上传到GitHub
    echo ==========================================
)

pause

