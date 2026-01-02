#!/bin/bash

# 服务器构建修复脚本
# 用于强制更新代码并重新构建前端

set -e  # 遇到错误立即退出

echo "=========================================="
echo "开始修复服务器构建问题..."
echo "=========================================="

cd /www/wwwroot/piccco3

echo ""
echo "1. 检查当前 Git 状态..."
git status

echo ""
echo "2. 获取远程最新代码..."
git fetch origin

echo ""
echo "3. 强制重置到远程 main 分支（会覆盖本地修改）..."
git reset --hard origin/main

echo ""
echo "4. 检查更新后的提交版本..."
git log --oneline -1

echo ""
echo "5. 清理构建缓存..."
rm -rf node_modules/.vite
rm -rf dist

echo ""
echo "6. 检查文件编码..."
file src/pages/CategoryPage.tsx src/pages/UrlPage.tsx || echo "文件检查完成"

echo ""
echo "7. 验证关键文件内容（前几行）..."
echo "--- CategoryPage.tsx 第 47-55 行 ---"
sed -n '47,55p' src/pages/CategoryPage.tsx || echo "无法读取文件"
echo ""
echo "--- UrlPage.tsx 第 138-146 行 ---"
sed -n '138,146p' src/pages/UrlPage.tsx || echo "无法读取文件"

echo ""
echo "8. 开始重新构建前端..."
npm run build

echo ""
echo "=========================================="
echo "构建完成！"
echo "=========================================="























