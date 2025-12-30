# 阿里云 + 宝塔面板部署完整指南

**服务器信息**:
- **实例ID**: `iZbp17gc5tkznjqm3aef2bZ`
- **公网IP**: `8.136.38.126`
- **系统**: Ubuntu 24.04 64位
- **配置**: 2核2GB

---

## 📋 部署前准备清单

- [ ] 启动阿里云 ECS 实例
- [ ] 安装宝塔面板
- [ ] 配置安全组（开放端口）
- [ ] 安装 Node.js 环境
- [ ] 配置域名（可选）
- [ ] 配置 SSL 证书（可选）

---

## 第一步：启动阿里云 ECS 实例

1. **登录阿里云控制台**
   - 访问：https://ecs.console.aliyun.com
   - 找到实例：`iZbp17gc5tkznjqm3aef2bZ`

2. **启动实例**
   - 点击 **"启动"** 按钮
   - 等待实例启动完成（状态变为"运行中"）

3. **记录服务器信息**
   - 公网IP: `8.136.38.126`
   - 确保安全组已开放端口：`22`（SSH）、`80`（HTTP）、`443`（HTTPS）、`4000`（后端API，可选）

---

## 第二步：安装宝塔面板

### 2.1 通过 SSH 连接服务器

```bash
# Windows 使用 PowerShell 或 CMD
ssh root@8.136.38.126

# 如果提示输入密码，请输入服务器密码
```

### 2.2 安装宝塔面板

```bash
# Ubuntu/Debian 安装命令
wget -O install.sh https://download.bt.cn/install/install-ubuntu_6.0.sh && sudo bash install.sh ed8484bec

# 安装完成后会显示：
# - 面板地址
# - 用户名
# - 密码
# ⚠️ 请务必保存这些信息！
```

### 2.3 登录宝塔面板

1. 在浏览器访问：`http://8.136.38.126:8888`（或显示的端口）
2. 使用安装时显示的用户名和密码登录
3. 首次登录会提示安装 LNMP 环境

### 2.4 安装 LNMP 环境

在宝塔面板中：
1. 点击 **"软件商店"**
2. 选择 **"一键安装"** → **"LNMP"**
3. 推荐配置：
   - **Nginx**: 1.24（最新稳定版）
   - **MySQL**: 5.7 或 8.0（本项目不使用数据库，可选）
   - **PHP**: 不安装（本项目使用 Node.js）
   - **phpMyAdmin**: 不安装

---

## 第三步：安装 Node.js 环境

### 3.1 通过宝塔面板安装 Node.js

1. 打开宝塔面板
2. 点击 **"软件商店"** → **"运行环境"**
3. 找到 **"Node.js版本管理器"** 并安装
4. 安装完成后，在 **"网站"** → **"Node项目"** 中可以看到 Node.js 管理器

### 3.2 或通过命令行安装 Node.js

```bash
# SSH 连接到服务器
ssh root@8.136.38.126

# 安装 Node.js 18.x（推荐）
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 验证安装
node -v  # 应该显示 v18.x.x
npm -v   # 应该显示 9.x.x

# 安装 PM2（进程管理器）
npm install -g pm2
```

---

## 第四步：配置安全组（防火墙）

### 4.1 阿里云安全组配置

1. 登录阿里云控制台
2. 进入 **ECS** → **网络与安全** → **安全组**
3. 找到实例对应的安全组，点击 **"配置规则"**
4. 添加入站规则：

| 端口范围 | 授权对象 | 协议类型 | 描述 |
|---------|---------|---------|------|
| 22/22 | 0.0.0.0/0 | TCP | SSH |
| 80/80 | 0.0.0.0/0 | TCP | HTTP |
| 443/443 | 0.0.0.0/0 | TCP | HTTPS |
| 8888/8888 | 你的IP | TCP | 宝塔面板（建议限制IP） |
| 4000/4000 | 127.0.0.1 | TCP | 后端API（仅本地访问） |

### 4.2 宝塔面板防火墙配置

1. 打开宝塔面板
2. 点击 **"安全"** → **"防火墙"**
3. 添加端口规则：
   - 端口：`4000`，协议：`TCP`，备注：`后端API`

---

## 第五步：部署项目代码

### 5.1 创建项目目录

```bash
# SSH 连接到服务器
ssh root@8.136.38.126

# 创建项目目录
mkdir -p /www/wwwroot/piccco3
cd /www/wwwroot/piccco3
```

### 5.2 克隆代码（方法1：推荐）

```bash
# 安装 Git（如果未安装）
apt-get update
apt-get install -y git

# 克隆代码
git clone https://github.com/13371/piccco3.git .

# 或者使用 SSH（如果配置了 SSH key）
# git clone git@github.com:13371/piccco3.git .
```

### 5.3 或上传代码（方法2：使用宝塔面板）

1. 打开宝塔面板
2. 点击 **"文件"** → 进入 `/www/wwwroot/`
3. 创建文件夹 `piccco3`
4. 点击 **"上传"** → 选择项目 ZIP 文件
5. 解压文件到 `piccco3` 目录

---

## 第六步：配置后端环境

### 6.1 安装后端依赖

```bash
cd /www/wwwroot/piccco3/backend
npm install --production
```

### 6.2 配置后端环境变量

```bash
# 创建 .env 文件
cd /www/wwwroot/piccco3/backend
nano .env
```

**`.env` 文件内容**：

```env
# 服务器配置
NODE_ENV=production
PORT=4000

# 前端地址（替换为你的域名或IP）
FRONTEND_ORIGIN=http://8.136.38.126
# 如果有域名，使用：
# FRONTEND_ORIGIN=https://your-domain.com

# JWT 密钥（必须更改！）
JWT_SECRET=你的随机密钥（至少64字符）

# Session 密钥（必须更改！）
SESSION_SECRET=你的随机密钥（至少32字符）

# 管理员密码（使用哈希）
ADMIN_PASSWORD_HASH=$2a$10$9PRU/y3xaBLg1JtjERk0EObexugE07tRYPPnkOvFTKE8gmQReSBFK

# SMTP 邮件配置
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=z13371@qq.com
SMTP_PASS=你的SMTP密码

# JWT 过期时间
JWT_EXPIRES_IN=7d
```

**生成随机密钥**：

```bash
# 生成 JWT_SECRET（64字符）
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# 生成 SESSION_SECRET（32字符）
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 6.3 创建数据目录

```bash
# 确保数据目录存在
mkdir -p /www/wwwroot/piccco3/backend/data/user-data
chmod -R 755 /www/wwwroot/piccco3/backend/data
```

---

## 第七步：使用 PM2 启动后端服务

### 7.1 创建 PM2 配置文件

```bash
cd /www/wwwroot/piccco3/backend
nano ecosystem.config.js
```

**`ecosystem.config.js` 内容**：

```javascript
module.exports = {
  apps: [{
    name: 'piccco-backend',
    script: 'src/server.js',
    cwd: '/www/wwwroot/piccco3/backend',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 4000
    },
    error_file: '/www/wwwroot/piccco3/backend/logs/error.log',
    out_file: '/www/wwwroot/piccco3/backend/logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_memory_restart: '500M',
    watch: false
  }]
};
```

### 7.2 创建日志目录

```bash
mkdir -p /www/wwwroot/piccco3/backend/logs
```

### 7.3 启动后端服务

```bash
cd /www/wwwroot/piccco3/backend
pm2 start ecosystem.config.js

# 查看状态
pm2 status

# 查看日志
pm2 logs piccco-backend

# 设置开机自启
pm2 startup
pm2 save
```

### 7.4 验证后端服务

```bash
# 测试后端API
curl http://localhost:4000/api/auth/me

# 应该返回 401（未授权），说明服务正常运行
```

---

## 第八步：构建前端项目

### 8.1 安装前端依赖

```bash
cd /www/wwwroot/piccco3
npm install
```

### 8.2 创建生产环境配置文件

```bash
cd /www/wwwroot/piccco3
nano .env.production
```

**`.env.production` 内容**：

```env
# 生产环境 API 地址（使用相对路径，通过 Nginx 代理）
VITE_API_BASE_URL=/api
```

### 8.3 构建前端

```bash
cd /www/wwwroot/piccco3
npm run build

# 构建完成后，dist 目录就是前端静态文件
# 文件位置：/www/wwwroot/piccco3/dist
```

---

## 第九步：配置 Nginx

### 9.1 在宝塔面板创建网站

1. 打开宝塔面板
2. 点击 **"网站"** → **"添加站点"**
3. 配置信息：
   - **域名**: `8.136.38.126`（或你的域名）
   - **根目录**: `/www/wwwroot/piccco3/dist`
   - **PHP版本**: 纯静态（不运行PHP）
   - **FTP**: 不创建
   - **数据库**: 不创建

### 9.2 配置 Nginx 反向代理

1. 点击创建的网站 → **"设置"** → **"配置文件"**
2. 替换为以下配置：

```nginx
server {
    listen 80;
    server_name 8.136.38.126;  # 替换为你的域名
    
    # 前端静态文件
    root /www/wwwroot/piccco3/dist;
    index index.html;
    
    # 前端路由支持（SPA）
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # 后端 API 代理
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
        
        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # 禁止访问敏感文件
    location ~ /\. {
        deny all;
    }
    
    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json;
}
```

3. 点击 **"保存"**

### 9.3 重载 Nginx

```bash
# 在宝塔面板中点击 "重载配置"
# 或使用命令行
nginx -t  # 测试配置
nginx -s reload  # 重载配置
```

---

## 第十步：配置 SSL 证书（可选但推荐）

### 10.1 使用宝塔面板申请免费 SSL

1. 打开宝塔面板
2. 点击网站 → **"设置"** → **"SSL"**
3. 选择 **"Let's Encrypt"**
4. 填写域名（如果有）
5. 点击 **"申请"**
6. 申请成功后，开启 **"强制HTTPS"**

### 10.2 更新环境变量

如果启用了 HTTPS，需要更新后端 `.env`：

```env
FRONTEND_ORIGIN=https://your-domain.com
```

并更新前端 `.env.production`：

```env
VITE_API_BASE_URL=/api
```

---

## 第十一步：验证部署

### 11.1 测试前端

访问：`http://8.136.38.126`（或你的域名）

应该能看到前端页面正常加载。

### 11.2 测试后端 API

```bash
# 测试 API 是否正常
curl http://8.136.38.126/api/auth/me

# 应该返回 401（未授权），说明 API 正常
```

### 11.3 测试完整功能

1. **注册账号** - 测试邮箱验证码发送
2. **登录** - 测试 JWT 认证
3. **创建记事** - 测试数据同步
4. **管理员后台** - 访问 `/admin?password=sai13371`

---

## 第十二步：设置自动更新（可选）

### 12.1 创建更新脚本

```bash
cd /www/wwwroot/piccco3
nano update.sh
```

**`update.sh` 内容**：

```bash
#!/bin/bash
cd /www/wwwroot/piccco3

# 拉取最新代码
git pull origin main

# 更新后端依赖
cd backend
npm install --production

# 重启后端服务
pm2 restart piccco-backend

# 更新前端依赖
cd ..
npm install

# 构建前端
npm run build

echo "更新完成！"
```

### 12.2 设置执行权限

```bash
chmod +x /www/wwwroot/piccco3/update.sh
```

### 12.3 使用脚本更新

```bash
cd /www/wwwroot/piccco3
./update.sh
```

---

## 🔧 常见问题排查

### 问题1：后端服务无法启动

**检查步骤**：
```bash
# 1. 检查端口是否被占用
netstat -tlnp | grep 4000

# 2. 检查 PM2 状态
pm2 status
pm2 logs piccco-backend

# 3. 检查环境变量
cd /www/wwwroot/piccco3/backend
cat .env

# 4. 手动启动测试
node src/server.js
```

### 问题2：前端无法访问 API

**检查步骤**：
1. 检查 Nginx 配置是否正确
2. 检查后端服务是否运行：`pm2 status`
3. 检查防火墙是否开放端口
4. 查看 Nginx 错误日志：宝塔面板 → 网站 → 设置 → 日志

### 问题3：邮箱验证码无法发送

**检查步骤**：
1. 检查 SMTP 配置是否正确
2. 检查 `.env` 文件中的 SMTP 密码
3. 查看后端日志：`pm2 logs piccco-backend`

### 问题4：静态资源 404

**检查步骤**：
1. 确认前端已构建：`ls -la /www/wwwroot/piccco3/dist`
2. 检查 Nginx 根目录配置是否正确
3. 检查文件权限：`chmod -R 755 /www/wwwroot/piccco3/dist`

---

## 📊 监控和维护

### 查看后端日志

```bash
# 实时查看日志
pm2 logs piccco-backend

# 查看最近100行日志
pm2 logs piccco-backend --lines 100
```

### 重启服务

```bash
# 重启后端
pm2 restart piccco-backend

# 重启 Nginx
nginx -s reload
# 或在宝塔面板中点击 "重载配置"
```

### 查看服务器资源

```bash
# 查看 CPU 和内存使用
htop

# 查看磁盘使用
df -h

# 查看进程
ps aux | grep node
```

---

## 🎯 部署完成检查清单

- [ ] 后端服务正常运行（PM2 status 显示 online）
- [ ] 前端页面可以正常访问
- [ ] API 接口正常响应
- [ ] 用户注册功能正常（邮箱验证码）
- [ ] 用户登录功能正常
- [ ] 数据同步功能正常
- [ ] 管理员后台可以访问
- [ ] SSL 证书已配置（如果使用域名）
- [ ] 防火墙规则已配置
- [ ] 日志文件正常记录

---

## 📝 重要提示

1. **安全建议**：
   - 定期更新系统和依赖
   - 使用强密码
   - 定期备份数据
   - 限制宝塔面板访问IP

2. **性能优化**：
   - 启用 Nginx Gzip 压缩
   - 配置静态资源缓存
   - 监控服务器资源使用

3. **数据备份**：
   - 定期备份 `/www/wwwroot/piccco3/backend/data` 目录
   - 可以使用宝塔面板的定时备份功能

---

**部署完成后，你的应用应该可以通过 `http://8.136.38.126` 访问！**

如有问题，请查看日志文件或联系技术支持。

