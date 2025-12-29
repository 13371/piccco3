# Git备份完整步骤指南

## 📋 当前状态

✅ **本地Git仓库已创建**
✅ **代码已提交到本地仓库**
✅ **.gitignore已配置（敏感文件已忽略）**

## 🚀 推送到远程Git仓库（GitHub/GitLab/Gitee）

### 步骤1: 创建远程仓库

#### 选项A: GitHub（推荐，全球使用）
1. 访问 https://github.com
2. 登录你的账户
3. 点击右上角 "+" → "New repository"
4. 填写仓库信息：
   - Repository name: `piccco`（或你喜欢的名字）
   - Description: `piccco应用 - 笔记、文件夹、URL管理应用`
   - 选择 Public 或 Private
   - **不要**勾选 "Initialize this repository with a README"
5. 点击 "Create repository"

#### 选项B: GitLab
1. 访问 https://gitlab.com
2. 登录你的账户
3. 点击 "New project" → "Create blank project"
4. 填写项目信息并创建

#### 选项C: Gitee（国内推荐，访问快）
1. 访问 https://gitee.com
2. 登录你的账户
3. 点击右上角 "+" → "新建仓库"
4. 填写仓库信息并创建

### 步骤2: 添加远程仓库

创建远程仓库后，GitHub/GitLab/Gitee会显示仓库地址，类似：
```
https://github.com/yourusername/piccco.git
或
git@github.com:yourusername/piccco.git
```

**在项目目录下运行**：
```bash
# 添加远程仓库（替换为你的实际地址）
git remote add origin https://github.com/yourusername/piccco.git

# 验证远程仓库
git remote -v
```

### 步骤3: 推送代码

```bash
# 重命名分支为main（如果当前是master）
git branch -M main

# 推送代码到远程仓库
git push -u origin main
```

**如果提示需要认证**：
- HTTPS方式：输入GitHub/GitLab用户名和密码（或Personal Access Token）
- SSH方式：需要配置SSH密钥

### 步骤4: 验证推送成功

访问你的远程仓库页面，应该能看到所有代码文件。

## 🔐 认证方式

### 方式1: HTTPS + Personal Access Token（推荐）

**GitHub**:
1. Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token
3. 选择权限：`repo`（完整仓库访问）
4. 复制token，推送时密码处输入token

**GitLab**:
1. Settings → Access Tokens
2. 创建token，权限选择 `write_repository`
3. 推送时使用token作为密码

**Gitee**:
1. 设置 → 安全设置 → 私人令牌
2. 生成新令牌，权限选择 `projects`
3. 推送时使用token作为密码

### 方式2: SSH密钥（更安全）

```bash
# 1. 生成SSH密钥（如果还没有）
ssh-keygen -t ed25519 -C "your_email@example.com"

# 2. 复制公钥
cat ~/.ssh/id_ed25519.pub

# 3. 添加到GitHub/GitLab/Gitee
# GitHub: Settings → SSH and GPG keys → New SSH key
# GitLab: Settings → SSH Keys
# Gitee: 设置 → SSH公钥

# 4. 使用SSH地址添加远程仓库
git remote set-url origin git@github.com:yourusername/piccco.git
```

## 📝 后续更新代码

推送代码后，每次修改代码后：

```bash
# 1. 查看更改
git status

# 2. 添加更改
git add .

# 3. 提交更改
git commit -m "描述你的更改"

# 4. 推送到远程
git push
```

## 🔄 从其他电脑拉取代码

```bash
# 1. 克隆仓库
git clone https://github.com/yourusername/piccco.git

# 2. 进入目录
cd piccco

# 3. 安装依赖
cd backend && npm install
cd ../frontend && npm install

# 4. 复制.env文件（从安全位置）
# 5. 启动服务
```

## ⚠️ 重要提醒

### 1. 敏感文件已自动忽略
以下文件**不会**被提交到Git：
- ✅ `.env` - 环境变量（包含JWT_SECRET等）
- ✅ `backend/data/` - 用户数据
- ✅ `node_modules/` - 依赖包
- ✅ `dist/` - 构建输出

### 2. 环境变量备份
`.env`文件需要单独备份（不要提交到Git）：
- 保存在安全位置
- 使用密码管理器
- 或创建`.env.example`模板（不包含真实值）

### 3. 定期备份
- ✅ 每次完成功能后提交
- ✅ 每天至少提交一次
- ✅ 重大更新立即推送

## 🎯 快速命令参考

```bash
# 查看状态
git status

# 添加所有更改
git add .

# 提交更改
git commit -m "更新描述"

# 推送到远程
git push

# 查看提交历史
git log --oneline

# 查看远程仓库
git remote -v

# 添加远程仓库
git remote add origin <仓库地址>

# 修改远程仓库地址
git remote set-url origin <新地址>
```

## 📞 常见问题

### Q: 推送时提示"Permission denied"
**A**: 需要配置认证（Personal Access Token或SSH密钥）

### Q: 推送时提示"Repository not found"
**A**: 检查仓库地址是否正确，是否有访问权限

### Q: 如何更新远程仓库地址？
**A**: `git remote set-url origin <新地址>`

### Q: 如何删除远程仓库？
**A**: `git remote remove origin`

## ✅ 完成检查清单

- [ ] 创建远程仓库（GitHub/GitLab/Gitee）
- [ ] 添加远程仓库地址
- [ ] 推送代码到远程
- [ ] 验证代码已上传
- [ ] 配置认证方式（Token或SSH）
- [ ] 测试拉取代码

## 🎉 完成！

代码成功推送到远程仓库后，你就可以：
- ✅ 在任何地方访问代码
- ✅ 多设备同步开发
- ✅ 版本历史完整记录
- ✅ 团队协作开发
- ✅ 代码备份安全

**你的代码已经安全备份！** 🎉

