#!/bin/bash
# piccco 后端部署脚本
# 用于部署到服务器并切换到数据库模式

set -e  # 遇到错误立即退出

echo "=========================================="
echo "piccco 后端部署脚本 v1.20"
echo "=========================================="

# 配置变量
PROJECT_DIR="/www/wwwroot/piccco3"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR"

# 检查目录是否存在
if [ ! -d "$BACKEND_DIR" ]; then
    echo "错误: 后端目录不存在: $BACKEND_DIR"
    exit 1
fi

echo "1. 进入后端目录..."
cd "$BACKEND_DIR"

echo "2. 从 GitHub 拉取最新代码..."
git pull origin main

echo "3. 安装/更新依赖..."
npm install

echo "4. 检查 .env 文件..."
if [ ! -f ".env" ]; then
    echo "警告: .env 文件不存在，请先创建并配置环境变量"
    exit 1
fi

echo "5. 检查数据库配置..."
# 检查必要的数据库环境变量
if ! grep -q "STORAGE_MODE=db" .env; then
    echo "警告: .env 文件中未设置 STORAGE_MODE=db"
    echo "请确保 .env 文件包含以下配置："
    echo "  STORAGE_MODE=db"
    echo "  DB_HOST=your-db-host"
    echo "  DB_PORT=5432"
    echo "  DB_NAME=piccco"
    echo "  DB_USER=your-db-user"
    echo "  DB_PASSWORD=your-db-password"
    read -p "是否继续部署？(y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "6. 初始化数据库（如果需要）..."
# 检查数据库是否已初始化
node -e "
const { isInitialized } = require('./src/db/migrations');
const { initPool } = require('./src/db/config');

(async () => {
    try {
        initPool();
        const initialized = await isInitialized();
        if (!initialized) {
            console.log('数据库未初始化，开始创建表结构...');
            const { createSchema } = require('./src/db/migrations');
            await createSchema();
            console.log('数据库初始化完成');
        } else {
            console.log('数据库已初始化，跳过创建表结构');
        }
        process.exit(0);
    } catch (error) {
        console.error('数据库初始化失败:', error.message);
        process.exit(1);
    }
})();
"

echo "7. 停止旧服务..."
pm2 stop piccco-backend || echo "服务未运行，跳过停止"

echo "8. 启动新服务..."
pm2 start ecosystem.config.js

echo "9. 保存 PM2 配置..."
pm2 save

echo "10. 查看服务状态..."
pm2 status

echo ""
echo "=========================================="
echo "部署完成！"
echo "=========================================="
echo "服务状态: pm2 status"
echo "查看日志: pm2 logs piccco-backend"
echo "重启服务: pm2 restart piccco-backend"
echo "=========================================="


























