#!/bin/bash
# piccco 前端部署脚本

set -e  # 遇到错误立即退出

echo "=========================================="
echo "piccco 前端部署脚本 v1.20"
echo "=========================================="

# 配置变量
PROJECT_DIR="/www/wwwroot/piccco3"
FRONTEND_DIR="$PROJECT_DIR"

# 检查目录是否存在
if [ ! -d "$FRONTEND_DIR" ]; then
    echo "错误: 前端目录不存在: $FRONTEND_DIR"
    exit 1
fi

echo "1. 进入前端目录..."
cd "$FRONTEND_DIR"

echo "2. 从 GitHub 拉取最新代码..."
git pull origin main

echo "3. 安装/更新依赖..."
npm install

echo "4. 构建前端（生产环境）..."
npm run build

echo "5. 检查构建输出..."
if [ -d "dist" ]; then
    echo "✅ 构建成功，dist 目录已创建"
    echo "   文件数量: $(find dist -type f | wc -l)"
    echo "   总大小: $(du -sh dist | cut -f1)"
else
    echo "❌ 构建失败，dist 目录不存在"
    exit 1
fi

echo ""
echo "=========================================="
echo "前端构建完成！"
echo "=========================================="
echo "构建输出目录: dist/"
echo ""
echo "下一步："
echo "1. 如果使用 Nginx，将 dist/ 目录内容复制到网站根目录"
echo "2. 或者配置 Nginx 指向 dist/ 目录"
echo "3. 重启 Nginx: systemctl restart nginx"
echo "=========================================="


























