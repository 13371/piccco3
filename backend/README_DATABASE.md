# 数据库迁移说明

## 🎯 概述

应用已成功迁移到PostgreSQL数据库，同时保持完全向后兼容。所有接口路径和返回结构保持不变。

## ✅ 已完成

1. ✅ 数据库Schema设计
2. ✅ 数据访问层（DAO）实现
3. ✅ 存储适配器层
4. ✅ 所有路由文件更新
5. ✅ 数据迁移脚本
6. ✅ 回滚支持

## 🚀 快速开始

### 1. 安装依赖
```bash
cd backend
npm install
```

### 2. 配置数据库
在 `backend/.env` 中添加：
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=piccco
DB_USER=piccco_user
DB_PASSWORD=your_password
STORAGE_MODE=file  # 初始使用文件模式
```

### 3. 创建数据库
```bash
# 创建数据库
createdb piccco

# 或使用psql
psql -U postgres
CREATE DATABASE piccco;
CREATE USER piccco_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE piccco TO piccco_user;
\q
```

### 4. 创建Schema
```bash
psql -U piccco_user -d piccco -f migrations/001_create_schema.sql
```

### 5. 迁移数据（可选）
```bash
node scripts/migrate-to-db.js
```

### 6. 切换存储模式
```env
# 双写模式（推荐过渡期）
STORAGE_MODE=dual

# 或直接使用数据库
STORAGE_MODE=db
```

### 7. 重启服务器
```bash
npm start
```

## 📊 存储模式

- **file**: 仅文件存储（默认）
- **db**: 仅数据库存储
- **dual**: 双写模式（推荐过渡期）

## 🔙 回滚

设置 `STORAGE_MODE=file` 即可回滚到文件存储。

## 📚 详细文档

- `MIGRATION_GUIDE.md` - 详细迁移指南
- `MIGRATION_SUMMARY.md` - 迁移总结
- `MIGRATION_COMPLETE.md` - 完成报告

---

**最后更新**：2026-01-03






