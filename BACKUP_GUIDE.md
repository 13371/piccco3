# 代码备份指南

## 📦 已完成的备份操作

### 1. **Git版本控制** ✅
- ✅ 已初始化Git仓库
- ✅ 已创建初始提交
- ✅ 已配置.gitignore（忽略敏感文件）

### 2. **当前Git状态**
```bash
# 查看提交历史
git log

# 查看当前状态
git status

# 查看文件变更
git diff
```

## 🔐 重要文件说明

### 不应提交到Git的文件（已在.gitignore中）
- ✅ `.env` - 环境变量（包含敏感信息）
- ✅ `backend/data/` - 用户数据文件
- ✅ `node_modules/` - 依赖包
- ✅ `dist/` - 构建输出

### 需要手动备份的文件
- ⚠️ `.env` - 环境变量配置文件（包含JWT_SECRET、数据库密码等）
- ⚠️ `backend/data/` - 用户数据（如果需要备份）

## 💾 备份方案

### 方案1: Git本地仓库（已完成）✅
**优点**: 
- 版本历史完整
- 可以回退到任意版本
- 轻量级

**使用方法**:
```bash
# 查看提交历史
git log --oneline

# 创建新提交
git add .
git commit -m "描述你的更改"

# 回退到之前的版本
git checkout <commit-hash>
```

### 方案2: 远程Git仓库（推荐）⭐
**推荐平台**:
- GitHub (https://github.com)
- GitLab (https://gitlab.com)
- Gitee (https://gitee.com) - 国内访问快

**操作步骤**:
```bash
# 1. 在GitHub/GitLab创建新仓库

# 2. 添加远程仓库
git remote add origin https://github.com/yourusername/piccco.git

# 3. 推送代码
git branch -M main
git push -u origin main

# 4. 后续更新
git add .
git commit -m "更新描述"
git push
```

### 方案3: 压缩包备份
**创建备份压缩包**:
```bash
# Windows PowerShell
Compress-Archive -Path . -DestinationPath ../piccco-backup-$(Get-Date -Format 'yyyyMMdd').zip -Exclude node_modules,backend/data,dist

# 或手动压缩（排除node_modules和backend/data目录）
```

**建议频率**: 每周或重大更新后

### 方案4: 云存储备份
**推荐服务**:
- 百度网盘
- 阿里云盘
- OneDrive
- Google Drive

**备份内容**:
- 整个项目文件夹（排除node_modules）
- `.env`文件（单独加密备份）
- 数据库备份（如果有）

## 📋 备份检查清单

### 代码备份 ✅
- [x] Git仓库初始化
- [x] 初始提交创建
- [x] .gitignore配置
- [ ] 远程仓库推送（可选）
- [ ] 定期提交更新

### 配置备份 ⚠️
- [ ] `.env`文件备份（加密存储）
- [ ] 环境变量文档记录
- [ ] 数据库配置备份（如果有）

### 数据备份 ⚠️
- [ ] `backend/data/`目录备份（如果需要）
- [ ] 用户数据导出（如果需要）

## 🚀 快速备份命令

### 创建完整备份
```bash
# 1. 提交所有更改
git add .
git commit -m "备份: $(Get-Date -Format 'yyyy-MM-dd HH:mm')"

# 2. 创建压缩包（排除node_modules和data）
$date = Get-Date -Format 'yyyyMMdd-HHmmss'
Compress-Archive -Path . -DestinationPath "../piccco-backup-$date.zip" -Force
```

### 推送到远程仓库
```bash
# 如果已配置远程仓库
git push origin main

# 如果未配置，先添加远程仓库
git remote add origin <your-repo-url>
git push -u origin main
```

## ⚠️ 重要提醒

### 1. **环境变量安全**
- ⚠️ **永远不要**将`.env`文件提交到Git
- ⚠️ **永远不要**将`.env`文件分享给他人
- ✅ 使用`.env.example`作为模板（不包含真实值）

### 2. **用户数据安全**
- ⚠️ `backend/data/`包含用户敏感数据
- ✅ 已在.gitignore中排除
- ⚠️ 如需备份，请加密存储

### 3. **定期备份**
- ✅ 每次重大更新后提交Git
- ✅ 每周创建压缩包备份
- ✅ 每月推送到远程仓库

## 📝 备份最佳实践

1. **Git提交规范**
   ```
   git commit -m "类型: 简短描述
   
   详细说明（可选）
   - 功能1
   - 功能2
   ```

2. **提交频率**
   - 每次完成一个功能就提交
   - 每天至少提交一次
   - 重大更新立即提交

3. **分支管理**
   ```bash
   # 创建功能分支
   git checkout -b feature/new-feature
   
   # 完成后合并
   git checkout main
   git merge feature/new-feature
   ```

## 🎯 推荐备份策略

### 日常开发
1. ✅ Git本地提交（每次更改）
2. ✅ 每周推送到远程仓库

### 重要节点
1. ✅ Git标签标记版本
   ```bash
   git tag -a v1.0.0 -m "版本1.0.0"
   git push origin v1.0.0
   ```

2. ✅ 创建压缩包备份

3. ✅ 推送到多个远程仓库（GitHub + GitLab）

## 📞 恢复代码

### 从Git恢复
```bash
# 查看所有提交
git log --oneline

# 恢复到指定提交
git checkout <commit-hash>

# 恢复到最新版本
git checkout main
```

### 从压缩包恢复
1. 解压备份文件
2. 运行 `npm install` 安装依赖
3. 复制`.env`文件（从安全位置）
4. 启动服务

## ✅ 总结

**当前状态**:
- ✅ Git仓库已初始化
- ✅ 初始提交已创建
- ✅ .gitignore已配置

**下一步建议**:
1. 推送到远程Git仓库（GitHub/GitLab）
2. 定期提交代码更新
3. 创建.env.example模板文件
4. 设置定期备份提醒

**你的代码已经安全保存！** 🎉

