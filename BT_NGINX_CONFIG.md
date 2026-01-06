# 宝塔面板 Nginx 配置指南

## 问题说明

在宝塔面板中，Nginx 配置文件不在 `/etc/nginx/sites-available/`，而是在宝塔面板的配置目录中。

## 方法1：使用宝塔面板界面配置（推荐）

### 步骤：

1. **退出 nano 编辑器**
   - 按 `Ctrl+X` 退出（不保存）

2. **打开宝塔面板**
   - 访问：`https://8.136.38.126:37040`
   - 登录宝塔面板

3. **进入网站设置**
   - 点击左侧菜单 **"网站"**
   - 找到你的网站（或创建新网站）
   - 点击网站名称或 **"设置"** 按钮

4. **配置网站目录**
   - 点击 **"网站目录"** 标签
   - 将 **"运行目录"** 设置为：`/www/wwwroot/piccco3/dist`
   - 点击 **"保存"**

5. **配置反向代理**
   - 点击 **"反向代理"** 标签
   - 点击 **"添加反向代理"**
   - 配置如下：
     - **代理名称**：`api`
     - **目标URL**：`http://localhost:4000`
     - **发送域名**：`$host`
     - **缓存**：关闭
   - 点击 **"提交"**

6. **或者手动编辑配置文件**
   - 点击 **"配置文件"** 标签
   - 在 `location /` 块后添加以下内容：

```nginx
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
        
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
```

7. **保存并重启 Nginx**
   - 点击 **"保存"**
   - 点击 **"重载配置"** 或重启 Nginx

## 方法2：直接编辑宝塔面板的配置文件

### 找到正确的配置文件路径：

```bash
# 查找宝塔面板的 Nginx 配置文件
ls -la /www/server/panel/vhost/nginx/

# 或者查找所有网站配置
find /www/server/panel -name "*.conf" | grep nginx
```

### 编辑配置文件：

```bash
# 假设配置文件是 piccco.conf
nano /www/server/panel/vhost/nginx/piccco.conf
```

## 方法3：创建标准 Nginx 配置目录（如果需要）

如果确实需要使用 `/etc/nginx/sites-available/`：

```bash
# 创建目录
mkdir -p /etc/nginx/sites-available
mkdir -p /etc/nginx/sites-enabled

# 创建配置文件
nano /etc/nginx/sites-available/piccco.conf

# 创建符号链接
ln -s /etc/nginx/sites-available/piccco.conf /etc/nginx/sites-enabled/piccco.conf

# 在 nginx.conf 中引入（如果需要）
# 编辑 /etc/nginx/nginx.conf，添加：
# include /etc/nginx/sites-enabled/*;
```

## 快速配置命令（在终端执行）

如果使用宝塔面板，最简单的方法是：

```bash
# 1. 退出 nano（按 Ctrl+X，选择不保存）

# 2. 查找宝塔面板的配置文件
ls -la /www/server/panel/vhost/nginx/

# 3. 编辑正确的配置文件（替换为实际文件名）
nano /www/server/panel/vhost/nginx/你的网站名.conf
```

## 推荐操作流程

1. **退出当前 nano 编辑器**（`Ctrl+X`，选择 `N` 不保存）

2. **在宝塔面板中配置**（最简单）：
   - 网站 → 设置 → 网站目录 → 设置为 `/www/wwwroot/piccco3/dist`
   - 网站 → 设置 → 反向代理 → 添加 `/api` 代理到 `http://localhost:4000`

3. **或者使用命令行查找正确路径**：
   ```bash
   # 查找配置文件
   find /www/server/panel -name "*.conf" -path "*/nginx/*"
   ```

## 验证配置

配置完成后：

```bash
# 测试 Nginx 配置
nginx -t

# 如果使用宝塔面板，在面板中点击"重载配置"
# 或者重启 Nginx
systemctl restart nginx
```



















