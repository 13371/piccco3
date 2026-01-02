# 本地移动端测试指南

## 📱 准备工作

### 1. 获取本地IP地址

**Windows:**
```powershell
ipconfig
# 查找 "IPv4 地址"，通常是 192.168.x.x 或 10.x.x.x
```

**Mac/Linux:**
```bash
# Mac
ipconfig getifaddr en0

# Linux
hostname -I | awk '{print $1}'

# 或使用
ifconfig | grep "inet " | grep -v 127.0.0.1
```

**快速获取（跨平台脚本）：**
```bash
# Windows PowerShell
(Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.InterfaceAlias -notlike "*Loopback*"}).IPAddress

# Mac/Linux
ip route get 1.1.1.1 | awk '{print $7}' | head -1
```

### 2. 确保移动设备和电脑在同一网络

- ✅ 手机和电脑连接到同一个WiFi
- ✅ 确保防火墙允许端口 5173 和 4000 的访问

---

## 🚀 启动本地开发服务器

### 方法一：使用启动脚本（推荐）

**Windows:**
```bash
start_dev.bat
```

**Mac/Linux:**
```bash
chmod +x start_dev.sh
./start_dev.sh
```

### 方法二：手动启动

**1. 启动后端服务（终端1）：**
```bash
cd backend
npm start
```

后端将在 `http://localhost:4000` 启动

**2. 启动前端开发服务器（终端2）：**
```bash
npm run dev
```

前端将在 `http://localhost:5173` 启动（现在也支持外部访问）

---

## 📱 在移动设备上访问

### 1. 获取本地IP地址

假设你的本地IP是 `192.168.1.100`（请替换为你的实际IP）

### 2. 在移动设备浏览器中访问

**前端地址：**
```
http://192.168.1.100:5173
```

**后端API地址：**
```
http://192.168.1.100:4000
```

### 3. 配置后端允许移动设备访问

需要修改 `backend/.env` 文件，添加移动设备的访问地址：

```env
# 开发环境：允许本地和移动设备访问
FRONTEND_ORIGIN=http://localhost:5173,http://192.168.1.100:5173
```

**或者**，修改后端代码以支持多个来源（见下方说明）

---

## 🔧 配置后端CORS（支持移动设备）

### 方法一：修改 .env 文件（简单）

在 `backend/.env` 中添加：
```env
FRONTEND_ORIGIN=http://localhost:5173,http://192.168.1.100:5173
```

然后修改 `backend/src/server.js` 中的CORS配置（见下方）

### 方法二：修改后端代码（推荐）

修改 `backend/src/server.js` 中的CORS配置：

```javascript
// 开发环境：允许多个来源
const allowedOrigins = process.env.NODE_ENV === 'development'
  ? (process.env.FRONTEND_ORIGIN || 'http://localhost:5173').split(',')
  : [FRONTEND_ORIGIN];

app.use(
  cors({
    origin: (origin, callback) => {
      // 允许没有origin的请求（如移动应用、Postman等）
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);
```

---

## ✅ 移动端测试检查清单

### 基础功能测试

- [ ] **页面加载**
  - [ ] 页面能正常打开
  - [ ] 样式显示正常
  - [ ] 没有控制台错误

- [ ] **登录/注册**
  - [ ] 输入框可以正常输入
  - [ ] 按钮可以正常点击
  - [ ] 验证码发送功能正常
  - [ ] 登录/注册流程完整

- [ ] **导航**
  - [ ] 底部导航栏可以正常点击
  - [ ] 页面切换流畅
  - [ ] 返回按钮正常工作

- [ ] **内容操作**
  - [ ] 创建记事功能正常
  - [ ] 编辑记事功能正常
  - [ ] 删除功能正常
  - [ ] 搜索功能正常

- [ ] **移动端特定测试**
  - [ ] 触摸反馈正常（按钮点击有反馈）
  - [ ] 输入框不会自动缩放（iOS）
  - [ ] 底部导航栏不会被安全区域遮挡（iOS）
  - [ ] 模态框显示正常
  - [ ] 滚动流畅
  - [ ] 横屏/竖屏切换正常

### 样式测试

- [ ] **响应式布局**
  - [ ] 小屏幕（< 480px）显示正常
  - [ ] 中等屏幕（480px - 768px）显示正常
  - [ ] 文字大小合适，易于阅读
  - [ ] 按钮大小合适，易于点击（至少44x44px）

- [ ] **深色模式**
  - [ ] 深色模式切换正常
  - [ ] 深色模式下文字清晰可读
  - [ ] 深色模式下对比度合适

### 性能测试

- [ ] **加载速度**
  - [ ] 首次加载时间合理（< 3秒）
  - [ ] 页面切换流畅
  - [ ] 图片加载正常

- [ ] **网络请求**
  - [ ] API请求正常
  - [ ] 数据同步正常
  - [ ] 错误处理正常（网络断开时）

---

## 🐛 常见问题排查

### 1. 移动设备无法访问

**问题：** 手机浏览器显示"无法连接"或"连接超时"

**解决方法：**
1. ✅ 检查手机和电脑是否在同一WiFi
2. ✅ 检查防火墙是否允许端口 5173 和 4000
3. ✅ 确认使用正确的IP地址（不是localhost）
4. ✅ 检查后端服务是否正在运行

**Windows防火墙设置：**
```powershell
# 允许端口 5173（前端）
New-NetFirewallRule -DisplayName "Vite Dev Server" -Direction Inbound -LocalPort 5173 -Protocol TCP -Action Allow

# 允许端口 4000（后端）
New-NetFirewallRule -DisplayName "Piccco Backend" -Direction Inbound -LocalPort 4000 -Protocol TCP -Action Allow
```

### 2. CORS错误

**问题：** 浏览器控制台显示CORS错误

**解决方法：**
1. ✅ 检查 `backend/.env` 中的 `FRONTEND_ORIGIN` 配置
2. ✅ 确保包含移动设备的IP地址
3. ✅ 重启后端服务

### 3. 样式显示异常

**问题：** 移动端样式显示不正确

**解决方法：**
1. ✅ 清除浏览器缓存
2. ✅ 检查是否使用了移动端媒体查询
3. ✅ 使用浏览器开发者工具检查样式

### 4. 输入框自动缩放（iOS）

**问题：** iOS Safari在聚焦输入框时自动缩放

**解决方法：**
- ✅ 已修复：所有输入框字体大小至少16px
- ✅ 如果仍有问题，检查 `index.html` 中的viewport配置

---

## 📝 测试完成后部署

### 1. 确认所有测试通过

- ✅ 完成移动端测试检查清单
- ✅ 记录发现的问题并修复
- ✅ 再次测试确认修复

### 2. 提交代码到Git

```bash
git add .
git commit -m "修复移动端样式和功能"
git push origin main
```

### 3. 部署到服务器

**使用快速部署脚本：**
```bash
# 在服务器上
cd /www/wwwroot/piccco3
./quick_deploy.sh
```

**或手动部署：**
```bash
# 前端
npm run build
chmod -R 755 dist && chown -R www:www dist
nginx -s reload

# 后端
cd backend
pm2 restart piccco-backend
```

### 4. 在服务器上再次测试

- ✅ 使用移动设备访问生产服务器
- ✅ 确认所有功能正常
- ✅ 检查性能是否正常

---

## 🔍 调试技巧

### 1. 使用Chrome远程调试（Android）

1. 在手机上启用"USB调试"
2. 连接手机到电脑
3. 在Chrome中访问 `chrome://inspect`
4. 选择你的设备进行调试

### 2. 使用Safari远程调试（iOS）

1. 在iPhone上启用"Web检查器"（设置 > Safari > 高级）
2. 连接iPhone到Mac
3. 在Safari中：开发 > [你的iPhone] > [网页]

### 3. 使用响应式设计模式

在桌面浏览器中：
- Chrome: F12 > 设备工具栏图标
- Firefox: F12 > 响应式设计模式
- Safari: 开发 > 进入响应式设计模式

---

## 📚 相关文档

- `DEPLOYMENT_WORKFLOW.md` - 部署工作流程
- `quick_deploy.sh` - 快速部署脚本
- `start_dev.sh` / `start_dev.bat` - 开发服务器启动脚本

---

**最后更新**: 2025-12-30

















