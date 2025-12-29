# 多平台登录同步问题修复建议

## 🔴 发现的问题

### 1. **消息API调用错误** ⚠️ 严重
**位置**: `src/stores/messageStore.ts:38`
**问题**: 
- 代码中还在使用旧的API格式：`/message/messages?userId=${currentUser.id}`
- 但后端已经改为从JWT token中获取userId，不再需要query参数
- 这会导致API调用失败或返回错误

**当前代码**:
```typescript
const res = await fetch(`${API_BASE_URL}/message/messages?userId=${currentUser.id}`);
```

**应该改为**:
```typescript
const token = useUserStore.getState().token;
const res = await fetch(`${API_BASE_URL}/message/messages`, {
  headers: {
    'Authorization': `Bearer ${token}`,
  },
});
```

### 2. **消息标记已读缺少Token** ⚠️ 严重
**位置**: `src/stores/messageStore.ts:75, 95`
**问题**:
- `markAsRead` 和 `markAllAsRead` 函数调用API时没有发送Authorization header
- 后端需要JWT token来验证身份

**当前代码**:
```typescript
await fetch(`${API_BASE_URL}/message/messages/${id}/read`, {
  method: 'POST',
});
```

**应该改为**:
```typescript
const token = useUserStore.getState().token;
await fetch(`${API_BASE_URL}/message/messages/${id}/read`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
  },
});
```

## 📋 需要修复的文件

1. ✅ `src/stores/messageStore.ts` - 修复API调用，添加Authorization header

## 💡 其他优化建议

### 1. **自动同步消息**
**位置**: `src/components/Layout.tsx` 或 `src/pages/MessageCenterPage.tsx`
**建议**: 
- 定期自动调用 `loadMessagesFromServer()`
- 例如：每30秒或1分钟自动同步一次
- 或在应用获得焦点时同步

### 2. **数据同步机制**
**建议**: 
- 实现数据（笔记、文件夹、URL）的云端同步
- 添加后端API存储用户数据
- 登录时自动从服务器加载数据

### 3. **Token刷新机制**
**建议**: 
- 实现token自动刷新
- 避免用户频繁重新登录

## 🎯 优先级

1. **P0（立即修复）**: 
   - 修复消息API调用错误
   - 添加Authorization header

2. **P1（尽快实现）**: 
   - 自动同步消息
   - 实现数据云端同步

3. **P2（计划实现）**: 
   - Token刷新机制
   - 实时同步（WebSocket）


