# PostgreSQL 迁移 - 快速开始指南

## 🚀 5分钟快速开始

### ⚠️ 重要提示

**如果您使用宝塔面板**，请先查看 **`BT_PANEL_POSTGRESQL_GUIDE.md`** 了解如何在宝塔面板中安装和配置 PostgreSQL。

### 步骤1：安装依赖（1分钟）
```bash
cd backend
npm install
```

### 步骤2：配置数据库（2分钟）

#### 2.1 创建数据库

**如果使用宝塔面板**：
1. 在宝塔面板中安装 PostgreSQL 管理器插件
2. 创建数据库 `piccco` 和用户 `piccco_user`
3. 记录密码

**如果直接使用 PostgreSQL**：
```sql
CREATE DATABASE piccco;
CREATE USER piccco_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE piccco TO piccco_user;
```

#### 2.2 配置环境变量
编辑 `backend/.env` 文件，添加：
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=piccco
DB_USER=piccco_user
DB_PASSWORD=your_password
STORAGE_MODE=file
```

### 步骤3：创建数据库Schema（1分钟）
```bash
psql -U piccco_user -d piccco -f migrations/001_create_schema.sql
```

### 步骤4：测试连接（30秒）
```bash
node test-db-connection.js
```

**如果看到 ✅ 数据库连接成功！**，说明配置正确。

### 步骤5：迁移数据（可选，1分钟）
```bash
node scripts/migrate-to-db.js
```

### 步骤6：切换到双写模式（30秒）
编辑 `.env` 文件：
```env
STORAGE_MODE=dual
```

重启服务器：
```bash
npm start
```

---

## 📋 详细步骤

如果需要更详细的说明，请查看：
- **`BT_PANEL_POSTGRESQL_GUIDE.md`** - 宝塔面板安装指南（**如果您使用宝塔面板，请先看这个！**）
- **`STEP_BY_STEP_GUIDE.md`** - 详细操作指南（推荐）
- **`MIGRATION_GUIDE.md`** - 完整迁移指南
- **`MIGRATION_COMPLETE.md`** - 完成报告

---

## ⚠️ 常见问题快速解决

### 问题1：找不到 psql 命令
**解决**：确保 PostgreSQL 已安装并添加到 PATH

### 问题2：数据库连接失败
**检查**：
1. PostgreSQL 服务是否运行
2. `.env` 配置是否正确
3. 密码是否正确

### 问题3：npm install 失败
**解决**：
```bash
npm cache clean --force
npm install
```

---

## 🎯 下一步

完成上述步骤后，您可以：
1. 测试应用功能
2. 验证数据一致性（运行 `node verify-data.js`）
3. 切换到纯数据库模式（`STORAGE_MODE=db`）

---

**需要帮助？** 查看 `STEP_BY_STEP_GUIDE.md` 获取详细说明。

