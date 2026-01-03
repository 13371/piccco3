# 宝塔面板 PostgreSQL 重启方法

如果脚本无法自动重启 PostgreSQL，请使用以下方法：

## 方法 1: 通过宝塔面板（推荐）

1. 登录宝塔面板
2. 进入「软件商店」→「已安装」
3. 找到「PostgreSQL」
4. 点击「设置」→「重启」

## 方法 2: 使用宝塔命令

```bash
# 查找 PostgreSQL 服务
/etc/init.d/postgresql restart

# 或者
/www/server/pgsql/bin/pg_ctl restart -D /www/server/pgsql/data
```

## 方法 3: 使用 systemctl（如果服务存在）

```bash
# 查找服务名称
systemctl list-units --type=service | grep postgresql

# 重启服务（替换为实际的服务名）
sudo systemctl restart postgresql
# 或
sudo systemctl restart postgresql@14-main
```

## 方法 4: 直接使用 pg_ctl

```bash
# 停止 PostgreSQL
/www/server/pgsql/bin/pg_ctl stop -D /www/server/pgsql/data

# 启动 PostgreSQL
/www/server/pgsql/bin/pg_ctl start -D /www/server/pgsql/data

# 或者重启
/www/server/pgsql/bin/pg_ctl restart -D /www/server/pgsql/data
```

## 验证 PostgreSQL 是否运行

```bash
# 检查进程
ps aux | grep postgres

# 检查端口（默认 5432）
netstat -tlnp | grep 5432

# 或者
ss -tlnp | grep 5432
```

## 注意事项

- 重启 PostgreSQL 会断开所有现有连接
- 确保在低峰期重启
- 重启后验证应用是否能正常连接数据库





