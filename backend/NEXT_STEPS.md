# 下一步操作指南

## ✅ 当前状态

- ✅ 数据库连接成功
- ✅ 代码已同步到服务器
- ✅ 依赖已安装

## 📋 下一步操作

### 步骤 1：初始化数据库表结构

在服务器上执行：

```bash
cd /www/wwwroot/piccco3/backend
node init-db.js
```

这将创建所有必需的数据表。

### 步骤 2：选择存储模式

在 `.env` 文件中设置 `STORAGE_MODE`：

```bash
# 编辑 .env 文件
nano .env
```

添加或修改以下配置：

```env
# 存储模式选项：
# - file: 仅使用文件存储（当前模式）
# - db: 仅使用数据库存储
# - dual: 双写模式（同时写入文件和数据库，优先读取数据库）

STORAGE_MODE=file
```

**推荐配置：**

1. **测试阶段**：使用 `STORAGE_MODE=dual`
   - 同时写入文件和数据库
   - 读取优先使用数据库，失败时回退到文件
   - 可以安全地测试数据库功能

2. **生产环境**：确认数据库稳定后，切换到 `STORAGE_MODE=db`
   - 仅使用数据库存储
   - 性能更好，数据更安全

### 步骤 3：迁移现有数据（可选）

如果您想将现有的 JSON 文件数据迁移到数据库：

```bash
cd /www/wwwroot/piccco3/backend
node scripts/migrate-to-db.js
```

**注意**：
- 迁移前请备份数据
- 建议在 `STORAGE_MODE=dual` 模式下先测试
- 迁移后使用 `verify-data.js` 验证数据一致性

### 步骤 4：验证数据（迁移后）

如果执行了数据迁移，验证数据一致性：

```bash
node verify-data.js
```

### 步骤 5：重启后端服务

修改配置后，需要重启后端服务：

```bash
# 如果使用 PM2
pm2 restart piccco3-backend

# 或者手动重启
# 停止当前进程，然后重新启动
```

## 🔄 回滚方案

如果需要回滚到文件存储：

1. 修改 `.env`：
   ```env
   STORAGE_MODE=file
   ```

2. 重启后端服务

3. （可选）如果需要删除数据库表：
   ```bash
   node -e "const {rollbackSchema} = require('./src/db/migrations'); rollbackSchema().then(() => process.exit(0)).catch(e => {console.error(e); process.exit(1);})"
   ```

## 📝 检查清单

- [ ] 执行 `node init-db.js` 创建表结构
- [ ] 配置 `.env` 中的 `STORAGE_MODE`
- [ ] （可选）执行数据迁移
- [ ] （可选）验证数据一致性
- [ ] 重启后端服务
- [ ] 测试应用功能

## 🆘 遇到问题？

1. **表已存在错误**：说明数据库已经初始化过，可以跳过步骤 1
2. **连接失败**：检查 `.env` 中的数据库配置
3. **权限错误**：确保数据库用户有创建表的权限




