# 手动执行数据库迁移 SQL

如果迁移脚本因为权限问题无法执行，可以手动执行以下 SQL。

## 方法1：使用 psql 命令行（推荐）

```bash
# 使用 postgres 超级用户连接
psql -h localhost -p 6432 -U postgres -d piccco

# 然后执行以下 SQL
```

## 方法2：使用宝塔面板数据库管理

在宝塔面板的数据库管理中，选择数据库，然后执行 SQL。

## 迁移 SQL

### 迁移 005: 添加文件夹密码字段

```sql
-- 添加 password 字段到 folders 表
ALTER TABLE folders 
ADD COLUMN IF NOT EXISTS password TEXT;

-- 添加注释
COMMENT ON COLUMN folders.password IS '隐私文件夹密码（加密存储）';
```

### 迁移 006: 添加首页内容字段

```sql
-- 添加 home_content 字段到 user_settings 表
ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS home_content TEXT DEFAULT '';

-- 添加注释
COMMENT ON COLUMN user_settings.home_content IS '首页大白框内容';
```

## 验证迁移结果

执行以下 SQL 验证字段是否已添加：

```sql
-- 检查 folders 表的 password 字段
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'folders' AND column_name = 'password';

-- 检查 user_settings 表的 home_content 字段
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'user_settings' AND column_name = 'home_content';
```

## 如果使用普通用户执行

如果必须使用普通用户（如 `piccco_user`），需要先授予权限：

```sql
-- 使用 postgres 超级用户执行
GRANT ALTER ON TABLE folders TO piccco_user;
GRANT ALTER ON TABLE user_settings TO piccco_user;
```

然后普通用户就可以执行 ALTER TABLE 了。

