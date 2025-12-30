# piccco3 数据备份指南

## 备份文件存放位置

### 推荐位置

1. **服务器本地备份目录**（默认）：
   ```
   /root/piccco3-backups/
   ```
   - 优点：快速、方便
   - 缺点：如果服务器损坏，备份也会丢失

2. **其他推荐位置**：
   - `/home/backups/piccco3/` - 如果有多用户
   - `/www/backups/piccco3/` - 放在网站目录外
   - `/opt/backups/piccco3/` - 系统级备份目录

3. **远程备份**（强烈推荐）：
   - 阿里云 OSS（对象存储）
   - 腾讯云 COS（对象存储）
   - 其他云存储服务
   - FTP/SFTP 服务器
   - 其他服务器

---

## 使用备份脚本

### 1. 设置脚本权限

```bash
cd /www/wwwroot/piccco3
chmod +x backup_data.sh
```

### 2. 手动执行备份

```bash
./backup_data.sh
```

### 3. 设置定时自动备份（推荐）

#### 方法一：使用 crontab（推荐）

```bash
# 编辑 crontab
crontab -e

# 添加以下行（每天凌晨2点自动备份）
0 2 * * * /www/wwwroot/piccco3/backup_data.sh >> /root/piccco3-backups/cron.log 2>&1

# 或者每天备份3次（凌晨2点、中午12点、晚上8点）
0 2,12,20 * * * /www/wwwroot/piccco3/backup_data.sh >> /root/piccco3-backups/cron.log 2>&1
```

#### 方法二：使用宝塔面板定时任务

1. 登录宝塔面板
2. 进入 **计划任务**
3. 添加任务：
   - 任务类型：Shell 脚本
   - 任务名称：piccco3 数据备份
   - 执行周期：每天（或自定义）
   - 脚本内容：
     ```bash
     /www/wwwroot/piccco3/backup_data.sh
     ```

---

## 备份文件说明

### 文件命名格式

```
piccco3-data-YYYYMMDD-HHMMSS.tar.gz
```

例如：`piccco3-data-20251230-143000.tar.gz`

### 备份内容

备份文件包含：
- `data/users.json` - 用户账户信息
- `data/messages.json` - 用户消息
- `data/message-history.json` - 消息历史
- `data/user-data/` - 所有用户数据（笔记、文件夹、URL等）

### 备份文件大小

- 小规模使用（<100用户）：通常 < 10MB
- 中等规模（100-1000用户）：10MB - 100MB
- 大规模（>1000用户）：可能 > 100MB

---

## 恢复备份

### 1. 停止服务（可选，建议）

```bash
cd /www/wwwroot/piccco3/backend
pm2 stop piccco-backend
```

### 2. 备份当前数据（以防万一）

```bash
cp -r /www/wwwroot/piccco3/backend/data /www/wwwroot/piccco3/backend/data.backup.$(date +%Y%m%d)
```

### 3. 解压备份文件

```bash
# 解压到临时目录
cd /tmp
tar -xzf /root/piccco3-backups/piccco3-data-20251230-143000.tar.gz

# 恢复数据
cp -r data/* /www/wwwroot/piccco3/backend/data/
```

### 4. 设置权限

```bash
chown -R www:www /www/wwwroot/piccco3/backend/data
chmod -R 755 /www/wwwroot/piccco3/backend/data
```

### 5. 重启服务

```bash
cd /www/wwwroot/piccco3/backend
pm2 restart piccco-backend
```

---

## 远程备份配置（可选）

### 使用阿里云 OSS

```bash
# 安装 ossutil
wget http://gosspublic.alicdn.com/ossutil/1.7.14/ossutil64
chmod 755 ossutil64
mv ossutil64 /usr/local/bin/ossutil

# 配置
ossutil config

# 上传备份
ossutil cp /root/piccco3-backups/piccco3-data-*.tar.gz oss://your-bucket-name/piccco3-backups/
```

### 使用 rsync 同步到其他服务器

```bash
rsync -avz /root/piccco3-backups/ user@backup-server:/backups/piccco3/
```

---

## 备份策略建议

1. **每日备份**：保留最近30天的备份
2. **每周备份**：保留最近12周的备份
3. **每月备份**：保留最近12个月的备份

脚本已自动清理30天前的备份，如需修改保留时间，编辑 `backup_data.sh` 中的 `-mtime +30` 参数。

---

## 查看备份日志

```bash
# 查看备份日志
cat /root/piccco3-backups/backup.log

# 查看最近的备份
ls -lht /root/piccco3-backups/*.tar.gz | head -10
```

---

## 注意事项

1. **定期检查备份**：确保备份文件正常生成
2. **测试恢复**：定期测试备份文件是否可以正常恢复
3. **异地备份**：重要数据建议同时备份到其他服务器或云存储
4. **权限保护**：备份文件包含敏感数据，确保权限设置正确
5. **磁盘空间**：定期检查备份目录的磁盘空间
