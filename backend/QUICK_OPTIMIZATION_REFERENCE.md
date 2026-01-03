# 快速优化参考指南

## 🚀 快速开始

### 1. PgBouncer 安装（推荐优先实施）

```bash
cd /www/wwwroot/piccco3/backend
git pull origin main
chmod +x scripts/install-pgbouncer.sh
bash scripts/install-pgbouncer.sh
```

然后按照脚本提示完成配置。

### 2. 验证优化效果

```bash
# 检查 PgBouncer 状态
sudo systemctl status pgbouncer

# 测试连接
psql -h 127.0.0.1 -p 6432 -U piccco_user -d piccco -c "SELECT 1;"

# 查看连接池统计
psql -h 127.0.0.1 -p 6432 -U postgres -d pgbouncer -c "SHOW POOLS;"
```

---

## 📋 优化清单

### ✅ 已完成
- [x] PostgreSQL 配置优化
- [x] 数据库索引优化
- [x] Node.js 连接池限制
- [x] 接口分页实现
- [x] 用户信息缓存
- [x] 数据库权限修复
- [x] 增量同步后端支持

### ⏳ 待实施
- [ ] PgBouncer 连接池
- [ ] 增量同步前端优化

---

## 🔧 常用命令

### PgBouncer 管理
```bash
# 启动
sudo systemctl start pgbouncer

# 停止
sudo systemctl stop pgbouncer

# 重启
sudo systemctl restart pgbouncer

# 查看状态
sudo systemctl status pgbouncer

# 查看日志
tail -f /var/log/pgbouncer/pgbouncer.log
```

### 数据库连接测试
```bash
# 直接连接 PostgreSQL
psql -h 127.0.0.1 -p 5432 -U piccco_user -d piccco

# 通过 PgBouncer 连接
psql -h 127.0.0.1 -p 6432 -U piccco_user -d piccco
```

### 应用管理
```bash
# 重启应用（更新环境变量）
pm2 restart piccco-backend --update-env

# 查看日志
pm2 logs piccco-backend --lines 50

# 查看错误日志
pm2 logs piccco-backend --err --lines 20
```

---

## 📊 性能监控

### 健康检查
```bash
# 基础健康检查
curl http://localhost:4000/api/health

# 详细监控信息
curl http://localhost:4000/api/health/detailed
```

### PgBouncer 统计
```bash
# 连接池统计
psql -h 127.0.0.1 -p 6432 -U postgres -d pgbouncer -c "SHOW POOLS;"

# 客户端连接
psql -h 127.0.0.1 -p 6432 -U postgres -d pgbouncer -c "SHOW CLIENTS;"

# 服务器连接
psql -h 127.0.0.1 -p 6432 -U postgres -d pgbouncer -c "SHOW SERVERS;"
```

---

## 🔍 故障排查

### PgBouncer 连接失败
1. 检查服务状态：`sudo systemctl status pgbouncer`
2. 检查配置文件：`sudo pgbouncer -v /etc/pgbouncer/pgbouncer.ini`
3. 检查认证文件：`cat /etc/pgbouncer/userlist.txt`
4. 查看日志：`tail -f /var/log/pgbouncer/pgbouncer.log`

### 增量同步问题
1. 检查 `lastSyncAt` 参数是否正确传递
2. 检查数据库 `updated_at` 字段是否正确更新
3. 检查时区问题（确保使用 UTC 时间戳）

---

## 📚 详细文档

- `OPTIMIZATION_IMPLEMENTATION_GUIDE.md` - 详细实施指南
- `OPTIMIZATION_SUMMARY.md` - 优化总结
- `PERFORMANCE_OPTIMIZATION.md` - 性能优化文档
- `FIX_DB_PERMISSIONS.md` - 权限修复指南

---

**最后更新：** 2026-01-03




