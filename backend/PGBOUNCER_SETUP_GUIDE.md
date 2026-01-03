# PgBouncer 连接池配置指南

## 概述

PgBouncer 是一个轻量级的 PostgreSQL 连接池工具，可以：
- **限制数据库连接数**：最多 50 个真实数据库连接
- **提高性能**：减少连接建立和销毁的开销
- **支持高并发**：允许大量客户端连接（最多 2000 个）

## 配置目标

- **连接池模式**：`transaction`（事务模式，适合 Node.js）
- **最大客户端连接**：2000（Node.js 应用可以创建最多 2000 个连接）
- **数据库连接池大小**：50（实际到 PostgreSQL 的连接最多 50 个）
- **保留连接池**：10（紧急情况下的最小连接数）

## 安装步骤

### 方法 1：使用自动化脚本（推荐）

```bash
cd /www/wwwroot/piccco3/backend
git pull origin main
chmod +x scripts/install-pgbouncer.sh
bash scripts/install-pgbouncer.sh
```

### 方法 2：手动安装

#### 1. 安装 PgBouncer

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install -y pgbouncer
```

**CentOS/RHEL:**
```bash
sudo yum install -y epel-release
sudo yum install -y pgbouncer
```

#### 2. 复制配置文件

```bash
cd /www/wwwroot/piccco3/backend
sudo mkdir -p /etc/pgbouncer
sudo cp config/pgbouncer.ini.example /etc/pgbouncer/pgbouncer.ini
```

#### 3. 配置数据库连接

编辑配置文件：
```bash
sudo nano /etc/pgbouncer/pgbouncer.ini
```

修改 `[databases]` 部分：
```ini
[databases]
piccco = host=127.0.0.1 port=5432 dbname=piccco
```

#### 4. 创建用户认证文件

```bash
# 读取数据库密码（从 .env 文件）
cd /www/wwwroot/piccco3/backend
DB_USER=$(grep "^DB_USER=" .env | cut -d'=' -f2 | tr -d ' ' | tr -d '"' | tr -d "'")
DB_PASSWORD=$(grep "^DB_PASSWORD=" .env | cut -d'=' -f2 | tr -d ' ' | tr -d '"' | tr -d "'")

# 生成 MD5 哈希
MD5_HASH=$(echo -n "$DB_PASSWORD$DB_USER" | md5sum | awk '{print "md5"$1}')

# 创建用户列表文件
sudo tee /etc/pgbouncer/userlist.txt > /dev/null <<EOF
"$DB_USER" "$MD5_HASH"
"postgres" "md5$(echo -n 'postgres' | md5sum | awk '{print $1}')"
EOF
```

#### 5. 创建日志和运行目录

```bash
sudo mkdir -p /var/log/pgbouncer
sudo mkdir -p /var/run/pgbouncer
sudo chown pgbouncer:pgbouncer /var/log/pgbouncer /var/run/pgbouncer
```

#### 6. 启动 PgBouncer

**使用 systemd（推荐）:**
```bash
sudo systemctl start pgbouncer
sudo systemctl enable pgbouncer
sudo systemctl status pgbouncer
```

**手动启动（如果没有 systemd）:**
```bash
sudo pgbouncer -d /etc/pgbouncer/pgbouncer.ini
```

## 配置应用使用 PgBouncer

### 1. 更新 .env 文件

在 `/www/wwwroot/piccco3/backend/.env` 中添加：

```bash
# 启用 PgBouncer
USE_PGBOUNCER=true

# 使用 PgBouncer 端口（6432）
DB_PORT=6432
```

### 2. 重启应用

```bash
pm2 restart piccco-backend --update-env
```

### 3. 验证连接

```bash
# 测试 PgBouncer 连接
/www/server/pgsql/bin/psql -h 127.0.0.1 -p 6432 -U piccco_user -d piccco -c 'SELECT version();'

# 查看连接池状态
/www/server/pgsql/bin/psql -h 127.0.0.1 -p 6432 -U postgres -d pgbouncer -c 'SHOW POOLS;'
```

## 验证和监控

### 查看连接池统计

```bash
# 连接到管理数据库
/www/server/pgsql/bin/psql -h 127.0.0.1 -p 6432 -U postgres -d pgbouncer

# 查看连接池状态
SHOW POOLS;

# 查看客户端连接
SHOW CLIENTS;

# 查看服务器连接
SHOW SERVERS;

# 查看统计信息
SHOW STATS;
```

### 检查应用连接

```bash
# 查看应用健康检查（应该显示使用 PgBouncer）
curl http://localhost:3000/api/health | jq '.db'
```

## 故障排查

### 1. PgBouncer 无法启动

```bash
# 检查配置文件语法
sudo pgbouncer -V /etc/pgbouncer/pgbouncer.ini

# 查看日志
sudo tail -f /var/log/pgbouncer/pgbouncer.log
```

### 2. 连接被拒绝

- 检查 PgBouncer 是否运行：`sudo systemctl status pgbouncer`
- 检查端口是否监听：`sudo netstat -tlnp | grep 6432`
- 检查防火墙：`sudo iptables -L -n | grep 6432`

### 3. 认证失败

- 检查用户列表文件：`sudo cat /etc/pgbouncer/userlist.txt`
- 验证 MD5 哈希是否正确
- 检查 PostgreSQL 用户密码是否匹配

### 4. 连接数过多

- 检查当前连接数：`SHOW POOLS;`
- 调整 `default_pool_size` 和 `max_client_conn` 配置

## 性能优化建议

1. **监控连接池使用率**：定期检查 `SHOW POOLS;` 输出
2. **调整连接池大小**：根据实际负载调整 `default_pool_size`
3. **启用慢查询日志**：在 PostgreSQL 中配置 `log_min_duration_statement`
4. **定期重启**：建议每周重启一次 PgBouncer 以清理连接

## 配置参数说明

| 参数 | 值 | 说明 |
|------|-----|------|
| `pool_mode` | `transaction` | 事务模式，适合 Node.js |
| `max_client_conn` | `2000` | 最大客户端连接数 |
| `default_pool_size` | `50` | 每个数据库的最大连接数 |
| `reserve_pool_size` | `10` | 保留连接池大小 |
| `min_pool_size` | `5` | 最小连接池大小 |
| `server_idle_timeout` | `600` | 服务器空闲超时（秒） |

## 注意事项

1. **事务模式限制**：
   - 不能使用 `PREPARE` 语句
   - 不能使用 `LISTEN/NOTIFY`
   - 不能使用 `COPY` 命令
   - 不能使用临时表（在事务外）

2. **连接池监控**：
   - 定期检查连接池使用情况
   - 监控连接等待时间
   - 关注连接池溢出情况

3. **备份配置**：
   - 定期备份 `/etc/pgbouncer/pgbouncer.ini`
   - 备份用户列表文件

## 完成检查清单

- [ ] PgBouncer 已安装
- [ ] 配置文件已创建并正确配置
- [ ] 用户认证文件已创建
- [ ] PgBouncer 服务已启动
- [ ] 应用 `.env` 已更新（`USE_PGBOUNCER=true`, `DB_PORT=6432`）
- [ ] 应用已重启
- [ ] 连接测试通过
- [ ] 连接池状态正常

## 相关文档

- [PgBouncer 官方文档](https://www.pgbouncer.org/)
- [PostgreSQL 连接池最佳实践](https://www.postgresql.org/docs/current/runtime-config-connection.html)



