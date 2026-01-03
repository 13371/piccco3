# 🚀 v1.171 立即部署指南

**版本**: v1.171（测试版）  
**Git 提交**: c435689  
**服务器**: 8.136.38.126  
**项目目录**: /www/wwwroot/piccco3

---

## 📋 快速部署（推荐）

### 方式一：使用部署脚本

在服务器上执行以下命令：

```bash
# 1. SSH 连接到服务器
ssh root@8.136.38.126

# 2. 进入项目目录
cd /www/wwwroot/piccco3

# 3. 拉取最新代码（如果遇到冲突，见下方"处理Git冲突"）
git pull origin main

# 4. 给脚本添加执行权限
chmod +x deploy.sh

# 5. 执行部署脚本
./deploy.sh
```

---

## 🔧 处理 Git 冲突

如果 `git pull` 遇到冲突，执行以下命令：

```bash
cd /www/wwwroot/piccco3

# 1. 暂存本地更改
git stash

# 2. 删除 .vite 目录（如果存在）
rm -rf .vite/

# 3. 硬重置到远程版本
git reset --hard origin/main

# 4. 清理未跟踪文件
git clean -fd

# 5. 再次拉取
git pull origin main

# 6. 执行部署
chmod +x deploy.sh
./deploy.sh
```

---

## 📝 手动部署步骤

如果自动脚本失败，可以手动执行：

### 1. 拉取代码

```bash
cd /www/wwwroot/piccco3
git pull origin main
```

### 2. 安装依赖

```bash
# 前端依赖
npm install

# 后端依赖
cd backend
npm install
cd ..
```

### 3. 构建前端

```bash
# 清理旧构建
rm -rf dist

# 构建前端
VITE_API_BASE_URL=/api npm run build

# 设置权限
chmod -R 755 dist
chown -R www:www dist
```

### 4. 重启后端服务

```bash
cd backend

# 检查服务状态
pm2 list | grep piccco-backend

# 重启服务
pm2 restart piccco-backend --update-env

# 如果服务不存在，启动新服务
# pm2 start src/server.js --name piccco-backend
# pm2 save
```

### 5. 重载 Nginx

```bash
# 检查配置
nginx -t

# 重载配置
nginx -s reload
```

---

## ✅ 部署后验证

### 1. 检查服务状态

```bash
# PM2 服务状态
pm2 status piccco-backend

# 查看后端日志
pm2 logs piccco-backend --lines 50

# Nginx 状态
systemctl status nginx
```

### 2. 测试访问

在浏览器中访问：
- **前端**: http://8.136.38.126
- **API健康检查**: http://8.136.38.126/api/health
- **管理员界面**: http://8.136.38.126/admin

### 3. 功能测试清单

- [ ] 登录/注册功能正常
- [ ] 创建/编辑/删除记事功能正常
- [ ] 文件夹管理功能正常
- [ ] 数据同步功能正常
- [ ] 语言切换功能正常（中英文）
- [ ] 错误边界功能正常（测试错误场景）

---

## 🐛 常见问题排查

### 问题1: Git 拉取失败

**错误**: `error: Your local changes to the following files would be overwritten by merge`

**解决**:
```bash
git stash
rm -rf .vite/
git reset --hard origin/main
git clean -fd
git pull origin main
```

### 问题2: 前端构建失败

**错误**: `npm run build` 失败

**解决**:
```bash
# 清理缓存
rm -rf node_modules
rm -rf .vite
npm install
VITE_API_BASE_URL=/api npm run build
```

### 问题3: PM2 服务启动失败

**错误**: `pm2 restart piccco-backend` 失败

**解决**:
```bash
# 查看详细错误
pm2 logs piccco-backend --err

# 检查环境变量
cd backend
cat .env

# 手动启动测试
node src/server.js
```

### 问题4: Nginx 配置错误

**错误**: `nginx -t` 检查失败

**解决**:
```bash
# 查看详细错误
nginx -t

# 检查配置文件
cat /etc/nginx/sites-enabled/piccco3.conf
```

### 问题5: 前端页面空白

**解决**:
```bash
# 检查构建文件
ls -la dist/

# 检查 Nginx 配置中的 root 路径
# 确保指向 /www/wwwroot/piccco3/dist
```

---

## 📊 本次更新内容

### ✨ 新增功能
- 全局错误边界（ErrorBoundary）
- 统一日志管理系统（logger）
- 完善代码注释（JSDoc）

### 🔧 功能优化
- 优化后端去重逻辑
- 完善前后端同步检查
- 改进错误处理
- 完善英语适配（URL页面、文件夹笔记页面、全部页面、分类页面）

### 🐛 问题修复
- 修复前后端同步逻辑一致性问题
- 修复后端去重逻辑不考虑删除状态的问题
- 修复多处硬编码中文文本未适配英文的问题

---

## 📞 需要帮助？

如果部署过程中遇到问题：

1. 查看日志：`pm2 logs piccco-backend`
2. 检查服务状态：`pm2 status`
3. 查看 Nginx 日志：`tail -f /var/log/nginx/error.log`
4. 参考详细文档：`DEPLOY_V1.171.md`

---

**部署完成时间**: _______________  
**部署人员**: _______________  
**备注**: _______________







