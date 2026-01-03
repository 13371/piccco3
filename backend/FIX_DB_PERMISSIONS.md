# 修复数据库权限问题

## 问题描述

应用日志显示 `permission denied for table users` 错误，这是因为应用使用的数据库用户没有访问表的权限。

## 快速修复方法（推荐）

### 方法 1: 使用宝塔面板执行 SQL（最简单）

1. **打开宝塔面板** → **数据库** → **PostgreSQL**
2. **找到数据库 `piccco`**，点击 **"管理"** 或 **"SQL"** 按钮
3. **复制以下 SQL 并执行**：

```sql
-- 授予 public schema 权限
GRANT USAGE ON SCHEMA public TO postgres;

-- 授予所有表权限
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO postgres;

-- 授予所有序列权限
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO postgres;

-- 授予未来创建的表和序列的默认权限
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO postgres;
```

**注意**：如果应用使用的数据库用户不是 `postgres`，请将上面 SQL 中的 `postgres` 替换为实际用户名（查看 `.env` 文件中的 `DB_USER` 变量）。

### 方法 2: 使用命令行执行 SQL

```bash
# 进入项目目录
cd /www/wwwroot/piccco3/backend

# 执行 SQL 脚本
/www/server/pgsql/bin/psql -U postgres -d piccco -f scripts/fix-db-permissions-simple.sql
```

### 方法 3: 使用 Node.js 脚本

```bash
# 进入项目目录
cd /www/wwwroot/piccco3/backend

# 运行权限修复脚本
node scripts/fix-db-permissions.js
```

## 验证修复

执行权限修复后，验证是否成功：

```bash
# 方法 1: 检查应用日志（应该不再有权限错误）
pm2 logs piccco-backend --lines 50 | grep -i "permission\|error"

# 方法 2: 测试数据库连接
/www/server/pgsql/bin/psql -U postgres -d piccco -c "SELECT COUNT(*) FROM users;"

# 方法 3: 访问健康检查接口
curl http://localhost:4000/api/health/detailed
```

## 常见问题

### Q: 如何查看应用使用的数据库用户名？

A: 查看 `.env` 文件中的 `DB_USER` 变量，或查看 `backend/src/db/config.js` 中的默认值（默认是 `postgres`）。

```bash
cd /www/wwwroot/piccco3/backend
grep DB_USER .env
```

### Q: 如果用户名不是 `postgres` 怎么办？

A: 将 SQL 脚本中的 `postgres` 替换为你的实际用户名。例如，如果用户名是 `piccco_user`：

```sql
GRANT USAGE ON SCHEMA public TO piccco_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO piccco_user;
-- ... 其他权限
```

### Q: 执行后仍然有权限错误？

A: 检查以下几点：

1. **确认用户名正确**：查看 `.env` 文件中的 `DB_USER`
2. **确认数据库名正确**：查看 `.env` 文件中的 `DB_NAME`（默认是 `piccco`）
3. **重启应用**：`pm2 restart piccco-backend`
4. **查看详细错误**：`pm2 logs piccco-backend --err`

## 权限说明

授予的权限包括：

- **SELECT**: 查询数据
- **INSERT**: 插入数据
- **UPDATE**: 更新数据
- **DELETE**: 删除数据
- **USAGE (序列)**: 使用序列生成自增ID
- **SELECT (序列)**: 查询序列当前值

这些权限是应用正常运行所需的最小权限集。

