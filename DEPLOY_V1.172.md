# v1.172（测试版）部署指南

**部署日期**: 2026-01-03  
**版本号**: v1.172（测试版）  
**Git 提交**: e7a6327

---

## 📋 部署前检查

### 1. 确认代码已推送到 GitHub
- ✅ 版本号已更新为 v1.172（测试版）
- ✅ 所有更改已提交并推送到 GitHub
- ✅ Git 提交 ID: e7a6327

### 2. 服务器环境检查
- ✅ Node.js 已安装
- ✅ npm 已安装
- ✅ PM2 已安装并配置
- ✅ Nginx 已安装并配置
- ✅ Git 已安装

---

## 🚀 部署步骤

### 方式一：使用完整部署脚本（推荐）

```bash
# 1. 连接到服务器
ssh root@8.136.38.126

# 2. 进入项目目录
cd /www/wwwroot/piccco3

# 3. 执行完整部署脚本
./deploy.sh
```

### 方式二：使用快速部署脚本

```bash
# 1. 连接到服务器
ssh root@8.136.38.126

# 2. 进入项目目录
cd /www/wwwroot/piccco3

# 3. 执行快速部署脚本
./quick_deploy.sh
```

### 方式三：手动部署

```bash
# 1. 连接到服务器
ssh root@8.136.38.126

# 2. 进入项目目录
cd /www/wwwroot/piccco3

# 3. 拉取最新代码
git pull origin main

# 4. 安装前端依赖（如果需要）
npm install

# 5. 安装后端依赖（如果需要）
cd backend
npm install
cd ..

# 6. 构建前端
rm -rf dist
VITE_API_BASE_URL=/api npm run build

# 7. 设置文件权限
chmod -R 755 dist
chown -R www:www dist

# 8. 重启后端服务
pm2 restart piccco-backend --update-env

# 9. 重载 Nginx
nginx -s reload
```

---

## ✅ 部署验证

### 1. 检查服务状态

```bash
# 检查 PM2 服务状态
pm2 status piccco-backend

# 检查后端日志
pm2 logs piccco-backend --lines 50

# 检查 Nginx 配置
nginx -t
```

### 2. 访问测试

- **前端**: http://8.136.38.126
- **管理员**: http://8.136.38.126/admin
- **API健康检查**: http://8.136.38.126/api/health

### 3. 功能测试

#### 标题输入框测试
1. ✅ 新建记事，点击标题输入框，输入文字，确认光标不会跳转
2. ✅ 编辑现有记事，修改标题，确认光标不会跳转
3. ✅ 确认内容框的自动聚焦功能仍然正常

#### 移动端测试（如适用）
1. ✅ 在移动设备上打开应用
2. ✅ 新建记事，点击标题输入框，输入文字，确认光标不会跳转
3. ✅ 测试键盘弹出/收起时的焦点行为

---

## 🔧 本次更新内容

### 修复内容
- ✅ 修复标题输入框焦点问题
- ✅ 优化移动端标题输入体验
- ✅ 改进焦点管理机制

### 更新的文件
- `src/pages/NewNotePage.tsx` - 修复标题输入框焦点问题
- `src/pages/AboutPage.tsx` - 更新版本号
- `src/pages/SettingsPage.tsx` - 更新版本号和说明
- `src/i18n/translations.ts` - 更新版本描述

---

## 🐛 故障排查

### 问题 1: Git 拉取失败
```bash
# 检查 Git 状态
git status

# 如果有冲突，先解决冲突
git stash
git pull origin main
git stash pop
```

### 问题 2: 前端构建失败
```bash
# 清理 node_modules 和缓存
rm -rf node_modules
rm -rf dist
npm cache clean --force
npm install
npm run build
```

### 问题 3: 后端服务启动失败
```bash
# 查看详细日志
pm2 logs piccco-backend --lines 100

# 检查环境变量
cat backend/.env

# 手动启动测试
cd backend
node src/server.js
```

### 问题 4: Nginx 重载失败
```bash
# 检查 Nginx 配置
nginx -t

# 查看 Nginx 错误日志
tail -f /var/log/nginx/error.log
```

---

## 📊 部署检查清单

- [ ] Git 代码已拉取最新版本
- [ ] 前端依赖已安装
- [ ] 后端依赖已安装
- [ ] 前端构建成功
- [ ] 文件权限设置正确
- [ ] 后端服务运行正常
- [ ] Nginx 配置正确
- [ ] 前端页面可以正常访问
- [ ] API 健康检查正常
- [ ] 标题输入框功能测试通过

---

## 🎉 部署完成

部署完成后，请进行以下验证：

1. ✅ 访问前端页面，确认版本号显示为 v1.172（测试版）
2. ✅ 测试新建记事功能，确认标题输入框可以正常输入
3. ✅ 测试编辑记事功能，确认标题输入框可以正常修改
4. ✅ 检查设置页面的版本更新说明，确认 v1.172 的更新内容已显示

---

**部署人员**: _______________  
**部署时间**: _______________  
**验证人员**: _______________  
**备注**: _______________






