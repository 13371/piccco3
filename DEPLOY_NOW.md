# 🚀 立即部署指南

## 📋 部署前准备

### 1. 本地检查清单

- [x] 代码已测试通过
- [x] 所有API正常
- [x] 前端构建成功
- [ ] 备份服务器现有数据（重要！）

### 2. 服务器信息

- **服务器IP**: `8.136.38.126`
- **项目目录**: `/www/wwwroot/piccco3`
- **后端端口**: `4000`
- **前端端口**: `80` (通过Nginx)

---

## 🎯 快速部署步骤

### 步骤1: 本地构建前端

```bash
# 在项目根目录
npm run build
```

构建完成后，检查 `dist/` 目录是否存在且包含文件。

### 步骤2: 上传代码到服务器

#### 方法一：使用 Git（推荐）

```bash
# 1. 提交所有更改到Git
git add .
git commit -m "准备部署：修复所有问题，优化代码结构"
git push origin main

# 2. SSH连接到服务器
ssh root@8.136.38.126

# 3. 在服务器上拉取最新代码
cd /www/wwwroot/piccco3
git pull origin main
```

#### 方法二：使用FTP/SFTP工具

1. 使用 FileZilla 或其他SFTP工具连接到服务器
2. 上传整个项目目录到 `/www/wwwroot/piccco3`
3. 确保覆盖所有文件

### 步骤3: 在服务器上安装依赖

```bash
# SSH连接到服务器
ssh root@8.136.38.126

# 进入项目目录
cd /www/wwwroot/piccco3

# 安装前端依赖（如果需要）
npm install

# 构建前端（如果未在本地构建）
npm run build

# 安装后端依赖
cd backend
npm install
```

### 步骤4: 配置后端环境变量

```bash
# 在服务器上
cd /www/wwwroot/piccco3/backend

# 检查 .env 文件是否存在
ls -la .env

# 如果不存在，创建 .env 文件
nano .env
```

**必需的环境变量**（参考现有配置或 `backend/.env.example`）：

```env
# 服务器配置
NODE_ENV=production
PORT=4000
FRONTEND_ORIGIN=http://8.136.38.126

# JWT密钥（必须更改！）
JWT_SECRET=your-random-secret-string-here

# Session密钥（必须更改！）
SESSION_SECRET=your-session-secret-here

# 邮件服务配置
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=z13371@qq.com
SMTP_PASS=sqyrwmowgvnogdea

# 管理员密码（使用哈希）
ADMIN_PASSWORD_HASH=$2a$10$your-hash-here
```

**生成JWT_SECRET和SESSION_SECRET**：

```bash
# 生成随机密钥
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 步骤5: 启动后端服务

```bash
# 使用PM2启动（推荐）
cd /www/wwwroot/piccco3/backend

# 停止旧服务（如果存在）
pm2 stop piccco-backend
pm2 delete piccco-backend

# 启动新服务
pm2 start src/server.js --name piccco-backend

# 保存PM2配置
pm2 save

# 设置开机自启
pm2 startup
```

**查看服务状态**：

```bash
pm2 list
pm2 logs piccco-backend
```

### 步骤6: 配置Nginx

#### 在宝塔面板中配置：

1. 登录宝塔面板：`http://8.136.38.126:8888`
2. 进入 **网站** → 选择你的网站
3. 点击 **设置** → **配置文件**
4. 使用以下配置：

```nginx
server {
    listen 80;
    server_name 8.136.38.126;  # 或你的域名
    
    # 前端静态文件
    root /www/wwwroot/piccco3/dist;
    index index.html;
    
    # 前端路由支持（SPA）
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # API代理到后端
    location /api {
        proxy_pass http://localhost:4000;
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
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

5. 保存并重启Nginx

#### 或使用命令行：

```bash
# 编辑Nginx配置
nano /www/server/panel/vhost/nginx/your-site.conf

# 重启Nginx
/etc/init.d/nginx restart
```

### 步骤7: 验证部署

```bash
# 1. 检查后端服务
curl http://localhost:4000/api/health
# 应该返回: {"status":"ok","timestamp":...}

# 2. 检查前端文件
ls -la /www/wwwroot/piccco3/dist/

# 3. 检查PM2状态
pm2 status
```

### 步骤8: 测试功能

在浏览器中访问：`http://8.136.38.126`

测试以下功能：
- [ ] 前端页面正常加载
- [ ] 用户注册功能
- [ ] 邮箱验证码发送
- [ ] 用户登录功能
- [ ] 数据同步功能
- [ ] 管理员登录（`/admin`）

---

## 🔄 更新部署（如果已有旧版本）

### 1. 备份现有数据

```bash
# SSH连接到服务器
ssh root@8.136.38.126

# 备份用户数据
cp -r /www/wwwroot/piccco3/backend/data /www/wwwroot/piccco3/backend/data.backup.$(date +%Y%m%d)

# 备份环境变量
cp /www/wwwroot/piccco3/backend/.env /www/wwwroot/piccco3/backend/.env.backup.$(date +%Y%m%d)
```

### 2. 停止服务

```bash
pm2 stop piccco-backend
```

### 3. 更新代码

```bash
cd /www/wwwroot/piccco3
git pull origin main
# 或上传新代码
```

### 4. 安装新依赖

```bash
# 前端
npm install

# 后端
cd backend
npm install
```

### 5. 重新构建前端

```bash
cd /www/wwwroot/piccco3
npm run build
```

### 6. 重启服务

```bash
cd backend
pm2 restart piccco-backend
# 或
pm2 stop piccco-backend
pm2 start src/server.js --name piccco-backend
```

### 7. 验证更新

```bash
pm2 logs piccco-backend
# 查看是否有错误
```

---

## ⚠️ 常见问题

### 1. 后端服务无法启动

```bash
# 检查端口是否被占用
lsof -i :4000

# 检查环境变量
cd /www/wwwroot/piccco3/backend
cat .env

# 查看详细错误
pm2 logs piccco-backend --lines 50
```

### 2. 前端无法访问

```bash
# 检查Nginx配置
nginx -t

# 检查前端文件
ls -la /www/wwwroot/piccco3/dist/

# 重启Nginx
/etc/init.d/nginx restart
```

### 3. API请求失败

```bash
# 检查后端服务
pm2 status

# 检查后端日志
pm2 logs piccco-backend

# 测试API
curl http://localhost:4000/api/health
```

### 4. 权限问题

```bash
# 确保文件权限正确
chown -R www:www /www/wwwroot/piccco3
chmod -R 755 /www/wwwroot/piccco3
```

---

## 📝 部署后检查清单

- [ ] 后端服务正常运行（`pm2 status`）
- [ ] 前端页面正常访问
- [ ] API接口正常响应
- [ ] 用户注册功能正常
- [ ] 邮箱验证码发送正常
- [ ] 用户登录功能正常
- [ ] 数据同步功能正常
- [ ] 管理员功能正常
- [ ] 所有API端点正常

---

## 🔗 相关文档

- `ALIYUN_BT_DEPLOYMENT_GUIDE.md` - 详细部署指南
- `DEPLOYMENT_CHECKLIST.md` - 部署检查清单
- `START_SERVICES.md` - 服务启动指南
- `backend/README.md` - 后端配置说明

---

**部署完成后，请测试所有功能，确保一切正常！**












