# 快速数据库迁移指南

## 最简单的方法：直接执行 SQL 命令

### 步骤 1: 查看数据库配置

在服务器上执行：

```bash
cd /www/wwwroot/piccco3/backend
cat .env | grep DB_
```

记录下：
- `DB_HOST`（通常是 `localhost`）
- `DB_PORT`（通常是 `5432`）
- `DB_NAME`（通常是 `piccco`）
- `DB_USER`（可能是 `postgres` 或其他用户）
- `DB_PASSWORD`（数据库密码）

### 步骤 2: 执行 SQL 命令

#### 方法 A: 如果知道 postgres 用户密码

```bash
cd /www/wwwroot/piccco3/backend

# 设置密码（替换为你的 postgres 密码）
export PGPASSWORD='your_postgres_password'

# 执行 SQL（替换为你的数据库名）
psql -h localhost -p 5432 -U postgres -d piccco <<EOF
ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS permanently_deleted_note_ids TEXT[];

ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS permanently_deleted_url_ids TEXT[];

COMMENT ON COLUMN user_settings.permanently_deleted_note_ids IS '永久删除的笔记ID列表';
COMMENT ON COLUMN user_settings.permanently_deleted_url_ids IS '永久删除的网址ID列表';
EOF
```

#### 方法 B: 如果 postgres 用户没有密码（使用 sudo）

```bash
cd /www/wwwroot/piccco3/backend

# 使用 sudo 以 postgres 用户身份执行（替换为你的数据库名）
sudo -u postgres psql -d piccco <<EOF
ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS permanently_deleted_note_ids TEXT[];

ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS permanently_deleted_url_ids TEXT[];

COMMENT ON COLUMN user_settings.permanently_deleted_note_ids IS '永久删除的笔记ID列表';
COMMENT ON COLUMN user_settings.permanently_deleted_url_ids IS '永久删除的网址ID列表';
EOF
```

#### 方法 C: 如果知道应用数据库用户密码

```bash
cd /www/wwwroot/piccco3/backend

# 从 .env 读取配置
DB_HOST=$(grep "^DB_HOST=" .env | cut -d'=' -f2 | tr -d ' ' | tr -d '"' | tr -d "'")
DB_PORT=$(grep "^DB_PORT=" .env | cut -d'=' -f2 | tr -d ' ' | tr -d '"' | tr -d "'")
DB_NAME=$(grep "^DB_NAME=" .env | cut -d'=' -f2 | tr -d ' ' | tr -d '"' | tr -d "'")
DB_USER=$(grep "^DB_USER=" .env | cut -d'=' -f2 | tr -d ' ' | tr -d '"' | tr -d "'")
DB_PASSWORD=$(grep "^DB_PASSWORD=" .env | cut -d'=' -f2 | tr -d ' ' | tr -d '"' | tr -d "'")

# 设置密码
export PGPASSWORD="$DB_PASSWORD"

# 尝试执行（如果权限不足，会失败）
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" <<EOF
ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS permanently_deleted_note_ids TEXT[];

ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS permanently_deleted_url_ids TEXT[];
EOF

# 如果失败，使用 postgres 用户
if [ $? -ne 0 ]; then
    echo "应用用户权限不足，尝试使用 postgres 用户..."
    export PGPASSWORD='your_postgres_password'
    psql -h "$DB_HOST" -p "$DB_PORT" -U postgres -d "$DB_NAME" <<EOF
ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS permanently_deleted_note_ids TEXT[];

ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS permanently_deleted_url_ids TEXT[];
EOF
fi
```

### 步骤 3: 验证迁移是否成功

```bash
psql -h localhost -p 5432 -U postgres -d piccco -c "
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'user_settings' 
AND column_name IN ('permanently_deleted_note_ids', 'permanently_deleted_url_ids');
"
```

如果返回 2 行，说明迁移成功。

### 步骤 4: 重启后端服务

```bash
cd /www/wwwroot/piccco3/backend
pm2 restart piccco-backend --update-env
```

## 如果遇到 "psql: command not found"

安装 PostgreSQL 客户端：

```bash
# Ubuntu/Debian
apt update
apt install postgresql-client

# CentOS/RHEL
yum install postgresql
```

## 如果不知道 postgres 密码

1. 在宝塔面板中查看数据库密码
2. 或者重置 postgres 密码：

```bash
sudo -u postgres psql
ALTER USER postgres PASSWORD 'new_password';
\q
```








