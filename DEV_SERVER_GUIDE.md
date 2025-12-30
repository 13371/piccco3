# 本地开发服务器启动指南

## 快速启动

### Windows 系统
双击运行 `start_dev.bat`，或在命令行执行：
```bash
start_dev.bat
```

### Linux/Mac 系统
```bash
chmod +x start_dev.sh
./start_dev.sh
```

## 手动启动

### 1. 启动后端服务

打开第一个终端窗口：

```bash
cd backend

# 检查是否有 .env 文件
if [ ! -f ".env" ]; then
    echo "创建 .env 文件..."
    cp .evn .env 2>/dev/null || echo "请手动创建 .env 文件"
fi

# 安装依赖（如果需要）
npm install

# 启动后端
npm start
# 或使用开发模式（自动重启）
npm run dev
```

后端服务将在 `http://localhost:4000` 启动

### 2. 启动前端开发服务器

打开第二个终端窗口：

```bash
# 在项目根目录
cd /path/to/piccco3

# 安装依赖（如果需要）
npm install

# 启动开发服务器
npm run dev
```

前端开发服务器将在 `http://localhost:5173` 启动

## 访问应用

启动成功后，在浏览器中访问：
- **前端**: http://localhost:5173
- **后端 API**: http://localhost:4000/api

## 检查服务状态

### 检查后端
```bash
# 测试后端 API
curl http://localhost:4000/api/health

# 或查看后端日志
# 在运行 npm start 的终端中查看
```

### 检查前端
- 打开浏览器访问 http://localhost:5173
- 打开浏览器开发者工具（F12）查看控制台

## 常见问题

### 1. 端口被占用

**错误**: `Port 4000 is already in use` 或 `Port 5173 is already in use`

**解决方法**:
```bash
# Windows
netstat -ano | findstr :4000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:4000 | xargs kill -9
lsof -ti:5173 | xargs kill -9
```

### 2. 后端服务无法启动

**检查**:
1. 是否有 `backend/.env` 文件
2. 后端依赖是否安装：`cd backend && npm install`
3. 查看错误信息

### 3. 前端无法连接后端

**检查**:
1. 后端服务是否正在运行
2. `src/config/api.ts` 中的 API 地址是否正确
3. 浏览器控制台是否有 CORS 错误

### 4. 依赖安装失败

**解决方法**:
```bash
# 清除缓存
npm cache clean --force

# 删除 node_modules 重新安装
rm -rf node_modules package-lock.json
npm install
```

## 开发模式特性

- **热重载**: 修改代码后自动刷新
- **错误提示**: 在浏览器和控制台显示详细错误
- **快速调试**: 支持 React DevTools 和浏览器调试工具

## 停止服务

- **Windows**: 在运行服务的命令行窗口按 `Ctrl+C`
- **Linux/Mac**: 在运行服务的终端按 `Ctrl+C`

或使用脚本启动的，关闭对应的命令行窗口即可。












