# v1.171（测试版）部署指南

**版本**: v1.171（测试版）  
**更新日期**: 2026-01-03  
**Git 提交**: c435689

---

## 📋 更新内容

### ✨ 新增功能
- **全局错误边界（ErrorBoundary）**: 捕获渲染错误，防止应用崩溃，提升稳定性
- **统一日志管理系统**: 使用 logger 替代 console，生产环境自动过滤调试日志，提升性能
- **完善代码注释**: 为复杂逻辑添加 JSDoc 注释，提升代码可维护性

### 🔧 功能优化
- **优化后端去重逻辑**: 考虑删除状态，确保删除操作不会丢失，提升数据一致性
- **完善前后端同步检查**: 全面检查 API 路径、数据同步逻辑、多设备同步机制
- **改进错误处理**: 优化异步函数错误处理，修复 setTimeout 中的错误处理问题
- **完善英语适配**: 所有主要页面已完成英语适配，支持中英文切换

### 🐛 问题修复
- 修复前后端同步逻辑一致性问题
- 修复后端去重逻辑不考虑删除状态的问题
- 修复多处硬编码中文文本未适配英文的问题

---

## 🚀 部署步骤

### 方式一：使用部署脚本（推荐）

在服务器上执行：

```bash
cd /www/wwwroot/piccco3
git pull origin main
chmod +x deploy.sh
./deploy.sh
```

### 方式二：手动部署

#### 1. 拉取最新代码

```bash
cd /www/wwwroot/piccco3
git pull origin main
```

如果遇到冲突，执行：

```bash
git stash
rm -rf .vite/
git reset --hard origin/main
git clean -fd
git pull origin main
```

#### 2. 安装依赖

```bash
# 安装前端依赖
npm install

# 安装后端依赖
cd backend
npm install
cd ..
```

#### 3. 构建前端

```bash
# 清理旧的构建文件
rm -rf dist

# 构建前端（设置 API 基础 URL）
VITE_API_BASE_URL=/api npm run build

# 设置文件权限
chmod -R 755 dist
chown -R www:www dist
```

#### 4. 重启后端服务

```bash
cd backend

# 检查服务是否存在
pm2 list | grep piccco-backend

# 重启服务
pm2 restart piccco-backend --update-env

# 如果服务不存在，启动新服务
# pm2 start src/server.js --name piccco-backend
# pm2 save
```

#### 5. 重载 Nginx

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
# 检查 PM2 服务
pm2 status piccco-backend

# 检查后端日志
pm2 logs piccco-backend --lines 50

# 检查 Nginx 状态
systemctl status nginx
```

### 2. 访问测试

- **前端**: http://8.136.38.126
- **API健康检查**: http://8.136.38.126/api/health
- **管理员界面**: http://8.136.38.126/admin

### 3. 功能测试

- [ ] 登录/注册功能正常
- [ ] 创建/编辑/删除记事功能正常
- [ ] 文件夹管理功能正常
- [ ] 数据同步功能正常
- [ ] 语言切换功能正常（中英文）
- [ ] 错误边界功能正常（测试错误场景）

---

## 📝 注意事项

### 1. 环境变量

确保后端 `.env` 文件配置正确：

```bash
cd /www/wwwroot/piccco3/backend
cat .env
```

必要配置项：
- `JWT_SECRET`
- `SESSION_SECRET`
- `FRONTEND_ORIGIN`
- `NODE_ENV=production`

### 2. 文件权限

确保以下目录权限正确：

```bash
# 前端构建目录
chmod -R 755 /www/wwwroot/piccco3/dist
chown -R www:www /www/wwwroot/piccco3/dist

# 后端数据目录
chmod -R 755 /www/wwwroot/piccco3/backend/data
chown -R www:www /www/wwwroot/piccco3/backend/data
```

### 3. 日志查看

如果遇到问题，查看日志：

```bash
# 后端日志
pm2 logs piccco-backend

# Nginx 错误日志
tail -f /var/log/nginx/error.log

# Nginx 访问日志
tail -f /var/log/nginx/access.log
```

### 4. 回滚方案

如果部署后出现问题，可以回滚到上一个版本：

```bash
cd /www/wwwroot/piccco3
git log --oneline -10  # 查看提交历史
git checkout <上一个提交的hash>
./deploy.sh
```

---

## 🔍 常见问题

### Q1: 构建失败

**问题**: `npm run build` 失败

**解决**:
```bash
# 清理缓存
rm -rf node_modules
rm -rf .vite
npm install
npm run build
```

### Q2: PM2 服务启动失败

**问题**: `pm2 restart piccco-backend` 失败

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

### Q3: Nginx 配置错误

**问题**: `nginx -t` 检查失败

**解决**:
```bash
# 查看详细错误
nginx -t

# 检查配置文件
cat /etc/nginx/sites-enabled/piccco3.conf
```

### Q4: 前端页面空白

**问题**: 访问前端页面显示空白

**解决**:
```bash
# 检查构建文件
ls -la dist/

# 检查 Nginx 配置中的 root 路径
# 确保指向 /www/wwwroot/piccco3/dist
```

---

## 📊 部署检查清单

- [ ] Git 代码已拉取到最新版本
- [ ] 前端依赖已安装
- [ ] 后端依赖已安装
- [ ] 前端构建成功（无错误）
- [ ] 后端服务运行正常（PM2 status 显示 online）
- [ ] Nginx 配置已重载
- [ ] 前端页面可以正常访问
- [ ] API 接口可以正常访问
- [ ] 登录功能正常
- [ ] 数据同步功能正常
- [ ] 语言切换功能正常

---

## 📞 支持

如果部署过程中遇到问题，请：

1. 查看日志文件
2. 检查服务状态
3. 参考 `FRONTEND_BACKEND_SYNC_CHECK_REPORT.md` 报告
4. 联系技术支持

---

**部署完成时间**: _______________  
**部署人员**: _______________  
**备注**: _______________








