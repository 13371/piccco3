# 删除功能调试步骤

## 立即执行：检查删除操作

### 步骤 1: 检查浏览器控制台
1. 在浏览器中，按 `F12` 打开开发者工具
2. 切换到 **Console** 标签
3. **清除所有日志**（点击清除按钮）
4. **删除一个文件**（笔记、文件夹或网址）
5. 立即查看控制台日志，查找以下内容：

#### 应该看到的日志：
```
[dataStore] 软删除笔记: { id: '...', isDeleted: true, deletedAt: ..., updatedAt: ... }
[dataStore] 删除笔记后，立即触发同步，isDeleteOperation=true
[dataStore] immediateSync 执行，调用 syncDataToServer(true)
[dataStore] 删除后检查笔记状态: { id: '...', isDeleted: true, ... }
[dataStore] 🔴 准备同步已删除的笔记到服务器: { count: X, ... }
[dataStore] 📤 发送同步请求到服务器: { deletedNotes: X, isDeleteOperation: true, ... }
```

#### 如果没有看到这些日志：
- 说明前端代码可能还是旧版本
- 需要清除浏览器缓存或使用无痕模式测试

### 步骤 2: 检查 Network 请求
1. 在开发者工具中，切换到 **Network** 标签
2. **确保 "Disable cache" 已勾选**
3. **清除所有请求记录**（右键点击请求列表，选择"Clear browser cache"）
4. **删除一个文件**
5. 找到 `/api/v1/data/sync` 请求（应该是最新的请求）
6. **点击该请求**，查看：
   - **Request Payload**（请求体）
   - **Response**（响应）

#### Request Payload 应该包含：
```json
{
  "notes": [
    {
      "id": "...",
      "isDeleted": true,
      "deletedAt": 1234567890,
      "updatedAt": 1234567890,
      ...
    }
  ],
  ...
}
```

#### 如果 Request Payload 中没有 `isDeleted: true` 的数据：
- 说明前端同步逻辑有问题
- 需要检查 `syncDataToServer` 函数是否正确传递了 `isDeleteOperation: true`

### 步骤 3: 检查服务器端响应
1. 在 Network 标签中，查看 `/api/v1/data/sync` 请求的 **Response**
2. 检查响应中是否包含已删除的项目

### 步骤 4: 检查服务器端日志
在服务器上执行：
```bash
cd /www/wwwroot/piccco3/backend
pm2 logs piccco-backend --lines 100 | grep -i "删除\|delete\|isDeleted\|保存删除"
```

### 步骤 5: 检查数据库
在服务器上执行：
```bash
# 连接到 PostgreSQL
psql -U your_db_user -d your_db_name

# 检查最近删除的笔记（替换为你的数据库信息）
SELECT id, is_deleted, deleted_at, updated_at 
FROM notes 
WHERE updated_at > extract(epoch from now() - interval '10 minutes') * 1000
ORDER BY updated_at DESC 
LIMIT 10;
```

## 常见问题排查

### 问题 1: 控制台没有删除日志
**原因：** 浏览器可能还在使用缓存的旧代码
**解决：**
1. 按 `Ctrl + Shift + Delete` 清除浏览器缓存
2. 或使用无痕模式测试（`Ctrl + Shift + N`）

### 问题 2: Request Payload 中没有 isDeleted: true
**原因：** 前端同步逻辑可能有问题
**解决：** 检查 `syncDataToServer` 函数是否正确传递了 `isDeleteOperation: true`

### 问题 3: 服务器端没有保存删除状态
**原因：** 服务器端保存逻辑可能有问题
**解决：** 检查服务器端日志，确认是否保存了删除状态

### 问题 4: 删除后被后续同步覆盖
**原因：** `syncDataFromServer` 可能覆盖了删除状态
**解决：** 已添加保护机制，但如果服务器端没有正确保存，仍然会被覆盖

