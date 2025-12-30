# 启动前后端服务指南

## 前置检查

### 1. 检查前端构建
```bash
cd /www/wwwroot/piccco3
ls -la dist/
```
如果 `dist` 目录不存在或为空，需要先构建：
```bash
npm run build
```

### 2. 检查后端文件
```bash
ls -la backend/src/server.js
```
如果文件不存在，需要检查后端代码是否完整。

### 3. 检查后端环境配置
```bash
ls -la backend/.env
```
如果不存在，需要创建 `.env` 文件（参考 `backend/.evn` 或之前的配置信息）。

## 启动步骤

### 方法一：使用启动脚本（推荐）

```bash
cd /www/wwwroot/piccco3
chmod +x start_services.sh
./start_services.sh
```

### 方法二：手动启动

#### 1. 安装 PM2（如果未安装）
```bash
npm install -g pm2
```

#### 2. 安装后端依赖
```bash
cd /www/wwwroot/piccco3/backend
npm install
```

#### 3. 启动后端服务
```bash
cd /www/wwwroot/piccco3/backend
pm2 start src/server.js --name piccco-backend
pm2 save
```

#### 4. 查看服务状态
```bash
pm2 list
pm2 logs piccco-backend
```

## 配置 Nginx

### 在宝塔面板中配置

1. 登录宝塔面板
2. 进入 **网站** → 选择你的网站（或创建新网站）
3. 点击 **设置** → **配置文件**
4. 将 `nginx_config.conf` 中的配置添加到配置文件中
5. 修改 `server_name` 为你的域名或IP
6. 保存并重启 Nginx

### 或者使用命令行

```bash
# 备份原配置
cp /www/server/panel/vhost/nginx/your-site.conf /www/server/panel/vhost/nginx/your-site.conf.bak

# 编辑配置文件（替换 your-site 为你的网站名）
nano /www/server/panel/vhost/nginx/your-site.conf

# 重启 Nginx
/etc/init.d/nginx restart
```

## 验证服务

### 1. 检查后端服务
```bash
# 查看 PM2 状态
pm2 status

# 查看后端日志
pm2 logs piccco-backend

# 测试后端 API
curl http://localhost:4000/api/health
```

### 2. 检查前端文件
```bash
# 检查 dist 目录
ls -la /www/wwwroot/piccco3/dist/

# 应该看到 index.html 和 assets 目录
```

### 3. 访问应用
在浏览器中访问：
- 如果配置了域名：`http://your-domain.com`
- 如果使用IP：`http://your-server-ip`

## 常用 PM2 命令

```bash
# 查看所有服务
pm2 list

# 查看日志
pm2 logs piccco-backend

# 重启服务
pm2 restart piccco-backend

# 停止服务
pm2 stop piccco-backend

# 删除服务
pm2 delete piccco-backend

# 查看服务详情
pm2 show piccco-backend

# 监控服务
pm2 monit
```

## 故障排查

### 后端服务无法启动

1. **检查端口是否被占用**
   ```bash
   netstat -tulpn | grep 4000
   ```

2. **查看详细错误日志**
   ```bash
   pm2 logs piccco-backend --lines 50
   ```

3. **检查环境变量**
   ```bash
   cd /www/wwwroot/piccco3/backend
   cat .env
   ```

4. **手动测试启动**
   ```bash
   cd /www/wwwroot/piccco3/backend
   node src/server.js
   ```

### 前端无法访问

1. **检查 Nginx 配置**
   ```bash
   nginx -t
   ```

2. **检查文件权限**
   ```bash
   chown -R www:www /www/wwwroot/piccco3/dist
   ```

3. **查看 Nginx 错误日志**
   ```bash
   tail -f /www/wwwlogs/error.log
   ```

### API 请求失败

1. **检查后端服务是否运行**
   ```bash
   pm2 status
   ```

2. **检查 CORS 配置**
   确保后端 `.env` 中的 `FRONTEND_ORIGIN` 配置正确

3. **测试 API 连接**
   ```bash
   curl -X GET http://localhost:4000/api/health
   ```

## 生产环境建议

1. **使用 HTTPS**
   - 在宝塔面板中申请 SSL 证书
   - 配置 HTTPS 重定向

2. **配置防火墙**
   - 只开放必要端口（80, 443）
   - 后端端口（4000）只允许本地访问

3. **设置 PM2 开机自启**
   ```bash
   pm2 startup
   pm2 save
   ```

4. **配置日志轮转**
   ```bash
   pm2 install pm2-logrotate
   ```

5. **监控服务**
   - 使用宝塔面板的监控功能
   - 或配置 PM2 监控







