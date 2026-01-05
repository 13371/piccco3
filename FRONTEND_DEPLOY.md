# 前端部署指南（v1.20）

## 问题说明

如果部署后页面UI还是旧版本，说明前端代码没有重新构建。前端需要执行 `npm run build` 生成生产版本。

## 快速部署步骤

### 方法1：使用部署脚本（推荐）

```bash
# 1. 进入项目目录
cd /www/wwwroot/piccco3

# 2. 给脚本添加执行权限
chmod +x deploy-frontend.sh

# 3. 运行部署脚本
./deploy-frontend.sh
```

### 方法2：手动部署

```bash
# 1. 进入项目目录
cd /www/wwwroot/piccco3

# 2. 拉取最新代码
git pull origin main

# 3. 安装依赖
npm install

# 4. 构建前端
npm run build

# 5. 检查构建输出
ls -la dist/
```

## Nginx 配置

### 如果使用 Nginx 作为 Web 服务器

#### 方案1：将构建文件复制到网站根目录

```bash
# 假设网站根目录是 /www/wwwroot/piccco3/public
# 复制构建文件
cp -r dist/* /www/wwwroot/piccco3/public/

# 或者使用 rsync（推荐，只复制变化的文件）
rsync -av --delete dist/ /www/wwwroot/piccco3/public/
```

#### 方案2：配置 Nginx 指向 dist 目录

编辑 Nginx 配置文件（通常在 `/etc/nginx/sites-available/` 或宝塔面板中）：

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /www/wwwroot/piccco3/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 代理到后端
    location /api {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

然后重启 Nginx：

```bash
nginx -t  # 测试配置
systemctl restart nginx  # 重启 Nginx
```

## 验证部署

### 1. 检查构建文件

```bash
# 检查 dist 目录
ls -la dist/

# 应该看到：
# - index.html
# - assets/ 目录（包含 JS 和 CSS 文件）
```

### 2. 检查文件内容

```bash
# 检查 index.html 是否包含新UI的引用
grep -i "vite" dist/index.html

# 检查是否有新的 CSS 文件
ls -la dist/assets/*.css
```

### 3. 清除浏览器缓存

部署后，**必须清除浏览器缓存**才能看到新UI：

- **Chrome/Edge**: `Ctrl+Shift+Delete` 或 `Cmd+Shift+Delete`
- **Firefox**: `Ctrl+Shift+Delete` 或 `Cmd+Shift+Delete`
- 或者使用**硬刷新**: `Ctrl+F5` 或 `Cmd+Shift+R`

### 4. 检查版本

打开浏览器开发者工具（F12），在 Console 中输入：

```javascript
// 检查 UI 配置
console.log('USE_NEW_UI:', window.__USE_NEW_UI__);
```

或者查看页面源代码，搜索 `USE_NEW_UI`。

## 常见问题

### 1. 构建失败

```bash
# 检查 Node.js 版本（需要 v16+）
node -v

# 清除 node_modules 和重新安装
rm -rf node_modules package-lock.json
npm install
npm run build
```

### 2. 构建成功但页面还是旧的

- **清除浏览器缓存**（最重要！）
- 检查 Nginx 配置是否正确指向 dist 目录
- 检查文件权限：`chmod -R 755 dist/`

### 3. 样式丢失

- 检查 CSS 文件是否正确加载
- 检查 Nginx 配置中的静态文件路径
- 清除浏览器缓存

### 4. API 请求失败

- 检查 Nginx 的 `/api` 代理配置
- 检查后端服务是否运行：`pm2 status`
- 检查后端端口：`netstat -tlnp | grep 4000`

## 自动化部署脚本（完整版）

创建 `deploy-all.sh` 同时部署前后端：

```bash
#!/bin/bash
set -e

PROJECT_DIR="/www/wwwroot/piccco3"

echo "=========================================="
echo "piccco 完整部署脚本 v1.20"
echo "=========================================="

# 1. 部署后端
echo "1. 部署后端..."
cd "$PROJECT_DIR/backend"
./deploy.sh

# 2. 部署前端
echo ""
echo "2. 部署前端..."
cd "$PROJECT_DIR"
./deploy-frontend.sh

# 3. 重启 Nginx（如果需要）
echo ""
echo "3. 重启 Nginx..."
systemctl restart nginx

echo ""
echo "=========================================="
echo "部署完成！"
echo "=========================================="
echo "请清除浏览器缓存后访问网站"
echo "=========================================="
```

## 宝塔面板部署

如果使用宝塔面板：

1. **文件管理** → 进入 `/www/wwwroot/piccco3`
2. **终端** → 执行：
   ```bash
   git pull origin main
   npm install
   npm run build
   ```
3. **网站** → 选择网站 → **设置** → **网站目录** → 指向 `/www/wwwroot/piccco3/dist`
4. **保存** 并 **重启 Nginx**

## 注意事项

1. **必须清除浏览器缓存**才能看到新UI
2. 构建后的文件在 `dist/` 目录
3. 确保 Nginx 配置正确指向 `dist/` 目录
4. API 请求需要代理到后端 `http://localhost:4000`

