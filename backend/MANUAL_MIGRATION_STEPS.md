# 手动执行数据库迁移步骤

## 方法 1: 使用迁移脚本（推荐）

在服务器上执行：

```bash
cd /www/wwwroot/piccco3/backend
chmod +x scripts/run-migration-simple.sh
./scripts/run-migration-simple.sh
```

## 方法 2: 手动执行 SQL 命令

### 步骤 1: 查看数据库配置

```bash
cd /www/wwwroot/piccco3/backend
cat .env | grep DB_
```

应该看到类似：
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=piccco
DB_USER=your_db_user
DB_PASSWORD=your_db_password
```

### 步骤 2: 使用 psql 连接数据库

```bash
# 设置密码环境变量（如果使用密码）
export PGPASSWORD='your_db_password'

# 连接数据库（替换为你的实际值）
psql -h localhost -p 5432 -U your_db_user -d piccco
```

如果连接失败，尝试使用 postgres 超级用户：

```bash
# 使用 postgres 用户（需要 postgres 密码）
export PGPASSWORD='postgres_password'
psql -h localhost -p 5432 -U postgres -d piccco
```

### 步骤 3: 在 psql 中执行 SQL

连接成功后，在 psql 提示符下执行：

```sql
-- 检查字段是否已存在
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'user_settings' 
AND column_name IN ('permanently_deleted_note_ids', 'permanently_deleted_url_ids');

-- 如果字段不存在，执行以下 SQL
ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS permanently_deleted_note_ids TEXT[];

ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS permanently_deleted_url_ids TEXT[];

-- 添加注释
COMMENT ON COLUMN user_settings.permanently_deleted_note_ids IS '永久删除的笔记ID列表';
COMMENT ON COLUMN user_settings.permanently_deleted_url_ids IS '永久删除的网址ID列表';

-- 验证字段已添加
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'user_settings' 
AND column_name IN ('permanently_deleted_note_ids', 'permanently_deleted_url_ids');

-- 退出
\q
```

### 步骤 4: 如果权限不足

如果遇到 "must be owner of table user_settings" 错误，需要使用 postgres 超级用户：

```bash
# 方法 A: 使用 postgres 用户（需要知道 postgres 密码）
export PGPASSWORD='postgres_password'
psql -h localhost -p 5432 -U postgres -d piccco -c "ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS permanently_deleted_note_ids TEXT[];"
psql -h localhost -p 5432 -U postgres -d piccco -c "ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS permanently_deleted_url_ids TEXT[];"

# 方法 B: 使用 sudo（如果 postgres 用户没有密码）
sudo -u postgres psql -d piccco -c "ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS permanently_deleted_note_ids TEXT[];"
sudo -u postgres psql -d piccco -c "ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS permanently_deleted_url_ids TEXT[];"
```

## 方法 3: 使用 Node.js 脚本（需要 postgres 密码）

```bash
cd /www/wwwroot/piccco3/backend

# 设置 postgres 密码
export POSTGRES_PASSWORD='postgres_password'

# 执行迁移
node scripts/run-migration-002.js
```

## 验证迁移是否成功

执行以下命令：

```bash
psql -h localhost -p 5432 -U your_db_user -d piccco -c "
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'user_settings' 
AND column_name IN ('permanently_deleted_note_ids', 'permanently_deleted_url_ids');
"
```

如果返回 2 行，说明迁移成功。








