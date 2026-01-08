# 前端部署指南 - 解决网络连接失败问题

## 问题原因
服务器上的前端代码是旧版本，仍然在请求 `http://localhost:4000/api`，导致网络连接失败。

## 解决方案

### 步骤 1: 确认本地构建已完成
✅ 已完成：`npm run build` 已成功执行，新的 `dist` 文件夹已生成。

### 步骤 2: 上传 dist 文件夹到服务器

你有两种方式上传：

#### 方式 A: 使用 FTP/SFTP 工具（推荐）
1. 使用 **FileZilla**、**WinSCP** 或其他 FTP 工具
2. 连接到服务器：`8.136.38.126`
3. 用户名：`root`
4. 密码：你的服务器密码
5. 上传位置：`/www/wwwroot/piccco3/dist`（或你的网站根目录）
6. **重要**：上传时选择"覆盖所有文件"

#### 方式 B: 使用命令行 scp（如果你有 SSH 密钥）
```bash
# 在本地 PowerShell 中执行
scp -r D:\piccco3-new\dist\* root@8.136.38.126:/www/wwwroot/piccco3/dist/
```

### 步骤 3: 验证上传结果

登录服务器后执行：
```bash
# 进入 dist 目录
cd /www/wwwroot/piccco3/dist

# 检查新文件是否存在
ls -la assets/

# 验证新构建的文件（应该看到 index-Bth9sdaR.js，而不是旧的 index-BCgbuD1H.js）
grep -r "生产环境默认地址" assets/*.js
```

### 步骤 4: 重启 Nginx（可选但推荐）
```bash
# 在服务器上执行
bt reload
# 或者
systemctl reload nginx
```

### 步骤 5: 清除浏览器缓存

1. 打开浏览器开发者工具（F12）
2. 右键点击刷新按钮
3. 选择 **"清空缓存并硬性重新加载"**（或 "Empty Cache and Hard Reload"）

### 步骤 6: 验证修复

1. 打开网站：`http://8.136.38.126`
2. 打开浏览器开发者工具（F12）→ Network 标签
3. 尝试修改用户名
4. 检查 Network 标签中的请求：
   - ✅ **正确**：请求 URL 应该是 `http://8.136.38.126/api/v1/auth/me`
   - ❌ **错误**：如果还是 `http://localhost:4000/api/v1/auth/me`，说明缓存未清除

## 预期结果

修复后，所有 API 请求应该使用：
- `http://8.136.38.126/api/...`（生产环境）
- 而不是 `http://localhost:4000/api/...`（旧版本）

## 如果问题仍然存在

1. **检查服务器上的文件时间戳**：
   ```bash
   ls -lth /www/wwwroot/piccco3/dist/assets/ | head -5
   ```
   应该看到最新的文件（刚刚上传的）

2. **强制清除浏览器缓存**：
   - Chrome: `Ctrl + Shift + Delete` → 选择"缓存的图片和文件" → 清除
   - 或者使用无痕模式测试

3. **检查 Nginx 配置**：
   确保反向代理配置正确（从你的截图看，配置是正确的）

4. **查看浏览器控制台**：
   打开 Console 标签，应该看到 `[API配置] 生产环境默认地址: http://8.136.38.126/api`


















