# 服务器优化步骤

## 步骤 1: 拉取最新代码

在服务器上执行：

```bash
cd /www/wwwroot/piccco3
git pull origin main
```

## 步骤 2: 检查文件是否存在

```bash
cd /www/wwwroot/piccco3/backend
ls -la scripts/optimize-postgresql.sh
```

如果文件存在，继续下一步。如果不存在，检查是否成功拉取了代码。

## 步骤 3: 执行优化脚本

```bash
cd /www/wwwroot/piccco3/backend
chmod +x scripts/optimize-postgresql.sh
sudo ./scripts/optimize-postgresql.sh
```

## 方案 2: 手动配置（如果脚本不可用）

如果脚本无法使用，可以手动配置 PostgreSQL：

### 1. 找到 PostgreSQL 配置文件

```bash
# 查找配置文件位置
sudo find /etc -name postgresql.conf 2>/dev/null

# 或者检查版本
psql --version
# 假设版本是 14，配置文件通常在：
# /etc/postgresql/14/main/postgresql.conf
```

### 2. 备份配置文件

```bash
sudo cp /etc/postgresql/*/main/postgresql.conf /etc/postgresql/*/main/postgresql.conf.backup.$(date +%Y%m%d)
```

### 3. 编辑配置文件

```bash
sudo nano /etc/postgresql/*/main/postgresql.conf
```

添加或修改以下配置：

```ini
# 内存配置
shared_buffers = 512MB
work_mem = 8MB
maintenance_work_mem = 128MB
effective_cache_size = 1GB

# WAL 配置
wal_level = replica
checkpoint_timeout = 15min
max_wal_size = 1GB
wal_compression = on
```

### 4. 重启 PostgreSQL

```bash
sudo systemctl restart postgresql
```

### 5. 验证配置

```bash
psql -U postgres -c "SHOW shared_buffers;"
```

## 步骤 4: 应用数据库索引

```bash
cd /www/wwwroot/piccco3/backend
node init-db.js
```

## 步骤 5: 更新环境变量（如果需要使用 PgBouncer）

编辑 `.env` 文件：

```bash
cd /www/wwwroot/piccco3/backend
nano .env
```

添加或修改：

```bash
# 如果使用 PgBouncer
USE_PGBOUNCER=true
DB_PORT=6432

# 如果直接连接 PostgreSQL
# USE_PGBOUNCER=false
# DB_PORT=5432
```

## 步骤 6: 重启应用

```bash
pm2 restart piccco-backend
```

## 步骤 7: 验证优化效果

```bash
# 检查健康状态
curl http://localhost:3000/api/health

# 检查详细监控
curl http://localhost:3000/api/health/detailed
```

## 故障排查

### 如果 git pull 失败

```bash
# 检查是否有未提交的更改
cd /www/wwwroot/piccco3
git status

# 如果有冲突，先处理
git stash
git pull origin main
```

### 如果脚本执行失败

使用方案 2 手动配置，或者检查脚本权限：

```bash
ls -la scripts/optimize-postgresql.sh
chmod +x scripts/optimize-postgresql.sh
```

### 如果 PostgreSQL 重启失败

```bash
# 检查日志
sudo journalctl -u postgresql -n 50

# 检查配置文件语法
sudo postgresql -t -c "SHOW config_file;"
```

