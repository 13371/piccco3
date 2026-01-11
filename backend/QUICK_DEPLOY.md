# 快速部署指南（v1.20 - 使用数据库）

## 一键部署命令

在服务器上执行以下命令：

```bash
cd /www/wwwroot/piccco3/backend

# 1. 拉取最新代码
git pull origin main

# 2. 安装依赖
npm install

# 3. 配置环境变量（编辑 .env 文件）
# 确保包含以下配置：
# STORAGE_MODE=db
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=piccco
# DB_USER=your_db_user
# DB_PASSWORD=your_db_password

# 4. 初始化数据库（首次部署）
node scripts/init-db.js

# 5. 重启服务
pm2 restart piccco-backend

# 6. 查看状态
pm2 status
pm2 logs piccco-backend --lines 20
```

## 环境变量配置示例

在 `.env` 文件中添加/修改以下配置：

```env
# 存储模式：使用数据库
STORAGE_MODE=db

# 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_NAME=piccco
DB_USER=postgres
DB_PASSWORD=your_password_here
```

## 验证部署

```bash
# 检查服务状态
pm2 status

# 检查健康状态
curl http://localhost:4000/api/health

# 查看日志
pm2 logs piccco-backend
```

## 常见问题

1. **数据库连接失败**
   - 检查 PostgreSQL 是否运行：`sudo systemctl status postgresql`
   - 检查数据库配置是否正确
   - 检查数据库用户权限

2. **表已存在错误**
   - 如果表已存在，初始化脚本会跳过创建
   - 如需重新初始化，先删除现有表

3. **服务无法启动**
   - 检查 `.env` 文件配置
   - 查看日志：`pm2 logs piccco-backend --err`



























