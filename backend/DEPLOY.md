# piccco v1.20 部署指南（使用数据库）

## 前置要求

1. **服务器环境**
   - Node.js (v16+)
   - PostgreSQL (v12+)
   - PM2 (进程管理)
   - Git

2. **数据库准备**
   - 已安装并运行 PostgreSQL
   - 已创建数据库（默认：`piccco`）
   - 已创建数据库用户并授权

## 部署步骤

### 1. 连接到服务器

```bash
ssh your-user@your-server-ip
```

### 2. 进入项目目录

```bash
cd /www/wwwroot/piccco3/backend
```

### 3. 拉取最新代码

```bash
git pull origin main
```

### 4. 安装/更新依赖

```bash
npm install
```

### 5. 配置环境变量

编辑 `.env` 文件，确保包含以下配置：

```env
# 服务器配置
NODE_ENV=production
PORT=4000
FRONTEND_ORIGIN=https://your-domain.com

# JWT 配置（必需）
JWT_SECRET=your-jwt-secret-at-least-32-characters
SESSION_SECRET=your-session-secret-at-least-32-characters

# 管理员密码（推荐使用哈希）
ADMIN_PASSWORD_HASH=$2a$10$your-hashed-password

# 存储模式：使用数据库
STORAGE_MODE=db

# 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_NAME=piccco
DB_USER=your-db-user
DB_PASSWORD=your-db-password

# 邮件服务配置（QQ邮箱）
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=z13371@qq.com
SMTP_PASS=sqyrwmowgvnogdea
```

### 6. 创建数据库（如果尚未创建）

```bash
# 连接到 PostgreSQL
sudo -u postgres psql

# 创建数据库
CREATE DATABASE piccco;

# 创建用户（如果还没有）
CREATE USER your_db_user WITH PASSWORD 'your_db_password';

# 授权
GRANT ALL PRIVILEGES ON DATABASE piccco TO your_db_user;

# 退出
\q
```

### 7. 初始化数据库表结构

```bash
cd /www/wwwroot/piccco3/backend
node -e "
const { isInitialized, createSchema } = require('./src/db/migrations');
const { initPool } = require('./src/db/config');

(async () => {
    try {
        initPool();
        const initialized = await isInitialized();
        if (!initialized) {
            console.log('数据库未初始化，开始创建表结构...');
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
```

### 8. 迁移现有数据（如果从文件存储迁移）

如果之前使用的是文件存储，需要迁移数据到数据库：

```bash
# 运行数据迁移脚本（如果有）
node scripts/migrate-file-to-db.js
```

### 9. 停止旧服务

```bash
pm2 stop piccco-backend
```

### 10. 启动新服务

```bash
pm2 start ecosystem.config.js
```

### 11. 保存 PM2 配置

```bash
pm2 save
```

### 12. 查看服务状态

```bash
pm2 status
pm2 logs piccco-backend
```

## 快速部署（使用脚本）

如果服务器上有 `deploy.sh` 脚本：

```bash
cd /www/wwwroot/piccco3/backend
chmod +x deploy.sh
./deploy.sh
```

## 验证部署

### 1. 检查服务状态

```bash
pm2 status
```

应该看到 `piccco-backend` 状态为 `online`。

### 2. 检查日志

```bash
pm2 logs piccco-backend --lines 50
```

查看是否有错误信息。

### 3. 检查数据库连接

访问健康检查接口：
```bash
curl http://localhost:4000/api/health
```

应该返回数据库连接状态。

### 4. 测试 API

```bash
curl http://localhost:4000/api/v1/data/sync
```

## 常见问题

### 1. 数据库连接失败

- 检查 PostgreSQL 是否运行：`sudo systemctl status postgresql`
- 检查数据库配置是否正确
- 检查防火墙是否允许连接
- 检查数据库用户权限

### 2. 表已存在错误

如果表已存在，可以跳过初始化，或者先删除表：

```sql
-- 连接到数据库
sudo -u postgres psql -d piccco

-- 删除所有表（谨慎操作！）
DROP TABLE IF EXISTS message_history CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS user_data CASCADE;
DROP TABLE IF EXISTS notes CASCADE;
DROP TABLE IF EXISTS urls CASCADE;
DROP TABLE IF EXISTS folders CASCADE;
DROP TABLE IF EXISTS users CASCADE;
```

### 3. PM2 服务无法启动

- 检查 `.env` 文件是否存在且配置正确
- 检查端口 4000 是否被占用：`lsof -i :4000`
- 查看详细错误：`pm2 logs piccco-backend --err`

### 4. 存储模式未切换

确保 `.env` 文件中设置了 `STORAGE_MODE=db`，然后重启服务：

```bash
pm2 restart piccco-backend
```

## 回滚到文件存储

如果需要回滚到文件存储：

1. 修改 `.env` 文件：`STORAGE_MODE=file`
2. 重启服务：`pm2 restart piccco-backend`

## 数据备份

在切换存储模式前，建议备份数据：

```bash
# 备份数据库
pg_dump -U your_db_user -d piccco > backup_$(date +%Y%m%d_%H%M%S).sql

# 备份文件存储（如果使用）
tar -czf data_backup_$(date +%Y%m%d_%H%M%S).tar.gz data/
```

## 更新 ecosystem.config.js

确保 `ecosystem.config.js` 包含数据库相关环境变量：

```javascript
env: {
  // ... 其他配置
  STORAGE_MODE: process.env.STORAGE_MODE || 'db',
  DB_HOST: process.env.DB_HOST,
  DB_PORT: process.env.DB_PORT,
  DB_NAME: process.env.DB_NAME,
  DB_USER: process.env.DB_USER,
  DB_PASSWORD: process.env.DB_PASSWORD,
}
```

## 监控和维护

- 查看服务状态：`pm2 status`
- 查看实时日志：`pm2 logs piccco-backend`
- 重启服务：`pm2 restart piccco-backend`
- 停止服务：`pm2 stop piccco-backend`
- 查看资源使用：`pm2 monit`



















