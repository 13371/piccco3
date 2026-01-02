#!/bin/bash

# 快速部署脚本 - 适用于日常修改后的快速部署

echo "=========================================="
echo "快速部署 piccco3"
echo "=========================================="

cd /www/wwwroot/piccco3

# 检查是否有未提交的更改
if [ -n "$(git status --porcelain)" ]; then
    echo ""
    echo "⚠️  检测到未提交的更改"
    read -p "是否继续部署？(y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "部署已取消"
        exit 1
    fi
fi

# 1. 拉取最新代码（可选）
read -p "是否从Git拉取最新代码？(y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "1. 拉取最新代码..."
    git pull origin main
    if [ $? -ne 0 ]; then
        echo "   ✗ Git拉取失败，继续使用本地代码"
    else
        echo "   ✓ Git拉取成功"
    fi
fi

# 2. 检查修改类型
echo ""
echo "2. 检测修改类型..."
HAS_FRONTEND_CHANGES=false
HAS_BACKEND_CHANGES=false

# 检查前端文件是否有修改
if git diff --name-only HEAD | grep -E "^(src/|index.html|package.json|vite.config)" > /dev/null; then
    HAS_FRONTEND_CHANGES=true
    echo "   ✓ 检测到前端文件修改"
fi

# 检查后端文件是否有修改
if git diff --name-only HEAD | grep -E "^backend/" > /dev/null; then
    HAS_BACKEND_CHANGES=true
    echo "   ✓ 检测到后端文件修改"
fi

# 如果没有检测到修改，询问是否强制重新部署
if [ "$HAS_FRONTEND_CHANGES" = false ] && [ "$HAS_BACKEND_CHANGES" = false ]; then
    echo "   ⚠️  未检测到文件修改"
    read -p "是否强制重新部署前端和后端？(y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        HAS_FRONTEND_CHANGES=true
        HAS_BACKEND_CHANGES=true
    else
        echo "部署已取消"
        exit 0
    fi
fi

# 3. 部署前端（如果需要）
if [ "$HAS_FRONTEND_CHANGES" = true ]; then
    echo ""
    echo "3. 部署前端..."
    
    # 清理 dist 目录
    echo "   清理旧的构建文件..."
    if [ -f "dist/.user.ini" ]; then
        chattr -i dist/.user.ini 2>/dev/null || true
        chmod 644 dist/.user.ini 2>/dev/null || true
        rm -f dist/.user.ini 2>/dev/null || true
    fi
    rm -rf dist
    
    # 构建前端
    echo "   构建前端..."
    VITE_API_BASE_URL=/api npm run build
    
    if [ $? -eq 0 ]; then
        echo "   ✓ 前端构建成功"
        
        # 设置权限
        chmod -R 755 dist
        chown -R www:www dist
        
        # 重启 Nginx
        echo "   重启 Nginx..."
        nginx -s reload
        echo "   ✓ Nginx 已重启"
    else
        echo "   ✗ 前端构建失败"
        exit 1
    fi
fi

# 4. 部署后端（如果需要）
if [ "$HAS_BACKEND_CHANGES" = true ]; then
    echo ""
    echo "4. 部署后端..."
    
    # 检查 .env 文件是否修改
    if git diff --name-only HEAD | grep -E "^backend/\.env" > /dev/null; then
        echo "   ⚠️  检测到 .env 文件修改，将更新环境变量"
        UPDATE_ENV="--update-env"
    else
        UPDATE_ENV=""
    fi
    
    # 重启 PM2 服务
    echo "   重启后端服务..."
    pm2 restart piccco-backend $UPDATE_ENV
    
    if [ $? -eq 0 ]; then
        echo "   ✓ 后端服务已重启"
        
        # 显示服务状态
        echo ""
        echo "   后端服务状态："
        pm2 status piccco-backend
    else
        echo "   ✗ 后端服务重启失败"
        exit 1
    fi
fi

echo ""
echo "=========================================="
echo "✓ 部署完成！"
echo "=========================================="
echo ""
echo "访问地址："
echo "  - 前端: http://8.136.38.126"
echo "  - 管理员: http://8.136.38.126/admin"
echo ""
echo "检查服务状态："
echo "  - PM2状态: pm2 status"
echo "  - PM2日志: pm2 logs piccco-backend"
echo "  - Nginx状态: nginx -t"
echo ""

















