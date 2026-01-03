# 性能优化指南

本文档详细说明如何优化 PostgreSQL 和 Node.js 应用的性能，以支持 20,000+ 用户和 100+ QPS。

## 一、PostgreSQL 配置优化

### 1.1 修改配置文件

编辑 PostgreSQL 配置文件（通常在 `/etc/postgresql/*/main/postgresql.conf`）：

```bash
sudo nano /etc/postgresql/*/main/postgresql.conf
```

### 1.2 关键配置项

参考 `backend/config/postgresql.conf.example`，主要配置：

- **shared_buffers = 512MB** - 共享缓冲区（系统内存的 25%）
- **work_mem = 8MB** - 每个查询操作的内存
- **maintenance_work_mem = 128MB** - 维护操作的内存
- **effective_cache_size = 1GB** - 有效缓存大小
- **wal_level = replica** - WAL 级别
- **checkpoint_timeout = 15min** - 检查点超时
- **max_wal_size = 1GB** - 最大 WAL 大小
- **wal_compression = on** - WAL 压缩

### 1.3 重启 PostgreSQL

```bash
sudo systemctl restart postgresql
```

## 二、安装和配置 PgBouncer

### 2.1 安装 PgBouncer

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install pgbouncer
```

**CentOS/RHEL:**
```bash
sudo yum install pgbouncer
```

### 2.2 配置 PgBouncer

1. 复制配置文件：
```bash
sudo cp backend/config/pgbouncer.ini.example /etc/pgbouncer/pgbouncer.ini
```

2. 创建认证文件：
```bash
# 生成 MD5 密码哈希
echo "postgres" | md5sum
# 编辑 /etc/pgbouncer/userlist.txt
# 格式： "username" "md5hash"
```

3. 创建日志目录：
```bash
sudo mkdir -p /var/log/pgbouncer
sudo chown pgbouncer:pgbouncer /var/log/pgbouncer
```

### 2.3 启动 PgBouncer

```bash
sudo systemctl start pgbouncer
sudo systemctl enable pgbouncer
```

### 2.4 验证连接

```bash
# 测试连接
psql -h 127.0.0.1 -p 6432 -U postgres -d piccco
```

## 三、Node.js 应用配置

### 3.1 环境变量

在 `.env` 文件中添加：

```bash
# 使用 PgBouncer
USE_PGBOUNCER=true
DB_HOST=127.0.0.1
DB_PORT=6432
DB_NAME=piccco
DB_USER=postgres
DB_PASSWORD=your_password

# 连接池配置
DB_POOL_MAX=20
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=2000
```

### 3.2 验证配置

连接池配置已在 `backend/src/db/config.js` 中实现：
- 最大连接数：20
- 空闲超时：30 秒
- 连接超时：2 秒

## 四、数据库索引优化

### 4.1 已添加的索引

索引已在 `backend/migrations/001_create_schema.sql` 中定义：

**users 表：**
- `email` UNIQUE INDEX
- `created_at` INDEX

**notes 表：**
- `user_id` INDEX
- `updated_at` INDEX
- `is_deleted` INDEX

**folders 表：**
- `user_id` INDEX

### 4.2 应用索引

如果数据库已存在，需要手动应用索引：

```bash
cd backend
node -e "require('./src/db/migrations').createSchema().then(() => process.exit(0))"
```

## 五、接口分页

### 5.1 已实现分页的接口

- `GET /api/v1/data/folders?page=1&pageSize=50`
- `GET /api/v1/data/notes?page=1&pageSize=50`
- `GET /api/v1/data/logs?page=1&pageSize=50`
- `GET /api/v1/admin/logs?page=1&pageSize=50`

### 5.2 分页参数

- `page`: 页码（默认 1）
- `pageSize`: 每页数量（默认 50，最大 100）

### 5.3 响应格式

```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "pageSize": 50,
    "total": 1000,
    "totalPages": 20
  }
}
```

## 六、缓存优化

### 6.1 用户信息缓存

已实现内存缓存（5 分钟 TTL）：
- 缓存键：`user:id:{userId}` 和 `user:email:{email}`
- 自动过期：5 分钟
- 自动清理：用户信息更新时清除缓存

### 6.2 缓存统计

通过监控接口查看缓存统计：
```bash
curl http://localhost:3000/api/health/detailed
```

## 七、监控接口

### 7.1 健康检查

```bash
GET /api/health
```

返回：
- 数据库连接状态
- 连接池统计
- 缓存统计
- 内存使用情况

### 7.2 详细监控

```bash
GET /api/health/detailed
```

返回：
- 所有健康检查信息
- 请求统计（TPS、错误率）
- 慢查询列表（如果启用了 pg_stat_statements）
- 系统信息

### 7.3 启用 pg_stat_statements

```sql
-- 在 PostgreSQL 中执行
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

## 八、同步策略优化

### 8.1 增量同步

同步接口已基于 `updated_at` 实现增量同步：
- 只同步变化的数据
- 使用 `updated_at` 判断数据新旧
- 避免传输整份 JSON

### 8.2 同步接口

- `GET /api/v1/data/sync` - 获取用户数据（支持增量）
- `POST /api/v1/data/sync` - 同步用户数据（基于 updated_at）

## 九、容量目标

优化完成后，系统应支持：

| 指标 | 目标 |
|------|------|
| 注册用户 | ≥ 20,000 |
| 并发请求 | ≥ 100 QPS |
| 平均延迟 | < 150ms |
| 内存占用 | < 1.5GB |
| DB 连接数 | ≤ 50 |

## 十、验证优化效果

### 10.1 检查数据库连接数

```sql
-- 在 PostgreSQL 中执行
SELECT count(*) FROM pg_stat_activity WHERE datname = 'piccco';
```

### 10.2 检查 PgBouncer 统计

```bash
# 连接到 PgBouncer 管理数据库
psql -h 127.0.0.1 -p 6432 -U postgres -d pgbouncer

# 查看统计信息
SHOW POOLS;
SHOW STATS;
```

### 10.3 监控应用性能

```bash
# 查看健康检查
curl http://localhost:3000/api/health/detailed

# 查看 PM2 日志
pm2 logs piccco-backend --lines 50
```

## 十一、禁止事项

❌ **禁止：**
- 全量扫描表（必须使用索引）
- WHERE 无索引的查询
- 无限连接池（必须限制）
- 返回全量笔记（必须分页）
- 写文件存储核心数据（已迁移到数据库）

## 十二、未来扩展预留

当前结构已预留以下扩展：
- Redis 缓存（可替换内存缓存）
- CDN（静态资源）
- 读写分离（数据库主从）

## 十三、故障排查

### 13.1 连接数过多

```bash
# 检查 PgBouncer 连接数
psql -h 127.0.0.1 -p 6432 -U postgres -d pgbouncer -c "SHOW POOLS;"

# 检查 PostgreSQL 连接数
psql -U postgres -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'piccco';"
```

### 13.2 慢查询

```sql
-- 查看慢查询
SELECT query, calls, mean_exec_time, max_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### 13.3 内存占用过高

```bash
# 检查应用内存
pm2 monit

# 检查数据库内存
ps aux | grep postgres
```

## 十四、参考文档

- [PostgreSQL 性能优化](https://www.postgresql.org/docs/current/performance-tips.html)
- [PgBouncer 文档](https://www.pgbouncer.org/config.html)
- [Node.js pg 库文档](https://node-postgres.com/)

