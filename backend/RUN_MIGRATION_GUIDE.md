# 数据库迁移指南

## 问题
执行迁移时遇到权限错误：`must be owner of table user_settings`

## 解决方案

### 方案 1: 使用宝塔面板执行 SQL（推荐）

1. 登录宝塔面板：`https://8.136.38.126:37040/488538e0`
2. 进入 **数据库** 菜单
3. 找到数据库 `piccco`（或你的数据库名）
4. 点击 **管理** 或 **phpMyAdmin**（如果是 MySQL）或 **pgAdmin**（如果是 PostgreSQL）
5. 执行以下 SQL：

```sql
ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS permanently_deleted_note_ids TEXT[];

ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS permanently_deleted_url_ids TEXT[];

COMMENT ON COLUMN user_settings.permanently_deleted_note_ids IS '永久删除的笔记ID列表';
COMMENT ON COLUMN user_settings.permanently_deleted_url_ids IS '永久删除的网址ID列表';
```

### 方案 2: 使用命令行（需要 postgres 用户密码）

在服务器上执行：

```bash
cd /www/wwwroot/piccco3/backend

# 方法 A: 如果知道 postgres 密码
export PGPASSWORD='your_postgres_password'
psql -h localhost -U postgres -d piccco -c "ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS permanently_deleted_note_ids TEXT[];"
psql -h localhost -U postgres -d piccco -c "ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS permanently_deleted_url_ids TEXT[];"

# 方法 B: 使用修改后的迁移脚本（需要设置 POSTGRES_PASSWORD 环境变量）
export POSTGRES_PASSWORD='your_postgres_password'
node scripts/run-migration-002.js
```

### 方案 3: 查找 postgres 密码

如果不知道 postgres 密码，可以：

1. 在宝塔面板中查看数据库密码
2. 或者检查 `.env` 文件中的 `DB_PASSWORD`
3. 或者重置 postgres 密码

### 验证迁移是否成功

执行以下 SQL 检查字段是否存在：

```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'user_settings' 
AND column_name IN ('permanently_deleted_note_ids', 'permanently_deleted_url_ids');
```

如果返回 2 行，说明迁移成功。







