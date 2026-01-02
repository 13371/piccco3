# 🚀 Piccco3 完整部署指南

## 📋 目录

1. [部署前准备](#部署前准备)
2. [首次部署步骤](#首次部署步骤)
3. [日常更新部署](#日常更新部署)
4. [部署脚本说明](#部署脚本说明)
5. [验证和测试](#验证和测试)
6. [故障排查](#故障排查)

---

## 📦 部署前准备

### 1. 服务器要求

- **操作系统**: Ubuntu 20.04+ / CentOS 7+
- **Node.js**: v18.0.0 或更高版本
- **Nginx**: 1.18+（用于前端静态文件服务）
- **PM2**: 用于后端进程管理
- **Git**: 用于代码拉取

### 2. 服务器信息

根据你的实际情况填写：

- **服务器IP**: `8.136.38.126`（示例）
- **项目目录**: `/www/wwwroot/piccco3`
- **后端端口**: `4000`
- **前端端口**: `80` (通过 Nginx)

### 3. 必需软件安装

```bash
# 1. 安装 Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. 安装 PM2（进程管理器）
npm install -g pm2

# 3. 安装 Git（如果未安装）
sudo apt-get install -y git

# 4. 安装 Nginx（如果使用宝塔面板，已自动安装）
sudo apt-get install -y nginx
```

### 4. 环境变量准备

在部署前，需要准备以下环境变量：

```bash
# 生成 JWT_SECRET（64字符随机字符串）
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# 生成 SESSION_SECRET（32字符随机字符串）
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 🎯 首次部署步骤

### 步骤 1: 克隆代码到服务器

```bash
# SSH 连接到服务器
ssh root@8.136.38.126

# 创建项目目录
mkdir -p /www/wwwroot/piccco3
cd /www/wwwroot/piccco3

# 克隆代码
git clone https://github.com/13371/piccco3.git .

# 或者如果已经存在，拉取最新代码
git pull origin main
```

### 步骤 2: 安装依赖

```bash
# 安装前端依赖
npm install

# 安装后端依赖
cd backend
npm install
cd ..
```

### 步骤 3: 配置环境变量

```bash
# 进入后端目录
cd backend

# 创建 .env 文件
nano .env
```

**必需的环境变量**（复制并修改）：

```env
# 服务器配置
NODE_ENV=production
PORT=4000
FRONTEND_ORIGIN=http://8.136.38.126

# JWT密钥（必须更改！使用上面生成的随机字符串）
JWT_SECRET=your-generated-jwt-secret-here

# Session密钥（必须更改！使用上面生成的随机字符串）
SESSION_SECRET=your-generated-session-secret-here

# 管理员密码哈希（如果已有，保持不变）
ADMIN_PASSWORD_HASH=$2a$10$aF8q5ubpe32qOUhiwAzd...

# SMTP配置（邮箱验证码发送）
SMTP_HOST=smtp.qq.com
SMTP_USER=your-email@qq.com
SMTP_PASS=your-email-password

# 可选配置
LOG_LEVEL=info
```

保存文件：`Ctrl + O` → `Enter` → `Ctrl + X`

### 步骤 4: 构建前端

```bash
# 返回项目根目录
cd /www/wwwroot/piccco3

# 构建前端（设置API基础URL为 /api）
VITE_API_BASE_URL=/api npm run build

# 设置文件权限
chmod -R 755 dist
chown -R www:www dist  # 如果使用宝塔面板，用户可能是 www
```

### 步骤 5: 启动后端服务

```bash
# 进入后端目录
cd /www/wwwroot/piccco3/backend

# 使用 PM2 启动后端服务
pm2 start src/server.js --name piccco-backend

# 保存 PM2 配置（开机自启）
pm2 save

# 设置 PM2 开机自启
pm2 startup
```

### 步骤 6: 配置 Nginx

#### 方法一：使用宝塔面板（推荐）

1. 登录宝塔面板
2. 进入 **网站** → 选择你的网站（或创建新网站）
3. 点击 **设置** → **配置文件**
4. 将以下配置添加到配置文件中：

```nginx
server {
    listen 80;
    server_name 8.136.38.126;  # 替换为你的域名或IP
    
    # 前端静态文件
    root /www/wwwroot/piccco3/dist;
    index index.html;
    
    # 前端路由（SPA支持）
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # API代理到后端
    location /api {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # 管理员界面（如果需要）
    location /admin {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

5. 保存并重启 Nginx

#### 方法二：手动配置

```bash
# 备份原配置
sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.bak

# 编辑配置文件
sudo nano /etc/nginx/sites-available/default

# 将上面的配置添加到文件中，然后保存

# 测试配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx
```

### 步骤 7: 验证部署

```bash
# 1. 检查 PM2 服务状态
pm2 status

# 2. 检查后端日志
pm2 logs piccco-backend --lines 50

# 3. 测试后端 API
curl http://localhost:4000/api/health

# 4. 测试前端文件
ls -la /www/wwwroot/piccco3/dist/

# 5. 检查 Nginx 状态
sudo systemctl status nginx
```

### 步骤 8: 访问应用

在浏览器中访问：

- **前端**: `http://8.136.38.126`
- **管理员界面**: `http://8.136.38.126/admin`
- **API健康检查**: `http://8.136.38.126/api/health`

---

## 🔄 日常更新部署

### 方法一：使用快速部署脚本（推荐）

```bash
# SSH 连接到服务器
ssh root@8.136.38.126

# 进入项目目录
cd /www/wwwroot/piccco3

# 拉取最新代码
git pull origin main

# 运行快速部署脚本
chmod +x quick_deploy.sh
./quick_deploy.sh
```

脚本会自动：
- ✅ 检测修改的文件类型（前端/后端）
- ✅ 只部署需要更新的部分
- ✅ 自动构建前端（如果前端有修改）
- ✅ 自动重启后端（如果后端有修改）
- ✅ 重载 Nginx 配置

### 方法二：使用完整部署脚本

```bash
# SSH 连接到服务器
ssh root@8.136.38.126

# 进入项目目录
cd /www/wwwroot/piccco3

# 拉取最新代码
git pull origin main

# 运行完整部署脚本
chmod +x deploy_server.sh
./deploy_server.sh
```

### 方法三：手动部署

#### 只更新前端

```bash
cd /www/wwwroot/piccco3
git pull origin main
VITE_API_BASE_URL=/api npm run build
chmod -R 755 dist
chown -R www:www dist
sudo nginx -s reload
```

#### 只更新后端

```bash
cd /www/wwwroot/piccco3
git pull origin main
cd backend
npm install  # 如果有新的依赖
pm2 restart piccco-backend --update-env
```

#### 更新环境变量

```bash
# 修改 backend/.env 文件后
cd /www/wwwroot/piccco3/backend
pm2 restart piccco-backend --update-env
```

---

## 📜 部署脚本说明

### 1. `quick_deploy.sh` - 快速部署脚本

**功能**:
- 自动检测修改的文件类型
- 智能部署（只部署需要更新的部分）
- 交互式确认

**使用场景**: 日常代码更新

**使用方法**:
```bash
cd /www/wwwroot/piccco3
./quick_deploy.sh
```

### 2. `deploy_server.sh` - 完整部署脚本

**功能**:
- 安装依赖
- 构建前端
- 重启后端
- 重载 Nginx

**使用场景**: 首次部署或完整更新

**使用方法**:
```bash
cd /www/wwwroot/piccco3
./deploy_server.sh
```

### 3. `update.sh` - 更新脚本

**功能**:
- 从 Git 拉取最新代码
- 安装依赖
- 构建前端
- 重启服务

**使用场景**: 从远程仓库更新代码

---

## ✅ 验证和测试

### 1. 服务状态检查

```bash
# PM2 服务状态
pm2 status

# PM2 日志
pm2 logs piccco-backend --lines 100

# Nginx 状态
sudo systemctl status nginx

# Nginx 配置测试
sudo nginx -t
```

### 2. API 测试

```bash
# 健康检查
curl http://localhost:4000/api/health

# 测试认证（需要先注册/登录获取token）
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:4000/api/auth/me
```

### 3. 前端测试

在浏览器中测试：

- [ ] 前端页面正常加载
- [ ] 用户注册功能
- [ ] 邮箱验证码发送
- [ ] 用户登录功能
- [ ] 数据同步功能
- [ ] 管理员登录功能
- [ ] 多设备同步功能

### 4. 性能检查

```bash
# 检查后端进程
ps aux | grep node

# 检查端口占用
netstat -tlnp | grep 4000

# 检查磁盘空间
df -h

# 检查内存使用
free -h
```

---

## 🔧 故障排查

### 问题 1: 后端服务无法启动

**检查步骤**:

```bash
# 1. 查看 PM2 日志
pm2 logs piccco-backend

# 2. 检查环境变量
cd /www/wwwroot/piccco3/backend
cat .env

# 3. 手动启动测试
node src/server.js

# 4. 检查端口占用
netstat -tlnp | grep 4000
```

**常见原因**:
- 环境变量未配置或配置错误
- 端口被占用
- 依赖未安装

### 问题 2: 前端无法访问

**检查步骤**:

```bash
# 1. 检查 dist 目录
ls -la /www/wwwroot/piccco3/dist/

# 2. 检查文件权限
ls -la /www/wwwroot/piccco3/dist/index.html

# 3. 检查 Nginx 配置
sudo nginx -t

# 4. 查看 Nginx 错误日志
sudo tail -f /var/log/nginx/error.log
```

**常见原因**:
- dist 目录不存在或为空（需要重新构建）
- 文件权限不正确
- Nginx 配置错误

### 问题 3: API 请求失败

**检查步骤**:

```bash
# 1. 检查后端服务是否运行
pm2 status

# 2. 测试本地 API
curl http://localhost:4000/api/health

# 3. 检查 Nginx 代理配置
sudo cat /etc/nginx/sites-available/default | grep -A 10 "/api"

# 4. 查看后端日志
pm2 logs piccco-backend
```

**常见原因**:
- 后端服务未启动
- Nginx 代理配置错误
- CORS 配置问题

### 问题 4: 数据同步失败

**检查步骤**:

```bash
# 1. 检查后端日志
pm2 logs piccco-backend | grep sync

# 2. 检查数据目录权限
ls -la /www/wwwroot/piccco3/backend/data/

# 3. 测试 API
curl -H "Authorization: Bearer TOKEN" http://localhost:4000/api/data/sync
```

---

## 📝 部署检查清单

### 部署前检查

- [ ] 代码已提交到 GitHub
- [ ] 服务器环境已准备（Node.js, PM2, Nginx）
- [ ] 环境变量已配置（JWT_SECRET, SESSION_SECRET等）
- [ ] 服务器端口已开放（80, 443, 4000）

### 部署中检查

- [ ] 代码拉取成功
- [ ] 依赖安装成功
- [ ] 前端构建成功
- [ ] 后端服务启动成功
- [ ] Nginx 配置正确

### 部署后检查

- [ ] 前端页面正常访问
- [ ] API 接口正常响应
- [ ] 用户注册/登录功能正常
- [ ] 数据同步功能正常
- [ ] 管理员功能正常

---

## 🔐 安全建议

1. **更改默认密钥**
   - JWT_SECRET 必须使用随机字符串
   - SESSION_SECRET 必须使用随机字符串

2. **配置 HTTPS**
   - 使用 Let's Encrypt 免费证书
   - 在 Nginx 中配置 SSL

3. **防火墙配置**
   - 只开放必要的端口
   - 限制管理端口访问IP

4. **定期备份**
   - 备份用户数据（`backend/data/`）
   - 备份配置文件（`.env`）

---

## 📞 获取帮助

如果遇到问题：

1. 查看日志文件
2. 检查服务状态
3. 参考故障排查部分
4. 查看 GitHub Issues

---

**最后更新**: 2025-01-XX  
**维护者**: AI Assistant

