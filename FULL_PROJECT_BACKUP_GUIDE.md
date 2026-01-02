# 完整项目备份指南

**备份方式**: ZIP 压缩包 + 云存储  
**适用场景**: 完整项目备份、快速恢复、离线备份

---

## 📦 备份说明

### 什么是完整项目备份？

完整项目备份是将整个 `piccco3` 文件夹打包成 ZIP 文件，包含：
- ✅ 前端源代码
- ✅ 后端源代码
- ✅ 配置文件
- ✅ 工具脚本
- ✅ 文档

### 排除的内容

为了减小备份文件大小，以下内容会被排除：
- ❌ `node_modules` - 可通过 `npm install` 恢复
- ❌ `dist` - 构建产物，可通过 `npm run build` 恢复
- ❌ `.git` - Git 历史，已保存在 GitHub
- ❌ `backend/data` - 用户数据，需单独备份（使用 `backup_data.sh`）
- ❌ `.env` - 敏感配置文件，需手动配置

---

## 🚀 快速开始

### 1. 在服务器上执行备份

```bash
cd /www/wwwroot/piccco3

# 拉取最新脚本
git pull

# 设置执行权限
chmod +x backup_full_project.sh

# 执行备份（仅本地）
./backup_full_project.sh
```

### 2. 备份文件位置

备份文件保存在：
```
/root/piccco3-backups/piccco3-full-backup-YYYYMMDD-HHMMSS.zip
```

---

## ☁️ 上传到云存储

### 方法1：自动上传（推荐）

#### 配置阿里云 OSS

1. **安装 ossutil**
```bash
wget http://gosspublic.alicdn.com/ossutil/1.7.14/ossutil64 -O /usr/local/bin/ossutil
chmod 755 /usr/local/bin/ossutil
ossutil config
```

2. **修改备份脚本配置**

编辑 `backup_full_project.sh`，修改以下配置：

```bash
OSS_ENDPOINT="oss-cn-hangzhou.aliyuncs.com"  # 你的 OSS Endpoint
OSS_BUCKET="piccco3-backups"  # 你的 Bucket 名称
OSS_PATH="piccco3-full-backups/"  # OSS 中的路径
CLOUD_STORAGE_TYPE="oss"  # 改为 oss
```

3. **执行备份（自动上传）**

```bash
./backup_full_project.sh
```

#### 配置腾讯云 COS

1. **安装 coscli**
```bash
wget https://github.com/tencentyun/coscli/releases/download/v0.13.0-beta/coscli-linux -O /usr/local/bin/coscli
chmod 755 /usr/local/bin/coscli
```

2. **修改备份脚本配置**

```bash
COS_REGION="ap-guangzhou"  # 你的区域
COS_BUCKET="piccco3-backups"  # 你的 Bucket 名称
COS_PATH="piccco3-full-backups/"  # COS 中的路径
CLOUD_STORAGE_TYPE="cos"  # 改为 cos
```

---

### 方法2：手动上传

如果不想配置自动上传，可以：

1. **执行备份脚本**（仅本地）
```bash
./backup_full_project.sh
```

2. **手动上传到云存储**

#### 使用阿里云控制台上传
1. 登录阿里云控制台
2. 进入 **对象存储 OSS**
3. 选择你的 Bucket
4. 点击 **上传文件**
5. 选择备份 ZIP 文件上传

#### 使用命令行上传
```bash
# 使用 ossutil
ossutil cp /root/piccco3-backups/piccco3-full-backup-*.zip \
  oss://your-bucket-name/piccco3-full-backups/

# 或使用 coscli
coscli cp /root/piccco3-backups/piccco3-full-backup-*.zip \
  cos://your-bucket-name/piccco3-full-backups/
```

---

## 📥 如何恢复备份

### 恢复步骤

1. **下载备份文件**

从云存储下载 ZIP 文件，或使用本地备份文件。

2. **解压备份文件**

```bash
# 创建恢复目录
mkdir -p /www/wwwroot/piccco3-restore
cd /www/wwwroot/piccco3-restore

# 解压 ZIP 文件
unzip /path/to/piccco3-full-backup-20251230-120000.zip
```

3. **安装依赖**

```bash
cd piccco3

# 安装前端依赖
npm install

# 安装后端依赖
cd backend
npm install
cd ..
```

4. **构建前端**

```bash
VITE_API_BASE_URL=/api npm run build
```

5. **配置环境变量**

```bash
# 复制环境变量示例
cp backend/.env.example backend/.env

# 编辑环境变量
nano backend/.env
```

6. **恢复用户数据**（如果有单独的数据备份）

```bash
# 如果有数据备份，解压到 backend/data/
tar -xzf /path/to/data-backup.tar.gz -C backend/
```

7. **启动服务**

```bash
# 启动后端
cd backend
pm2 start ecosystem.config.js

# 配置 Nginx（如果需要）
# ...
```

---

## 🔄 与 Git 备份的区别

| 特性 | Git 备份 | ZIP 完整备份 |
|------|----------|--------------|
| **备份内容** | 代码和配置 | 完整项目（排除 node_modules） |
| **文件大小** | 小（仅代码） | 较大（包含所有文件） |
| **恢复速度** | 需要安装依赖 | 解压即可 |
| **版本控制** | ✅ 有版本历史 | ❌ 无版本历史 |
| **适用场景** | 代码版本管理 | 完整项目快照 |
| **推荐用途** | 日常开发备份 | 重要节点备份 |

### 建议

- **Git 备份**：用于日常开发、代码版本管理
- **ZIP 完整备份**：用于重要节点、快速恢复、离线备份

---

## 📅 备份策略建议

### 推荐备份频率

1. **Git 备份**：每次重要更新后
2. **ZIP 完整备份**：每周一次或重要功能上线前
3. **数据备份**：每天自动备份（使用 `backup_data.sh`）

### 设置自动备份

在宝塔面板中设置定时任务：

```bash
# 每周日凌晨2点执行完整备份
0 2 * * 0 /www/wwwroot/piccco3/backup_full_project.sh
```

---

## 💾 备份文件大小估算

### 典型项目大小

- **源代码**: ~5-10 MB
- **配置文件**: ~1 MB
- **文档**: ~2-5 MB
- **总计**: ~10-20 MB（压缩后）

### 云存储成本

- **阿里云 OSS**: 约 0.12 元/GB/月
- **10 MB 备份**: 约 0.0012 元/月（几乎免费）

---

## 🔍 查看备份文件

### 在服务器上查看

```bash
# 列出所有备份文件
ls -lh /root/piccco3-backups/*.zip

# 查看备份信息
unzip -l /root/piccco3-backups/piccco3-full-backup-*.zip | head -20

# 查看备份日志
tail -50 /root/piccco3-backups/full-backup.log
```

### 在云存储中查看

#### 阿里云 OSS
1. 登录阿里云控制台
2. 进入 **对象存储 OSS**
3. 选择 Bucket → `piccco3-full-backups/` 目录
4. 查看所有备份文件

#### 腾讯云 COS
1. 登录腾讯云控制台
2. 进入 **对象存储 COS**
3. 选择存储桶 → `piccco3-full-backups/` 目录
4. 查看所有备份文件

---

## ⚠️ 注意事项

### 1. 备份文件安全

- ✅ ZIP 文件不包含 `.env`（敏感配置）
- ✅ ZIP 文件不包含用户数据（需单独备份）
- ⚠️ 备份文件包含源代码，请妥善保管

### 2. 恢复前检查

- ✅ 检查备份文件完整性
- ✅ 确认环境变量配置
- ✅ 确认数据库/数据文件恢复

### 3. 版本兼容性

- ⚠️ 不同版本的 Node.js 可能需要不同的依赖
- ⚠️ 恢复后建议运行 `npm install` 更新依赖

---

## 📝 备份记录

建议记录每次备份：

| 日期 | 备份文件 | 大小 | 说明 | 云存储位置 |
|------|----------|------|------|------------|
| 2025-12-30 | piccco3-full-backup-20251230-120000.zip | 15 MB | 稳定版本备份 | OSS: piccco3-full-backups/ |

---

## 🔗 相关文档

- [GitHub 备份指南](./GITHUB_BACKUP_GUIDE.md) - Git 版本备份
- [数据备份指南](./BACKUP_GUIDE.md) - 用户数据备份
- [云存储备份配置](./CLOUD_BACKUP_SETUP.md) - 云存储配置

---

**备份完成！** ZIP 备份可以作为 Git 备份的补充，提供快速恢复能力。



















