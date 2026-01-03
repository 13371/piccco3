# 快速优化指南

本文档提供快速优化步骤，帮助您在 2GB 内存环境中支持 20,000+ 用户和 100+ QPS。

## 📋 优化清单

- [x] PostgreSQL 配置优化
- [x] Node.js 连接池限制（max: 20）
- [x] 接口分页（folders, notes, logs）
- [x] 数据库索引优化
- [x] 用户信息缓存（5分钟TTL）
- [x] 监控接口（/api/health）
- [ ] PgBouncer 连接池（需要手动安装配置）
- [x] 同步策略优化（基于 updated_at）

## 🚀 快速开始

### 步骤 1: PostgreSQL 配置优化

```bash
# 方法1: 使用自动化脚本（推荐）
cd backend
chmod +x scripts/optimize-postgresql.sh
sudo ./scripts/optimize-postgresql.sh

# 方法2: 手动配置
# 参考 backend/config/postgresql.conf.example
# 编辑 /etc/postgresql/*/main/postgresql.conf
# 重启: sudo systemctl restart postgresql
```

### 步骤 2: 安装 PgBouncer（可选但强烈推荐）

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install pgbouncer

# CentOS/RHEL
sudo yum install pgbouncer

# 配置 PgBouncer
sudo cp backend/config/pgbouncer.ini.example /etc/pgbouncer/pgbouncer.ini
# 编辑配置文件，设置数据库连接信息

# 启动 PgBouncer
sudo systemctl start pgbouncer
sudo systemctl enable pgbouncer
```

### 步骤 3: 更新应用环境变量

编辑 `.env` 文件：

```bash
# 如果使用 PgBouncer
USE_PGBOUNCER=true
DB_HOST=127.0.0.1
DB_PORT=6432

# 如果直接连接 PostgreSQL
# USE_PGBOUNCER=false
# DB_HOST=127.0.0.1
# DB_PORT=5432

# 连接池配置（已优化）
DB_POOL_MAX=20
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=2000
```

### 步骤 4: 应用数据库索引

```bash
cd backend
node init-db.js
```

### 步骤 5: 重启应用

```bash
pm2 restart piccco-backend
```

## ✅ 验证优化效果

### 1. 检查健康状态

```bash
curl http://localhost:3000/api/health
```

### 2. 查看详细监控

```bash
curl http://localhost:3000/api/health/detailed
```

### 3. 检查数据库连接数

```sql
-- 在 PostgreSQL 中执行
SELECT count(*) FROM pg_stat_activity WHERE datname = 'piccco';
-- 应该 ≤ 50（如果使用 PgBouncer）
```

### 4. 测试分页接口

```bash
# 测试文件夹分页
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/v1/data/folders?page=1&pageSize=50"

# 测试笔记分页
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/v1/data/notes?page=1&pageSize=50"
```

## 📊 性能指标

优化后应达到：

| 指标 | 目标 | 检查方法 |
|------|------|----------|
| 注册用户 | ≥ 20,000 | 数据库查询 |
| 并发请求 | ≥ 100 QPS | `/api/health/detailed` |
| 平均延迟 | < 150ms | 监控接口 |
| 内存占用 | < 1.5GB | `pm2 monit` |
| DB 连接数 | ≤ 50 | PostgreSQL 查询 |

## 🔍 故障排查

### 连接数过多

```bash
# 检查 PgBouncer 连接数
psql -h 127.0.0.1 -p 6432 -U postgres -d pgbouncer -c "SHOW POOLS;"

# 检查 PostgreSQL 连接数
psql -U postgres -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'piccco';"
```

### 慢查询

```sql
-- 启用 pg_stat_statements
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- 查看慢查询
SELECT query, calls, mean_exec_time, max_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### 内存占用过高

```bash
# 检查应用内存
pm2 monit

# 检查数据库内存
ps aux | grep postgres
```

## 📚 详细文档

更多详细信息，请参考：
- [PERFORMANCE_OPTIMIZATION.md](./PERFORMANCE_OPTIMIZATION.md) - 完整优化文档
- [backend/config/postgresql.conf.example](./config/postgresql.conf.example) - PostgreSQL 配置示例
- [backend/config/pgbouncer.ini.example](./config/pgbouncer.ini.example) - PgBouncer 配置示例

## ⚠️ 注意事项

1. **PgBouncer 不是必须的**，但强烈推荐用于生产环境
2. **连接池限制**：Node.js 应用最大连接数已设置为 20
3. **分页限制**：所有列表接口默认 pageSize=50，最大 100
4. **缓存策略**：用户信息缓存 5 分钟，更新时自动清除
5. **同步策略**：基于 `updated_at` 实现增量同步

## 🎯 下一步

1. 监控应用性能（使用 `/api/health/detailed`）
2. 定期检查慢查询
3. 根据实际负载调整配置
4. 考虑添加 Redis 缓存（未来扩展）


