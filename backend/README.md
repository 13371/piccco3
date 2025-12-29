# piccco 后端服务

## 环境配置

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 文件为 `.env`，并填写相应的配置：

```bash
cp .env.example .env
```

### 3. 管理员密码配置

#### 方式一：使用密码哈希（推荐，更安全）

1. 生成密码哈希：
```bash
cd backend
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('your-password', 10).then(hash => console.log('ADMIN_PASSWORD_HASH=' + hash));"
```

2. 在 `.env` 文件中设置：
```env
ADMIN_PASSWORD_HASH=$2a$10$生成的哈希值
```

#### 方式二：使用明文密码（仅开发环境）

在 `.env` 文件中设置：
```env
ADMIN_PASSWORD=your-admin-password-here
```

**重要提示**：
- 默认密码为 `admin123`（仅用于开发环境）
- **生产环境必须使用密码哈希**（方式一）
- 管理员密码用于访问后台管理界面（`/admin`）
- 如果同时设置了 `ADMIN_PASSWORD_HASH` 和 `ADMIN_PASSWORD`，优先使用哈希值

### 4. Session Secret 配置

**生产环境必须设置**，在 `.env` 文件中添加：

```env
SESSION_SECRET=your-random-secret-string-at-least-32-characters
```

**生成随机字符串的方法**：
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**重要提示**：
- 开发环境未设置时会使用默认值（不安全）
- 生产环境未设置会导致服务器无法启动
- Session Secret 用于加密管理员登录会话

### 5. 邮件服务配置

#### QQ 邮箱配置示例

1. 登录 QQ 邮箱
2. 进入"设置" -> "账户"
3. 开启"POP3/SMTP服务"或"IMAP/SMTP服务"
4. 生成授权码（16位字符）
5. 在 `.env` 文件中配置：

```env
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-email@qq.com
SMTP_PASS=your-authorization-code
```

#### Gmail 配置示例

1. 登录 Google 账户
2. 开启两步验证
3. 生成应用专用密码
4. 在 `.env` 文件中配置：

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

#### 163 邮箱配置示例

1. 登录 163 邮箱
2. 进入"设置" -> "POP3/SMTP/IMAP"
3. 开启 SMTP 服务
4. 设置客户端授权密码
5. 在 `.env` 文件中配置：

```env
SMTP_HOST=smtp.163.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-email@163.com
SMTP_PASS=your-authorization-password
```

### 5. 启动服务

```bash
npm start
```

服务将在 `http://localhost:4000` 启动。

## API 端点

### 认证相关

- `POST /api/auth/send-code` - 发送邮箱验证码
- `POST /api/auth/register` - 用户注册（需要验证码）
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/change-password` - 修改密码（需要验证码）

### 管理相关（需要管理员认证）

- `POST /api/admin/login` - 管理员登录
- `POST /api/admin/logout` - 管理员登出
- `GET /api/admin/check-auth` - 检查登录状态
- `GET /api/admin/users` - 获取用户列表（需要认证）
- `POST /api/admin/users/:userId/ban` - 封禁用户（需要认证）
- `POST /api/admin/users/:userId/unban` - 解封用户（需要认证）
- `POST /api/admin/users/:userId/message` - 发送消息给用户（需要认证）
- `POST /api/admin/users/message/all` - 群发消息给所有用户（需要认证）
- `GET /api/admin/message-history` - 获取发送消息历史（需要认证）
- `DELETE /api/admin/message-history/:historyId` - 删除发送历史记录（需要认证）

### 管理界面

- `GET /admin` - 后台管理界面（需要管理员密码登录）

## 注意事项

1. **管理员密码**：
   - 默认密码为 `admin123`（仅开发环境）
   - 生产环境**必须**使用 `ADMIN_PASSWORD_HASH` 设置密码哈希
   - 登录有速率限制：5分钟内最多5次尝试

2. **Session 安全**：
   - 管理员登录使用 session 管理，session 有效期为 24 小时
   - **生产环境必须设置** `SESSION_SECRET` 环境变量
   - Session 使用 `httpOnly` 和 `sameSite: lax` 保护

3. **安全特性**：
   - 已实现密码哈希加密（bcrypt）
   - 已添加登录速率限制
   - 已添加输入验证和长度限制
   - 已添加请求体大小限制（10MB）

4. **邮件服务配置**：必须正确配置 SMTP 服务才能发送验证码邮件

5. **验证码有效期**：验证码有效期为 10 分钟

6. **数据存储**：用户数据和消息数据存储在 `backend/data/` 目录下

7. **生产环境建议**：
   - 使用 Redis 等独立存储来管理验证码，而不是内存存储
   - 使用 Redis 或数据库来管理 session，而不是内存 session
   - 使用 HTTPS 并设置 `secure: true` 的 session cookie
   - 添加 CSRF 保护
   - 使用 Helmet.js 添加安全头





