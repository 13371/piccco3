# 部署工作流程指南

## 📋 部署类型说明

### 1. **前端修改**（需要重新构建和部署）
- ✅ 修改了 `src/` 目录下的文件（React组件、样式等）
- ✅ 修改了 `index.html`
- ✅ 修改了 `package.json` 或 `vite.config.ts`
- ✅ 修改了任何前端配置文件

**部署步骤：**
```bash
cd /www/wwwroot/piccco3
npm run build
chmod -R 755 dist
chown -R www:www dist
nginx -s reload
```

### 2. **后端修改**（需要重启服务）
- ✅ 修改了 `backend/src/` 目录下的文件
- ✅ 修改了 `backend/package.json`
- ✅ 修改了后端配置文件

**部署步骤：**
```bash
cd /www/wwwroot/piccco3/backend
pm2 restart piccco-backend
```

### 3. **环境变量修改**（需要重启并更新环境变量）
- ✅ 修改了 `backend/.env` 文件

**部署步骤：**
```bash
cd /www/wwwroot/piccco3/backend
pm2 restart piccco-backend --update-env
```

### 4. **Nginx配置修改**（只需要重载Nginx）
- ✅ 修改了 Nginx 配置文件

**部署步骤：**
```bash
nginx -t  # 先测试配置
nginx -s reload  # 重载配置
```

---

## 🚀 快速部署方法

### 方法一：使用快速部署脚本（推荐）

```bash
cd /www/wwwroot/piccco3
chmod +x quick_deploy.sh
./quick_deploy.sh
```

**脚本功能：**
- 🔍 自动检测修改的文件类型
- 🎯 只部署需要更新的部分（前端或后端）
- ✅ 自动处理权限和Nginx重载
- 📝 显示部署状态和访问地址

### 方法二：使用现有脚本

**前端部署：**
```bash
cd /www/wwwroot/piccco3
./fix_build_and_deploy.sh
```

**后端部署：**
```bash
cd /www/wwwroot/piccco3/backend
pm2 restart piccco-backend
```

**完整更新（从Git拉取）：**
```bash
cd /www/wwwroot/piccco3
./update.sh
```

---

## 📝 日常开发工作流程

### 场景1：只修改了前端代码

```bash
# 1. 在本地修改代码
# 2. 提交到Git（可选）
git add .
git commit -m "修复移动端样式"
git push

# 3. 在服务器上部署
cd /www/wwwroot/piccco3
./quick_deploy.sh
# 或手动：
npm run build
chmod -R 755 dist && chown -R www:www dist
nginx -s reload
```

### 场景2：只修改了后端代码

```bash
# 1. 在本地修改代码
# 2. 提交到Git（可选）
git add .
git commit -m "修复API bug"
git push

# 3. 在服务器上部署
cd /www/wwwroot/piccco3
./quick_deploy.sh
# 或手动：
cd backend
pm2 restart piccco-backend
```

### 场景3：同时修改了前端和后端

```bash
# 使用快速部署脚本，会自动检测并部署两部分
cd /www/wwwroot/piccco3
./quick_deploy.sh
```

### 场景4：修改了环境变量

```bash
# 1. 修改 backend/.env 文件
# 2. 重启服务并更新环境变量
cd /www/wwwroot/piccco3/backend
pm2 restart piccco-backend --update-env
```

---

## ⚡ 优化建议

### 1. **使用Git自动部署（高级）**

可以设置Git钩子，在push后自动部署：

```bash
# 在服务器上设置 post-receive 钩子
cd /www/wwwroot/piccco3/.git/hooks
cat > post-receive << 'EOF'
#!/bin/bash
cd /www/wwwroot/piccco3
git pull origin main
./quick_deploy.sh
EOF
chmod +x post-receive
```

### 2. **使用PM2 Watch模式（开发环境）**

在开发时，可以让PM2自动重启：

```bash
pm2 start backend/src/server.js --name piccco-backend --watch
```

### 3. **使用Vite开发服务器（本地开发）**

在本地开发时，使用开发服务器，无需每次构建：

```bash
npm run dev
```

---

## 🔍 验证部署

部署后，检查以下内容：

```bash
# 1. 检查PM2服务状态
pm2 status

# 2. 检查PM2日志
pm2 logs piccco-backend --lines 50

# 3. 检查Nginx配置
nginx -t

# 4. 检查前端文件
ls -lh dist/

# 5. 测试API
curl http://127.0.0.1:4000/api/auth/me

# 6. 测试前端
curl -H "Host: 8.136.38.126" http://127.0.0.1/
```

---

## ❓ 常见问题

### Q: 修改了代码但看不到效果？

**A:** 检查以下几点：
1. ✅ 是否重新构建了前端？（`npm run build`）
2. ✅ 是否重启了后端服务？（`pm2 restart piccco-backend`）
3. ✅ 是否清除了浏览器缓存？
4. ✅ 是否检查了浏览器控制台的错误？

### Q: 部署后服务无法启动？

**A:** 检查日志：
```bash
# PM2日志
pm2 logs piccco-backend

# Nginx错误日志
tail -f /www/server/nginx/logs/error.log

# 系统日志
journalctl -u nginx -n 50
```

### Q: 如何回滚到之前的版本？

**A:** 使用Git回滚：
```bash
cd /www/wwwroot/piccco3
git log  # 查看提交历史
git checkout <commit-hash>  # 回滚到指定版本
./quick_deploy.sh  # 重新部署
```

---

## 📚 相关文档

- `quick_deploy.sh` - 快速部署脚本
- `fix_build_and_deploy.sh` - 前端构建和部署脚本
- `update.sh` - 完整更新脚本
- `GITHUB_BACKUP_GUIDE.md` - Git备份指南

---

**最后更新**: 2025-12-30

















