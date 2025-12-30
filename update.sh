#!/bin/bash
# 项目自动更新脚本

echo "开始更新项目..."

cd /www/wwwroot/piccco3

# 拉取最新代码
echo "拉取最新代码..."
git pull origin main

# 更新后端依赖
echo "更新后端依赖..."
cd backend
npm install --production

# 重启后端服务
echo "重启后端服务..."
pm2 restart piccco-backend

# 更新前端依赖
echo "更新前端依赖..."
cd ..
npm install

# 构建前端
echo "构建前端..."
npm run build

echo "更新完成！"
echo "请检查服务状态：pm2 status"


