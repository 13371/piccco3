# GitHub 备份指南

**备份日期**: 2025-12-30  
**备份状态**: ✅ 已完成

---

## 📦 备份信息

### 当前备份点

- **提交哈希**: `6ee1ddd`
- **提交信息**: `chore: backup all code changes and add quality report`
- **备份标签**: `v1.0.0-backup-20251230`
- **备份分支**: `backup-stable-20251230`
- **GitHub 仓库**: `https://github.com/13371/piccco3`

---

## 🔄 如何回滚到备份点

### 方法1：使用标签回滚（推荐）

#### 在本地回滚

```bash
# 1. 查看所有标签
git tag -l

# 2. 回滚到备份标签
git checkout v1.0.0-backup-20251230

# 3. 如果需要创建新分支（推荐）
git checkout -b rollback-from-backup v1.0.0-backup-20251230
```

#### 在服务器上回滚

```bash
cd /www/wwwroot/piccco3

# 1. 拉取最新代码
git fetch origin

# 2. 回滚到备份标签
git checkout v1.0.0-backup-20251230

# 3. 如果需要强制回滚（覆盖当前更改）
git reset --hard v1.0.0-backup-20251230
```

---

### 方法2：使用备份分支回滚

```bash
# 1. 查看所有分支
git branch -a

# 2. 切换到备份分支
git checkout backup-stable-20251230

# 3. 如果需要合并到主分支
git checkout main
git merge backup-stable-20251230
```

---

### 方法3：使用提交哈希回滚

```bash
# 1. 查看提交历史
git log --oneline

# 2. 回滚到特定提交
git checkout 6ee1ddd

# 3. 如果需要创建新分支
git checkout -b rollback-6ee1ddd 6ee1ddd
```

---

## 📋 备份内容

本次备份包含：

### 核心代码
- ✅ 前端代码（React + TypeScript）
- ✅ 后端代码（Node.js + Express）
- ✅ 配置文件（Nginx、PM2、环境变量示例）

### 工具脚本
- ✅ `check_services.sh` - 服务状态检查脚本
- ✅ `backup_data.sh` - 数据备份脚本
- ✅ `backup_data_with_cloud.sh` - 云存储备份脚本
- ✅ `fix_build_and_deploy.sh` - 构建部署修复脚本

### 文档
- ✅ `CODE_QUALITY_REPORT.md` - 代码质量评估报告
- ✅ `CLOUD_BACKUP_SETUP.md` - 云存储备份配置指南
- ✅ `BACKUP_GUIDE.md` - 备份指南
- ✅ 其他部署和优化文档

---

## 🔍 查看备份信息

### 在 GitHub 上查看

1. 访问：`https://github.com/13371/piccco3`
2. 点击 **Tags** 查看所有标签
3. 点击 **Branches** 查看所有分支
4. 点击标签或分支查看对应代码

### 在本地查看

```bash
# 查看所有标签
git tag -l

# 查看所有分支
git branch -a

# 查看标签信息
git show v1.0.0-backup-20251230

# 查看提交历史
git log --oneline --graph --all
```

---

## ⚠️ 回滚注意事项

### 1. 回滚前备份当前数据

```bash
# 在服务器上备份当前数据
cd /www/wwwroot/piccco3/backend
tar -czf /root/data-backup-$(date +%Y%m%d).tar.gz data/
```

### 2. 回滚后需要重新构建

```bash
# 前端重新构建
cd /www/wwwroot/piccco3
npm run build

# 后端重启
cd /www/wwwroot/piccco3/backend
pm2 restart piccco-backend
```

### 3. 检查服务状态

```bash
# 运行服务检查脚本
cd /www/wwwroot/piccco3
./check_services.sh
```

---

## 📅 定期备份建议

### 自动备份策略

1. **代码备份**：每次重要更新后创建标签
2. **数据备份**：每天自动备份用户数据
3. **配置备份**：每次修改配置后提交到 Git

### 创建新备份标签

```bash
# 创建新标签
git tag -a v1.0.1-backup-$(date +%Y%m%d) -m "Backup: 描述信息"

# 推送到 GitHub
git push origin v1.0.1-backup-$(date +%Y%m%d)
```

---

## 🔗 相关链接

- **GitHub 仓库**: https://github.com/13371/piccco3
- **备份标签**: https://github.com/13371/piccco3/releases/tag/v1.0.0-backup-20251230
- **备份分支**: https://github.com/13371/piccco3/tree/backup-stable-20251230

---

## ✅ 备份验证

### 验证备份是否成功

```bash
# 1. 检查标签是否存在
git tag -l | grep backup

# 2. 检查分支是否存在
git branch -a | grep backup

# 3. 检查远程仓库
git remote show origin

# 4. 测试回滚（创建测试分支）
git checkout -b test-rollback v1.0.0-backup-20251230
```

---

## 📝 备份记录

| 日期 | 标签 | 提交哈希 | 说明 |
|------|------|----------|------|
| 2025-12-30 | v1.0.0-backup-20251230 | 6ee1ddd | 稳定生产版本备份 |

---

**备份完成！** 所有代码已安全保存到 GitHub，可以随时回滚。

