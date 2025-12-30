#!/bin/bash
# 启动前后端服务脚本

cd /www/wwwroot/piccco3

echo "=" | head -c 70; echo
echo "检查并启动前后端服务"
echo "=" | head -c 70; echo

# 检查前端构建
echo ""
echo "1. 检查前端构建..."
if [ -d "dist" ]; then
    echo "   ✓ dist 目录存在"
    DIST_SIZE=$(du -sh dist | cut -f1)
    echo "   ✓ 构建文件大小: $DIST_SIZE"
else
    echo "   ✗ dist 目录不存在，需要先构建前端"
    echo "   执行: npm run build"
    exit 1
fi

# 检查后端文件
echo ""
echo "2. 检查后端文件..."
if [ -f "backend/src/server.js" ]; then
    echo "   ✓ backend/src/server.js 存在"
else
    echo "   ✗ backend/src/server.js 不存在"
    echo "   需要检查后端文件是否完整"
    exit 1
fi

# 检查后端 .env 文件
echo ""
echo "3. 检查后端环境配置..."
if [ -f "backend/.env" ]; then
    echo "   ✓ backend/.env 存在"
else
    echo "   ⚠ backend/.env 不存在，将使用默认配置"
fi

# 检查 PM2
echo ""
echo "4. 检查 PM2..."
if command -v pm2 &> /dev/null; then
    echo "   ✓ PM2 已安装"
    PM2_VERSION=$(pm2 -v)
    echo "   ✓ PM2 版本: $PM2_VERSION"
else
    echo "   ✗ PM2 未安装，正在安装..."
    npm install -g pm2
    if [ $? -eq 0 ]; then
        echo "   ✓ PM2 安装成功"
    else
        echo "   ✗ PM2 安装失败"
        exit 1
    fi
fi

# 检查后端依赖
echo ""
echo "5. 检查后端依赖..."
if [ -d "backend/node_modules" ]; then
    echo "   ✓ 后端依赖已安装"
else
    echo "   ⚠ 后端依赖未安装，正在安装..."
    cd backend
    npm install
    if [ $? -eq 0 ]; then
        echo "   ✓ 后端依赖安装成功"
    else
        echo "   ✗ 后端依赖安装失败"
        exit 1
    fi
    cd ..
fi

# 停止旧的后端服务（如果存在）
echo ""
echo "6. 停止旧的后端服务..."
pm2 stop piccco-backend 2>/dev/null
pm2 delete piccco-backend 2>/dev/null
echo "   ✓ 已清理旧服务"

# 启动后端服务
echo ""
echo "7. 启动后端服务..."
cd backend
pm2 start src/server.js --name piccco-backend --log-date-format "YYYY-MM-DD HH:mm:ss"
if [ $? -eq 0 ]; then
    echo "   ✓ 后端服务启动成功"
    pm2 save
    echo "   ✓ 已保存 PM2 配置"
else
    echo "   ✗ 后端服务启动失败"
    echo "   查看日志: pm2 logs piccco-backend"
    exit 1
fi
cd ..

# 显示服务状态
echo ""
echo "8. 服务状态:"
pm2 list

echo ""
echo "=" | head -c 70; echo
echo "启动完成！"
echo "=" | head -c 70; echo
echo ""
echo "后端服务:"
echo "  - 查看日志: pm2 logs piccco-backend"
echo "  - 查看状态: pm2 status"
echo "  - 重启服务: pm2 restart piccco-backend"
echo "  - 停止服务: pm2 stop piccco-backend"
echo ""
echo "下一步:"
echo "  1. 配置 Nginx 反向代理（前端和后端）"
echo "  2. 测试访问应用"
echo ""






