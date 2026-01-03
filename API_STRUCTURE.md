# API 接口目录结构

## 📋 概述

后端使用 **Express.js** 框架，采用 RESTful API 设计，支持版本化路由。

**基础路径**：
- 推荐使用：`/api/v1/*`（版本化API）
- 向后兼容：`/api/*`（旧版本，已弃用）

**认证方式**：
- JWT Token（Bearer Token）
- 格式：`Authorization: Bearer <token>`

---

## 🗂️ 接口分类

### 1. 认证相关 (`/api/v1/auth`)

**文件**：`backend/src/routes/auth.js`

| 方法 | 路径 | 说明 | 认证 | 限流 |
|------|------|------|------|------|
| POST | `/api/v1/auth/send-code` | 发送邮箱验证码 | ❌ | ✅ 15分钟5次 |
| POST | `/api/v1/auth/register` | 用户注册 | ❌ | ✅ 1小时10次 |
| POST | `/api/v1/auth/login` | 用户登录 | ❌ | ✅ 15分钟10次 |
| POST | `/api/v1/auth/verify-code` | 验证邮箱验证码 | ❌ | ✅ 15分钟5次 |
| POST | `/api/v1/auth/change-password` | 修改密码 | ❌ | ✅ 15分钟5次 |
| POST | `/api/v1/auth/refresh-token` | 刷新Token | ❌ | ❌ |
| GET | `/api/v1/auth/me` | 获取当前用户信息 | ✅ | ❌ |
| PATCH | `/api/v1/auth/me` | 更新用户信息 | ✅ | ❌ |
| DELETE | `/api/v1/auth/account` | 注销账户 | ✅ | ❌ |

**详细说明**：
- `send-code`: 发送6位数字验证码到邮箱
- `register`: 需要邮箱、用户名、密码、验证码
- `login`: 返回JWT token和用户信息
- `verify-code`: 仅验证验证码，不修改密码
- `change-password`: 需要邮箱、新密码、验证码
- `refresh-token`: 使用refreshToken刷新accessToken
- `me`: 获取/更新当前登录用户信息
- `account`: 永久删除用户账户及所有数据

---

### 2. 数据同步 (`/api/v1/data`)

**文件**：`backend/src/routes/data.js`

| 方法 | 路径 | 说明 | 认证 | 限流 |
|------|------|------|------|------|
| GET | `/api/v1/data/sync` | 获取用户数据（完整同步） | ✅ | ❌ |
| POST | `/api/v1/data/sync` | 同步用户数据到服务器 | ✅ | ❌ |
| GET | `/api/v1/data/sync/last` | 获取最后同步时间 | ✅ | ❌ |
| GET | `/api/v1/data/settings` | 获取用户设置 | ✅ | ❌ |
| PATCH | `/api/v1/data/settings` | 更新用户设置 | ✅ | ❌ |
| POST | `/api/v1/data/folder/delete` | 删除文件夹（软删除） | ✅ | ❌ |
| DELETE | `/api/v1/data/folders/:folderId` | 删除文件夹（兼容旧版） | ✅ | ❌ |
| POST | `/api/v1/data/cleanup-duplicates` | 清理重复记录 | ✅ | ❌ |
| GET | `/api/v1/data/folders` | 获取所有未删除的文件夹 | ✅ | ❌ |
| GET | `/api/v1/data/trash/folders` | 获取回收站文件夹 | ✅ | ❌ |
| GET | `/api/v1/data/folders/query` | 查询文件夹（调试用） | ✅ | ❌ |
| GET | `/api/v1/data/logs` | 获取日志列表 | ✅ | ❌ |
| POST | `/api/v1/data/logs` | 添加日志 | ✅ | ❌ |
| DELETE | `/api/v1/data/logs` | 清空日志 | ✅ | ❌ |

**详细说明**：
- `sync` (GET): 返回用户的所有数据（文件夹、笔记、URL、设置等）
- `sync` (POST): 上传用户数据到服务器，支持冲突解决（基于updatedAt）
- `sync/last`: 获取最后同步时间戳
- `settings`: 获取/更新用户设置（排序模式、字体大小、语言、夜间模式）
- `folder/delete`: 软删除文件夹，同时删除文件夹内的笔记和URL
- `cleanup-duplicates`: 清理重复记录，只保留updatedAt最大的一条
- `folders`: 获取所有未删除的文件夹列表
- `trash/folders`: 获取回收站中的文件夹
- `folders/query`: 查询指定名称的文件夹（调试用）
- `logs`: 普通用户可访问的日志接口

**数据同步策略**：
- 基于 `updatedAt` 时间戳判断数据新旧
- 删除操作（`isDeleted = true`）优先接受
- 自动去重，确保ID唯一性
- 支持永久删除文件夹（`permanentlyDeletedFolderIds`）

---

### 3. 消息管理 (`/api/v1/message`)

**文件**：`backend/src/routes/message.js`

| 方法 | 路径 | 说明 | 认证 | 限流 |
|------|------|------|------|------|
| GET | `/api/v1/message/messages` | 获取用户消息列表 | ✅ | ❌ |
| POST | `/api/v1/message/messages/:messageId/read` | 标记消息为已读 | ✅ | ❌ |

**详细说明**：
- `messages`: 获取当前用户的所有消息，按创建时间倒序
- `messages/:messageId/read`: 标记指定消息为已读

---

### 4. 管理后台 (`/api/v1/admin`)

**文件**：`backend/src/routes/admin.js`

| 方法 | 路径 | 说明 | 认证 | 限流 |
|------|------|------|------|------|
| POST | `/api/v1/admin/login` | 管理员登录 | ❌ | ✅ 5分钟5次 |
| POST | `/api/v1/admin/logout` | 管理员登出 | ❌ | ❌ |
| GET | `/api/v1/admin/check-auth` | 检查登录状态 | ❌ | ❌ |
| GET | `/api/v1/admin/users` | 获取用户列表（分页） | ✅ Admin | ❌ |
| GET | `/api/v1/admin/users/:userId` | 获取用户详情 | ✅ Admin | ❌ |
| POST | `/api/v1/admin/users/:userId/ban` | 封禁用户 | ✅ Admin | ❌ |
| POST | `/api/v1/admin/users/:userId/unban` | 解封用户 | ✅ Admin | ❌ |
| DELETE | `/api/v1/admin/users/:userId` | 删除用户 | ✅ Admin | ❌ |
| POST | `/api/v1/admin/users/:userId/message` | 发送消息给用户 | ✅ Admin | ❌ |
| POST | `/api/v1/admin/users/message/all` | 群发消息给所有用户 | ✅ Admin | ❌ |
| GET | `/api/v1/admin/message-history` | 获取消息发送历史 | ✅ Admin | ❌ |
| DELETE | `/api/v1/admin/message-history/:historyId` | 删除历史记录 | ✅ Admin | ❌ |
| GET | `/api/v1/admin/logs` | 获取日志列表 | ✅ Admin | ❌ |
| DELETE | `/api/v1/admin/logs` | 清空日志 | ✅ Admin | ❌ |

**详细说明**：
- `login`: 使用管理员密码登录，设置session
- `logout`: 清除session
- `check-auth`: 检查管理员是否已登录
- `users`: 支持分页、搜索、过滤、排序
- `users/:userId/ban`: 封禁用户，可设置封禁原因
- `users/:userId/unban`: 解封用户
- `users/:userId`: 删除用户及所有相关数据
- `users/:userId/message`: 向指定用户发送消息
- `users/message/all`: 群发消息，支持只发送给活跃用户
- `message-history`: 查看消息发送历史记录
- `logs`: 管理员可访问的日志接口

**认证方式**：
- 使用Session认证（`express-session`）
- 需要先调用 `/login` 设置session
- 其他接口需要 `requireAdminAuth` 中间件验证

---

### 5. 管理后台UI (`/admin`)

**文件**：`backend/src/routes/admin-ui.js`

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/admin` | 管理后台页面 | ✅ Admin |

**详细说明**：
- 提供完整的管理后台HTML界面
- 包含用户管理、消息发送、日志查看等功能

---

## 🔧 系统接口

### 健康检查

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | API信息 |
| GET | `/api/health` | 健康检查 |

### API文档

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api-docs` | Swagger API文档 |

---

## 📊 数据格式

### 用户数据同步格式

```json
{
  "folders": [
    {
      "id": "folder_123",
      "name": "文件夹名",
      "type": "normal",
      "color": "blue",
      "isStarred": false,
      "isDeleted": false,
      "createdAt": 1234567890,
      "updatedAt": 1234567890
    }
  ],
  "notes": [
    {
      "id": "note_123",
      "folderId": "folder_123",
      "title": "笔记标题",
      "content": "笔记内容",
      "isStarred": false,
      "isDeleted": false,
      "createdAt": 1234567890,
      "updatedAt": 1234567890
    }
  ],
  "urls": [
    {
      "id": "url_123",
      "folderId": "folder_123",
      "title": "网址标题",
      "url": "https://example.com",
      "isStarred": false,
      "isDeleted": false,
      "createdAt": 1234567890,
      "updatedAt": 1234567890
    }
  ],
  "trash": [],
  "permanentlyDeletedFolderIds": [],
  "settings": {
    "sortMode": "updatedAt",
    "fontSize": "medium",
    "language": "zh",
    "nightMode": "auto"
  },
  "lastSyncAt": 1234567890
}
```

### 错误响应格式

```json
{
  "message": "错误信息",
  "success": false
}
```

### 成功响应格式

```json
{
  "success": true,
  "message": "操作成功",
  "data": {}
}
```

---

## 🔐 认证说明

### JWT Token认证

1. **获取Token**：
   - 通过 `/api/v1/auth/login` 或 `/api/v1/auth/register` 获取
   - Token有效期：7天
   - RefreshToken有效期：30天

2. **使用Token**：
   ```
   Authorization: Bearer <token>
   ```

3. **刷新Token**：
   - 使用 `/api/v1/auth/refresh-token` 刷新
   - 需要提供 `refreshToken`

### 管理员Session认证

1. **登录**：
   - 通过 `/api/v1/admin/login` 登录
   - 使用管理员密码
   - 设置session

2. **验证**：
   - 其他接口自动验证session
   - 使用 `requireAdminAuth` 中间件

---

## 🚦 速率限制

| 接口 | 限制 | 时间窗口 |
|------|------|----------|
| 发送验证码 | 5次 | 15分钟 |
| 注册 | 10次 | 1小时 |
| 登录 | 10次 | 15分钟 |
| 管理员登录 | 5次 | 5分钟 |

---

## 📝 注意事项

1. **版本化API**：
   - 推荐使用 `/api/v1/*`
   - 旧版本 `/api/*` 已弃用，但保持兼容

2. **数据同步**：
   - 基于 `updatedAt` 时间戳判断数据新旧
   - 删除操作优先接受
   - 自动去重，确保ID唯一性

3. **软删除**：
   - 删除操作使用软删除（`isDeleted = true`）
   - 数据保留在服务器，可恢复

4. **永久删除**：
   - 文件夹永久删除后，ID加入 `permanentlyDeletedFolderIds`
   - 永久删除的数据无法恢复

5. **日志**：
   - 普通用户和管理员都有日志接口
   - 管理员可查看所有日志，普通用户只能查看自己的日志

---

## 🔗 相关文件

- `backend/src/server.js` - 服务器入口，路由注册
- `backend/src/routes/auth.js` - 认证路由
- `backend/src/routes/data.js` - 数据同步路由
- `backend/src/routes/message.js` - 消息路由
- `backend/src/routes/admin.js` - 管理后台API路由
- `backend/src/routes/admin-ui.js` - 管理后台UI路由
- `backend/src/middleware/adminAuth.js` - 管理员认证中间件

---

**最后更新**：2026-01-03  
**API版本**：v1.0.0







