# 云存储备份配置指南

## 支持的云存储服务

1. **阿里云 OSS**（推荐，因为你在阿里云上）
2. **腾讯云 COS**
3. **其他云存储**（可自行扩展脚本）

---

## 方案一：阿里云 OSS（推荐）

### 1. 创建 OSS Bucket

1. 登录阿里云控制台
2. 进入 **对象存储 OSS**
3. 创建 Bucket：
   - Bucket 名称：例如 `piccco3-backups`
   - 地域：选择离你服务器最近的地域（例如：华东1-杭州）
   - 存储类型：标准存储
   - 读写权限：私有（推荐）或公共读

### 2. 创建 AccessKey

1. 鼠标悬停在右上角头像 → **AccessKey管理**
2. 创建 AccessKey（如果还没有）
3. **重要**：保存 AccessKey ID 和 AccessKey Secret

### 3. 安装 ossutil

在服务器上执行：

```bash
# 下载 ossutil
wget http://gosspublic.alicdn.com/ossutil/1.7.14/ossutil64 -O /usr/local/bin/ossutil

# 设置权限
chmod 755 /usr/local/bin/ossutil

# 验证安装
ossutil --version
```

### 4. 配置 ossutil

```bash
# 交互式配置
ossutil config

# 按提示输入：
# - Endpoint: oss-cn-hangzhou.aliyuncs.com（根据你的 Bucket 地域选择）
# - AccessKey ID: 你的 AccessKey ID
# - AccessKey Secret: 你的 AccessKey Secret
```

### 5. 修改备份脚本

编辑 `backup_data_with_cloud.sh`，修改以下配置：

```bash
# 阿里云 OSS 配置
OSS_ENDPOINT="oss-cn-hangzhou.aliyuncs.com"  # 你的 OSS Endpoint
OSS_BUCKET="piccco3-backups"  # 你的 Bucket 名称
CLOUD_STORAGE_TYPE="oss"  # 设置为 oss
```

### 6. 测试备份

```bash
cd /www/wwwroot/piccco3
chmod +x backup_data_with_cloud.sh
./backup_data_with_cloud.sh
```

### 7. 设置自动备份

在宝塔面板中设置定时任务：

```bash
# 每天凌晨2点备份并上传到 OSS
0 2 * * * /www/wwwroot/piccco3/backup_data_with_cloud.sh >> /root/piccco3-backups/cron.log 2>&1
```

---

## 方案二：使用环境变量（更安全）

不直接在脚本中写 AccessKey，而是使用环境变量：

### 1. 创建配置文件

```bash
# 创建配置文件（只有 root 可读）
cat > /root/.piccco3_backup_env << 'EOF'
export OSS_ENDPOINT="oss-cn-hangzhou.aliyuncs.com"
export OSS_BUCKET="piccco3-backups"
export OSS_ACCESS_KEY_ID="你的AccessKey ID"
export OSS_ACCESS_KEY_SECRET="你的AccessKey Secret"
export CLOUD_STORAGE_TYPE="oss"
EOF

# 设置权限
chmod 600 /root/.piccco3_backup_env
```

### 2. 修改定时任务

```bash
# 在 crontab 中加载环境变量
0 2 * * * source /root/.piccco3_backup_env && /www/wwwroot/piccco3/backup_data_with_cloud.sh >> /root/piccco3-backups/cron.log 2>&1
```

---

## 方案三：腾讯云 COS

### 1. 创建 COS Bucket

1. 登录腾讯云控制台
2. 进入 **对象存储 COS**
3. 创建存储桶

### 2. 安装 coscli

```bash
# 下载 coscli
wget https://github.com/tencentyun/coscli/releases/download/v0.13.0-beta/coscli-linux -O /usr/local/bin/coscli
chmod 755 /usr/local/bin/coscli
```

### 3. 配置脚本

编辑 `backup_data_with_cloud.sh`：

```bash
COS_REGION="ap-guangzhou"  # 你的区域
COS_BUCKET="your-bucket-name"  # 你的 Bucket 名称
COS_SECRET_ID="你的SecretId"
COS_SECRET_KEY="你的SecretKey"
CLOUD_STORAGE_TYPE="cos"
```

---

## 查看云存储备份

### 阿里云 OSS

```bash
# 列出所有备份文件
ossutil ls oss://piccco3-backups/piccco3-backups/

# 下载备份文件
ossutil cp oss://piccco3-backups/piccco3-backups/piccco3-data-20251230-143000.tar.gz /tmp/
```

### 腾讯云 COS

```bash
# 列出所有备份文件
coscli ls cos://your-bucket-name/piccco3-backups/

# 下载备份文件
coscli cp cos://your-bucket-name/piccco3-backups/piccco3-data-20251230-143000.tar.gz /tmp/
```

---

## 成本估算

### 阿里云 OSS

- **存储费用**：约 0.12 元/GB/月
- **流量费用**：内网免费，外网下载约 0.5 元/GB
- **请求费用**：PUT 请求约 0.01 元/万次

**示例**：如果每天备份 10MB，一个月约 300MB：
- 存储费用：0.3GB × 0.12元 = **0.036元/月**
- 几乎可以忽略不计

### 腾讯云 COS

- **存储费用**：约 0.118 元/GB/月
- **流量费用**：内网免费，外网下载约 0.5 元/GB

---

## 安全建议

1. **使用子账号**：创建 OSS 子账号，只给备份权限
2. **设置生命周期规则**：自动删除90天前的备份
3. **加密存储**：启用 OSS 服务端加密
4. **定期检查**：确保备份正常上传

---

## 故障排查

### 问题1：ossutil 未找到

```bash
# 检查是否安装
which ossutil

# 如果未安装，重新安装
wget http://gosspublic.alicdn.com/ossutil/1.7.14/ossutil64 -O /usr/local/bin/ossutil
chmod 755 /usr/local/bin/ossutil
```

### 问题2：上传失败

```bash
# 检查网络连接
ping oss-cn-hangzhou.aliyuncs.com

# 检查配置
ossutil config

# 手动测试上传
ossutil cp /root/test.txt oss://your-bucket-name/test.txt
```

### 问题3：权限不足

确保 AccessKey 有写入权限，检查 Bucket 的读写权限设置。

---

## 下一步

1. 选择云存储服务（推荐阿里云 OSS）
2. 创建 Bucket 和 AccessKey
3. 安装并配置工具（ossutil 或 coscli）
4. 修改备份脚本配置
5. 测试备份
6. 设置自动备份

需要我帮你配置吗？




















