# 手动配置 PostgreSQL 优化（如果脚本无法运行）

如果 `optimize-postgresql.sh` 脚本无法找到配置文件，可以手动配置。

## 步骤 1: 查找 PostgreSQL 配置文件

### 方法 1: 使用 find 命令

```bash
sudo find /etc -name postgresql.conf
sudo find /var -name postgresql.conf
```

### 方法 2: 检查 systemctl 服务

```bash
# 查看 PostgreSQL 服务
sudo systemctl status postgresql

# 查看服务详细信息
sudo systemctl show postgresql | grep ExecStart
```

### 方法 3: 检查常见位置

```bash
# Ubuntu/Debian
ls -la /etc/postgresql/*/main/postgresql.conf

# CentOS/RHEL
ls -la /var/lib/pgsql/*/data/postgresql.conf
```

## 步骤 2: 备份配置文件

```bash
# 假设配置文件在 /etc/postgresql/14/main/postgresql.conf
sudo cp /etc/postgresql/14/main/postgresql.conf /etc/postgresql/14/main/postgresql.conf.backup.$(date +%Y%m%d)
```

## 步骤 3: 编辑配置文件

```bash
sudo nano /etc/postgresql/14/main/postgresql.conf
```

或者使用其他编辑器（vi, vim 等）。

## 步骤 4: 添加或修改以下配置

在配置文件中找到或添加以下配置项：

```ini
# ============================================
# 内存配置（重点）
# ============================================

# 共享缓冲区（推荐为系统内存的 25%，2GB 环境使用 512MB）
shared_buffers = 512MB

# 工作内存（每个查询操作的内存，2GB 环境使用 8MB）
work_mem = 8MB

# 维护工作内存（VACUUM、CREATE INDEX 等操作的内存，2GB 环境使用 128MB）
maintenance_work_mem = 128MB

# 有效缓存大小（操作系统和 PostgreSQL 共享缓冲区，2GB 环境使用 1GB）
effective_cache_size = 1GB

# ============================================
# WAL（Write-Ahead Log）配置
# ============================================

# WAL 级别（replica 支持流复制和归档）
wal_level = replica

# 检查点超时（15分钟）
checkpoint_timeout = 15min

# 最大 WAL 大小（1GB）
max_wal_size = 1GB

# WAL 压缩（减少 IO 压力）
wal_compression = on
```

**注意：**
- 如果配置项前面有 `#` 注释符号，需要删除 `#` 并修改值
- 如果配置项不存在，直接添加即可
- 确保没有重复的配置项

## 步骤 5: 保存并退出

- **nano**: 按 `Ctrl+X`，然后按 `Y` 确认，再按 `Enter`
- **vi/vim**: 按 `Esc`，输入 `:wq`，按 `Enter`

## 步骤 6: 重启 PostgreSQL

```bash
sudo systemctl restart postgresql
```

## 步骤 7: 验证配置

### 方法 1: 检查服务状态

```bash
sudo systemctl status postgresql
```

应该显示 `active (running)`。

### 方法 2: 使用 psql 验证（如果可用）

```bash
# 如果 psql 命令可用
psql -U postgres -c "SHOW shared_buffers;"
psql -U postgres -c "SHOW work_mem;"
psql -U postgres -c "SHOW effective_cache_size;"
```

### 方法 3: 检查配置文件语法

```bash
# 检查配置文件是否有语法错误
sudo -u postgres /usr/lib/postgresql/*/bin/postgres --check-config -D /var/lib/postgresql/*/main
```

## 故障排查

### 如果 PostgreSQL 无法启动

1. **检查日志**：
   ```bash
   sudo journalctl -u postgresql -n 50
   sudo tail -f /var/log/postgresql/postgresql-*-main.log
   ```

2. **恢复备份**：
   ```bash
   sudo cp /etc/postgresql/14/main/postgresql.conf.backup.* /etc/postgresql/14/main/postgresql.conf
   sudo systemctl restart postgresql
   ```

3. **检查配置文件语法**：
   ```bash
   # 确保没有语法错误
   sudo grep -v "^#" /etc/postgresql/14/main/postgresql.conf | grep -v "^$" | grep "="
   ```

### 如果找不到配置文件

可能是通过宝塔面板安装的 PostgreSQL，配置文件位置可能不同：

```bash
# 宝塔面板 PostgreSQL 配置文件可能在：
/www/server/pgsql/data/postgresql.conf
/usr/local/pgsql/data/postgresql.conf
```

### 如果修改后没有生效

1. **确保重启了服务**：
   ```bash
   sudo systemctl restart postgresql
   ```

2. **检查配置是否被加载**：
   ```bash
   # 查看 PostgreSQL 进程参数
   ps aux | grep postgres
   ```

3. **检查是否有其他配置文件覆盖**：
   ```bash
   # 查看配置文件的包含关系
   sudo grep "^include" /etc/postgresql/14/main/postgresql.conf
   ```

## 参考

- 完整配置示例：`backend/config/postgresql.conf.example`
- 优化文档：`backend/PERFORMANCE_OPTIMIZATION.md`

