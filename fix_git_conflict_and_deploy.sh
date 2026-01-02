#!/bin/bash

# ==========================================
# 解决 Git 冲突并部署
# ==========================================

echo "=========================================="
echo "解决 Git 冲突并部署 Piccco3"
echo "=========================================="
echo ""

cd /www/wwwroot/piccco3

# 1. 备份当前修改（可选）
echo "1. 备份当前修改..."
if [ -n "$(git status --porcelain)" ]; then
    echo "   检测到本地修改，正在备份..."
    git stash push -m "备份部署前的本地修改 $(date +%Y%m%d_%H%M%S)"
    echo "   ✓ 已备份到 stash"
fi

# 2. 删除未跟踪的文件（.vite 等构建产物）
echo ""
echo "2. 清理未跟踪的文件..."
rm -rf .vite/
echo "   ✓ 已删除 .vite 目录"

# 3. 拉取最新代码
echo ""
echo "3. 拉取最新代码..."
git pull origin main

if [ $? -eq 0 ]; then
    echo "   ✓ 代码拉取成功"
else
    echo "   ✗ 代码拉取失败，请检查错误信息"
    exit 1
fi

# 4. 检查部署脚本
echo ""
echo "4. 检查部署脚本..."
if [ -f "deploy.sh" ]; then
    chmod +x deploy.sh
    echo "   ✓ deploy.sh 已准备就绪"
    
    # 5. 执行部署
    echo ""
    echo "5. 执行部署..."
    ./deploy.sh
else
    echo "   ⚠️  deploy.sh 不存在，使用快速部署脚本..."
    if [ -f "quick_deploy.sh" ]; then
        chmod +x quick_deploy.sh
        ./quick_deploy.sh
    else
        echo "   ✗ 未找到部署脚本，手动部署..."
        # 手动部署步骤
        echo "   安装依赖..."
        npm install
        cd backend && npm install && cd ..
        
        echo "   构建前端..."
        VITE_API_BASE_URL=/api npm run build
        
        echo "   设置权限..."
        chmod -R 755 dist
        chown -R www:www dist
        
        echo "   重启后端..."
        cd backend
        pm2 restart piccco-backend --update-env
        cd ..
        
        echo "   重载 Nginx..."
        nginx -s reload
        
        echo "   ✓ 手动部署完成"
    fi
fi

echo ""
echo "=========================================="
echo "✓ 部署完成！"
echo "=========================================="

