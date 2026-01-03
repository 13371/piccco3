# PostgreSQL 数据库迁移指南

## 📋 概述

本指南将帮助您将应用从JSON文件存储迁移到PostgreSQL数据库。

## ✅ 迁移特点

- ✅ **不改变接口路径** - 所有API接口保持不变
- ✅ **不改变返回结构** - 响应格式完全一致
- ✅ **不破坏现有逻辑** - 业务逻辑保持不变
- ✅ **逐步迁移** - 支持分阶段迁移
- ✅ **支持回滚** - 可以随时切回文件存储

## 🚀 快速开始

### 1. 安装PostgreSQL

#### Ubuntu/Debian
```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
```

#### macOS
```bash
brew install postgresql
```

#### Windows
下载并安装 [PostgreSQL](https://www.postgresql.org/download/windows/)

### 2. 创建数据库

```bash
# 登录PostgreSQL
sudo -u postgres psql

# 创建数据库和用户
CREATE DATABASE piccco;
CREATE USER piccco_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE piccco TO piccco_user;

# 退出
\q
```

### 3. 配置环境变量

在 `backend/.env` 文件中添加：

```env
# 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_NAME=piccco
DB_USER=piccco_user
DB_PASSWORD=your_password

# 存储模式配置
# 'file' - 仅使用文件存储（默认）
# 'db' - 仅使用数据库存储
# 'dual' - 双写模式（同时写入文件和数据库，优先从数据库读取）
STORAGE_MODE=file
```

### 4. 安装依赖

```bash
cd backend
npm install
```

### 5. 创建数据库Schema

```bash
# 方式1：使用迁移脚本
node -e "require('./src/db/migrations').createSchema().then(() => process.exit(0)).catch(() => process.exit(1))"

# 方式2：直接执行SQL文件
psql -U piccco_user -d piccco -f migrations/001_create_schema.sql
```

### 6. 迁移数据

```bash
# 执行数据迁移脚本
node scripts/migrate-to-db.js
```

### 7. 切换存储模式

在 `backend/.env` 中设置：

```env
# 切换到数据库模式
STORAGE_MODE=db
```

或者使用双写模式（推荐，用于过渡期）：

```env
# 双写模式：同时写入文件和数据库
STORAGE_MODE=dual
```

### 8. 重启服务器

```bash
npm start
```

## 📊 存储模式说明

### file 模式（默认）
- 仅使用JSON文件存储
- 适合开发环境或小规模应用
- 无需数据库连接

### db 模式
- 仅使用PostgreSQL数据库
- 适合生产环境
- 需要数据库连接

### dual 模式（推荐用于过渡期）
- 同时写入文件和数据库
- 优先从数据库读取，失败时回退到文件
- 适合迁移过渡期，确保数据安全

## 🔄 迁移步骤

### 阶段1：准备阶段
1. 安装PostgreSQL
2. 创建数据库
3. 配置环境变量
4. 创建数据库Schema

### 阶段2：数据迁移
1. 执行迁移脚本
2. 验证数据完整性
3. 测试功能

### 阶段3：切换存储（推荐使用dual模式）
1. 设置 `STORAGE_MODE=dual`
2. 重启服务器
3. 观察日志，确保双写正常

### 阶段4：完全切换
1. 验证数据库数据完整性
2. 设置 `STORAGE_MODE=db`
3. 重启服务器
4. 监控运行状态

## 🔙 回滚步骤

如果需要回滚到文件存储：

1. 设置 `STORAGE_MODE=file`
2. 重启服务器
3. 数据将从JSON文件读取

**注意**：回滚后，数据库中的数据不会自动同步回文件。如果需要同步，需要手动执行反向迁移。

## 🧪 验证迁移

### 1. 检查数据库连接

```bash
node -e "require('./src/db/config').checkConnection().then(r => console.log(r)).then(() => process.exit(0))"
```

### 2. 检查数据完整性

```sql
-- 检查用户数量
SELECT COUNT(*) FROM users;

-- 检查文件夹数量
SELECT COUNT(*) FROM folders;

-- 检查笔记数量
SELECT COUNT(*) FROM notes;

-- 检查URL数量
SELECT COUNT(*) FROM urls;

-- 检查消息数量
SELECT COUNT(*) FROM messages;
```

### 3. 功能测试

- 用户注册/登录
- 创建文件夹/笔记/URL
- 数据同步
- 消息发送/接收

## 📝 注意事项

1. **备份数据**：迁移前请备份所有JSON文件
2. **测试环境**：建议先在测试环境验证
3. **监控日志**：迁移后密切监控应用日志
4. **性能优化**：数据库模式下，可以调整连接池大小
5. **索引优化**：数据库已创建必要的索引，可根据实际使用情况调整

## 🐛 故障排查

### 数据库连接失败

检查：
- 数据库服务是否运行
- 环境变量配置是否正确
- 防火墙设置
- 用户权限

### 迁移失败

检查：
- 数据库Schema是否已创建
- JSON文件是否可读
- 数据库用户权限
- 日志错误信息

### 双写模式不一致

检查：
- 两个存储的数据是否一致
- 日志中的错误信息
- 网络连接

## 📚 相关文件

- `backend/migrations/001_create_schema.sql` - 数据库Schema
- `backend/migrations/002_rollback_schema.sql` - 回滚脚本
- `backend/src/db/config.js` - 数据库配置
- `backend/src/db/migrations.js` - 迁移工具
- `backend/src/db/dao/` - 数据访问层
- `backend/src/store/storageAdapter.js` - 存储适配器
- `backend/scripts/migrate-to-db.js` - 数据迁移脚本

## 🎯 下一步

迁移完成后，您可以：

1. 优化数据库查询性能
2. 添加数据库备份策略
3. 监控数据库性能
4. 考虑使用数据库连接池优化

---

**最后更新**：2026-01-03





