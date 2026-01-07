# 删除功能问题调试指南

## 步骤 1: 检查浏览器控制台

1. 打开浏览器开发者工具（F12）
2. 切换到 **Console** 标签
3. **清除所有日志**
4. 删除一个文件（笔记、文件夹或网址）
5. 查找以下日志：

### 应该看到的日志：
```
[dataStore] 软删除笔记: { id: '...', folderId: '...', isDeleted: true, deletedAt: ..., updatedAt: ... }
[dataStore] 删除笔记后，立即触发同步，isDeleteOperation=true
[dataStore] immediateSync 执行，调用 syncDataToServer(true)
[dataStore] 删除后检查笔记状态: { id: '...', isDeleted: true, ... }
[dataStore] 同步前检查已删除的笔记数量: X
[dataStore] 📤 发送同步请求到服务器: { deletedNotes: X, ... }
```

### 如果看不到这些日志：
- 说明前端代码可能还是旧版本，需要清除浏览器缓存

## 步骤 2: 检查 Network 请求

1. 在开发者工具中，切换到 **Network** 标签
2. **勾选 "Disable cache"**（禁用缓存）
3. 删除一个文件
4. 找到 `/api/v1/data/sync` 请求
5. 点击该请求，查看 **Request Payload**

### 应该看到：
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

### 如果 Request Payload 中没有 `isDeleted: true` 的数据：
- 说明前端同步逻辑有问题

## 步骤 3: 检查服务器端日志

在服务器上执行：
```bash
cd /www/wwwroot/piccco3/backend
pm2 logs piccco-backend --lines 200 | grep -i "删除\|delete\|isDeleted\|保存删除"
```

### 应该看到：
```
保存删除的笔记: noteId=..., deletedAt=..., updatedAt=...
```

### 如果看不到这些日志：
- 说明服务器端可能没有正确保存删除状态

## 步骤 4: 检查数据库

在服务器上执行：
```bash
# 连接到 PostgreSQL（替换为你的数据库信息）
psql -U your_db_user -d your_db_name

# 检查已删除的笔记
SELECT id, is_deleted, deleted_at, updated_at 
FROM notes 
WHERE is_deleted = true 
ORDER BY deleted_at DESC 
LIMIT 10;

# 检查已删除的文件夹
SELECT id, is_deleted, deleted_at, updated_at 
FROM folders 
WHERE is_deleted = true 
ORDER BY deleted_at DESC 
LIMIT 10;
```

### 如果数据库中没有 `is_deleted = true` 的记录：
- 说明删除操作没有正确保存到数据库

## 步骤 5: 检查前端代码版本

在浏览器控制台中执行：
```javascript
// 检查 dataStore 中的 deleteNote 函数
console.log(useDataStore.getState().deleteNote.toString());
```

### 应该看到：
```javascript
function (id) {
  // ... 应该包含 immediateSync(() => { ... get().syncDataToServer(true); });
}
```

### 如果看到 setTimeout：
- 说明前端代码还是旧版本，需要清除浏览器缓存或重新上传 dist


