# 数据同步优化文档

## 📋 概述

本次优化重构了数据同步逻辑，实现了智能增量同步、防抖机制、失败重试和版本控制，大幅提升了同步效率和用户体验。

## ✨ 核心特性

### 1️⃣ 增量同步（只同步变化部分）

- **变化检测**：使用 `lastSyncedSnapshot` 快照对比，只同步有变化的数据
- **哈希检测**：使用内容哈希快速判断是否有变化
- **版本控制**：每条笔记维护 `localVersion`、`serverVersion`、`isDirty` 字段
- **无变化跳过**：如果数据无变化，不发送请求

### 2️⃣ 防抖机制（800-1200ms）

- **随机延迟**：800-1200ms 随机延迟，避免多设备同时同步
- **用户停止输入**：用户停止输入 800-1200ms 后自动同步
- **不阻塞输入**：同步在后台进行，不影响用户操作

### 3️⃣ 定时兜底同步（3分钟）

- **防止漏同步**：即使没有触发同步，每 3 分钟自动同步一次
- **只拉取数据**：兜底同步只从服务器拉取，不上传（避免无变化时也上传）

### 4️⃣ 页面事件触发同步

- **页面隐藏**：立即同步本地变更到服务器
- **页面可见**：从服务器拉取最新数据
- **页面加载**：刷新网页时从服务器同步
- **页面焦点**：切换回标签页时同步
- **网络恢复**：恢复网络后自动同步未同步的变更

### 5️⃣ 失败自动重试（退避策略）

- **第1次**：5秒后重试
- **第2次**：15秒后重试
- **第3次**：60秒后重试
- **超过3次**：提示但不影响继续使用

### 6️⃣ 数据一致性保证

- **版本控制**：每条笔记维护版本号，避免覆盖问题
- **服务器优先**：服务器数据始终是权威来源
- **冲突解决**：使用 `updatedAt` 时间戳判断最新版本

### 7️⃣ UI 反馈

- **同步中**：右下角小图标转圈（低优先级，不干扰用户）
- **失败提示**：角落提示"同步失败，将自动重试"
- **成功提示**：短暂显示成功图标后消失

## 📁 新增文件

### `src/utils/retryQueue.ts`
重试队列管理器，实现退避策略。

### `src/utils/syncManager.ts`
同步管理器，提供：
- `createDebouncedSync`: 创建防抖同步函数
- `extractChangedItems`: 提取变化的数据项
- `updateLocalVersion`: 更新本地版本
- `markAsSynced`: 标记为已同步
- `hasUnsyncedChanges`: 检查是否有未同步的改动
- `computeHash`: 计算内容哈希

### `src/components/SyncStatusIndicator.tsx`
同步状态指示器组件，显示同步状态。

## 🔧 修改的文件

### `src/types/index.ts`
- 添加版本控制字段到 `Note` 接口：
  - `localVersion?: number`
  - `serverVersion?: number`
  - `lastSyncedAt?: number`
  - `isDirty?: boolean`

### `src/stores/dataStore.ts`
- 优化防抖机制（800-1200ms）
- 添加增量同步检测
- 集成重试队列
- 添加版本控制逻辑
- 优化同步逻辑，只同步变化部分

### `src/components/Layout.tsx`
- 去掉定期自动同步（30秒）
- 改为 3 分钟兜底同步
- 添加页面隐藏/可见时的同步
- 添加网络恢复监听

## 🚀 使用方法

### 在代码中使用

```typescript
// 添加/更新笔记时，自动触发同步（防抖 800-1200ms）
const noteId = useDataStore.getState().addNote('内容', folderId);
// 或
useDataStore.getState().updateNote(noteId, '新内容', folderId);

// 删除操作立即同步（不使用防抖）
useDataStore.getState().deleteNote(noteId);

// 手动触发同步
useDataStore.getState().syncDataToServer();

// 从服务器拉取最新数据
useDataStore.getState().syncDataFromServer(0, true);
```

### 同步状态监听

```typescript
const isUploading = useDataStore((state) => state.isUploading);
const syncError = useDataStore((state) => state.syncError);
const syncSuccess = useDataStore((state) => state.syncSuccess);
```

## 📊 同步流程

```
用户修改内容
    ↓
800-1200ms 防抖（随机延迟）
    ↓
检测是否有变化（与快照对比）
    ↓
有变化 → 只同步变化部分
无变化 → 跳过同步
    ↓
发送到服务器
    ↓
成功 → 更新版本信息，更新快照
失败 → 进入重试队列（退避策略）
```

## 🔍 调试

### 查看同步日志

打开浏览器控制台，查看以下日志：
- `[dataStore]` - 数据同步相关日志
- `[RetryQueue]` - 重试队列日志
- `[Layout]` - 页面事件触发日志

### 检查同步状态

```typescript
const state = useDataStore.getState();
console.log('同步状态:', {
  isUploading: state.isUploading,
  isDownloading: state.isDownloading,
  pendingChanges: state.pendingChanges,
  syncError: state.syncError,
  lastSyncTime: state.lastSyncTime,
});
```

## ⚠️ 注意事项

1. **版本控制**：新创建的笔记会自动设置 `localVersion: 1`，同步成功后更新为服务器版本
2. **防抖重置**：删除操作会立即同步，并重置防抖函数
3. **网络断开**：数据保存在本地，恢复网络后自动同步
4. **并发控制**：使用 `syncQueue` 确保同步操作串行执行，避免并发冲突

## 🎯 性能优化

- ✅ 只同步变化部分，减少网络传输
- ✅ 防抖机制，避免频繁请求
- ✅ 无变化时跳过同步，节省资源
- ✅ 异步执行，不阻塞用户操作
- ✅ 重试队列，自动处理失败情况

## 📝 后续优化建议

1. 实现真正的增量同步 API（后端支持）
2. 添加同步进度显示
3. 支持离线队列（IndexedDB）
4. 添加同步冲突解决UI
5. 优化大数据量同步（分批同步）




























