# Nginx 配置指南

## 快速配置步骤

### 1. 查找现有配置文件

```bash
# 查看现有站点配置
ls -la /etc/nginx/sites-available/
ls -la /etc/nginx/sites-enabled/

# 或者查看宝塔面板的配置
ls -la /www/server/panel/vhost/nginx/
```

### 2. 创建或编辑配置文件

#### 如果使用宝塔面板：

1. 进入 **网站** → 选择你的网站 → **设置**
2. 点击 **配置文件** 标签
3. 修改配置（参考下面的配置内容）

#### 如果手动配置：

```bash
# 编辑配置文件（替换 your-site 为你的网站名称）
nano /etc/nginx/sites-available/piccco.conf
```

### 3. 配置内容

将以下配置复制到文件中（在 nano 中按 `Ctrl+O` 保存，`Ctrl+X` 退出）：

```nginx
server {
    listen 80;
    server_name 8.136.38.126;  # 替换为你的域名或IP
    
    # 网站根目录指向前端构建的 dist 目录
    root /www/wwwroot/piccco3/dist;
    index index.html;

    # 日志文件
    access_log /www/wwwlogs/piccco_access.log;
    error_log /www/wwwlogs/piccco_error.log;

    # 前端静态文件
    location / {
        try_files $uri $uri/ /index.html;
        
        # 缓存静态资源
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # API 代理到后端服务
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

    # 健康检查接口
    location /health {
        proxy_pass http://localhost:4000/api/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    # 禁止访问隐藏文件
    location ~ /\. {
        deny all;
    }
}
```

### 4. 启用配置（如果手动配置）

```bash
# 创建符号链接（如果不存在）
ln -s /etc/nginx/sites-available/piccco.conf /etc/nginx/sites-enabled/piccco.conf

# 测试配置
nginx -t

# 如果测试通过，重启 Nginx
systemctl restart nginx
```

### 5. 验证配置

```bash
# 检查 Nginx 状态
systemctl status nginx

# 检查端口监听
netstat -tlnp | grep :80

# 测试访问
curl http://localhost
```

## 宝塔面板配置步骤

1. **网站** → 选择网站 → **设置**
2. **网站目录** → 设置为：`/www/wwwroot/piccco3/dist`
3. **配置文件** → 添加以下内容到 `location /api` 块：

```nginx
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
```

4. **保存** 并 **重启 Nginx**

## 常见问题

### 1. 403 Forbidden 错误

```bash
# 检查文件权限
chmod -R 755 /www/wwwroot/piccco3/dist
chown -R www:www /www/wwwroot/piccco3/dist
```

### 2. 404 Not Found 错误

- 确认 `root` 路径正确指向 `dist` 目录
- 确认已执行 `npm run build`
- 检查 `dist/index.html` 是否存在

### 3. API 请求失败

- 检查后端服务是否运行：`pm2 status`
- 检查后端端口：`netstat -tlnp | grep 4000`
- 检查 Nginx 错误日志：`tail -f /www/wwwlogs/piccco_error.log`

### 4. 静态资源加载失败

- 检查文件路径是否正确
- 检查文件权限
- 清除浏览器缓存

## 完整部署检查清单

- [ ] 前端已构建：`npm run build`
- [ ] `dist/` 目录存在且有内容
- [ ] Nginx 配置已更新
- [ ] `root` 指向 `/www/wwwroot/piccco3/dist`
- [ ] `/api` 代理配置已添加
- [ ] Nginx 配置测试通过：`nginx -t`
- [ ] Nginx 已重启：`systemctl restart nginx`
- [ ] 浏览器缓存已清除



















