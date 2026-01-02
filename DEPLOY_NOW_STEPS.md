# 🚀 立即部署步骤

## 📋 部署前确认

- [x] 代码已推送到 GitHub
- [x] 版本信息已更新（v1.16）
- [x] 部署脚本已准备就绪

## 🎯 在服务器上执行以下命令

### 方法一：使用完整部署脚本（推荐）

```bash
# 1. SSH 连接到服务器
ssh root@8.136.38.126

# 2. 进入项目目录
cd /www/wwwroot/piccco3

# 3. 拉取最新代码
git pull origin main

# 4. 给脚本添加执行权限（如果还没有）
chmod +x deploy.sh

# 5. 执行部署脚本
./deploy.sh
```

### 方法二：使用快速部署脚本

```bash
# 1. SSH 连接到服务器
ssh root@8.136.38.126

# 2. 进入项目目录
cd /www/wwwroot/piccco3

# 3. 拉取最新代码
git pull origin main

# 4. 执行快速部署脚本
chmod +x quick_deploy.sh
./quick_deploy.sh
```

### 方法三：手动部署步骤

```bash
# 1. SSH 连接到服务器
ssh root@8.136.38.126

# 2. 进入项目目录
cd /www/wwwroot/piccco3

# 3. 拉取最新代码
git pull origin main

# 4. 安装依赖（如果需要）
npm install
cd backend && npm install && cd ..

# 5. 构建前端
VITE_API_BASE_URL=/api npm run build

# 6. 设置文件权限
chmod -R 755 dist
chown -R www:www dist

# 7. 重启后端服务
cd backend
pm2 restart piccco-backend --update-env

# 8. 重载 Nginx
nginx -s reload
```

## ✅ 部署后验证

```bash
# 1. 检查 PM2 服务状态
pm2 status

# 2. 查看后端日志
pm2 logs piccco-backend --lines 50

# 3. 测试 API
curl http://localhost:4000/api/health

# 4. 检查前端文件
ls -la /www/wwwroot/piccco3/dist/
```

## 🌐 访问验证

在浏览器中访问：
- 前端: http://8.136.38.126
- 管理员: http://8.136.38.126/admin
- API健康检查: http://8.136.38.126/api/health

## 📝 注意事项

1. **环境变量**: 确保 `backend/.env` 文件已正确配置
2. **文件权限**: 确保 dist 目录权限正确（755，用户组 www）
3. **服务状态**: 部署后检查 PM2 和 Nginx 服务状态
4. **日志检查**: 如有问题，查看 PM2 日志排查

---

**部署时间**: 2026-01-XX  
**版本**: v1.16（测试版）

