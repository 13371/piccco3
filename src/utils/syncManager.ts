/**
 * 同步管理器
 * 负责防抖、版本控制、变化检测等核心逻辑
 */
import { Note, Folder, Url } from '../types';

export interface SyncItem {
  id: string;
  type: 'note' | 'folder' | 'url';
  data: Note | Folder | Url;
  hash?: string; // 内容哈希，用于快速检测变化
}

/**
 * 计算内容哈希（简单实现，用于快速检测变化）
 */
export function computeHash(content: string): string {
  // 使用简单的哈希算法（实际项目中可以使用 crypto.subtle.digest）
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}

/**
 * 检测数据项是否有变化
 */
export function hasItemChanged(
  current: SyncItem,
  previous: SyncItem | undefined
): boolean {
  if (!previous) return true; // 新项，有变化

  // 使用 updatedAt 和 hash 双重检测
  const currentHash = current.hash || computeHash(JSON.stringify(current.data));
  const previousHash = previous.hash || computeHash(JSON.stringify(previous.data));

  if (currentHash !== previousHash) return true;
  if (current.data.updatedAt !== previous.data.updatedAt) return true;

  // 检查删除状态
  if ('isDeleted' in current.data && 'isDeleted' in previous.data) {
    if (current.data.isDeleted !== previous.data.isDeleted) return true;
  }

  return false;
}

/**
 * 提取变化的数据项（增量同步）
 */
export function extractChangedItems<T extends Note | Folder | Url>(
  current: T[],
  previous: Map<string, T>,
  type: 'note' | 'folder' | 'url'
): SyncItem[] {
  const changed: SyncItem[] = [];

  for (const item of current) {
    const prev = previous.get(item.id);
    
    // 计算哈希
    const hash = computeHash(JSON.stringify(item));
    
    if (hasItemChanged(
      { id: item.id, type, data: item, hash },
      prev ? { id: prev.id, type, data: prev, hash: computeHash(JSON.stringify(prev)) } : undefined
    )) {
      changed.push({
        id: item.id,
        type,
        data: item,
        hash,
      });
    }
  }

  // 检查是否有删除的项（在 previous 中但不在 current 中）
  for (const [id, prev] of previous) {
    const exists = current.find(item => item.id === id);
    if (!exists && !prev.isDeleted) {
      // 项被删除了
      changed.push({
        id,
        type,
        data: { ...prev, isDeleted: true, deletedAt: Date.now(), updatedAt: Date.now() } as T,
      });
    }
  }

  return changed;
}

/**
 * 防抖函数（支持动态延迟 800-1200ms）
 */
export function createDebouncedSync(
  syncFn: () => void,
  minDelay: number = 800,
  maxDelay: number = 1200
): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  
  // 随机延迟，避免多个设备同时同步
  const getDelay = () => {
    return Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
  };

  return () => {
    if (timer) {
      clearTimeout(timer);
    }
    
    timer = setTimeout(() => {
      syncFn();
      timer = null;
    }, getDelay());
  };
}

/**
 * 版本控制：更新本地版本（使用统一的 version 字段）
 */
export function updateLocalVersion<T extends Note | Folder | Url>(item: T): T {
  const currentVersion = (item as any).version || 0;
  return {
    ...item,
    version: currentVersion + 1,
    updatedAt: Date.now(),
  } as T;
}

/**
 * 版本控制：同步成功后更新版本号
 */
export function markAsSynced<T extends Note | Folder | Url>(
  item: T,
  serverVersion: number
): T {
  return {
    ...item,
    version: serverVersion,
    updatedAt: Date.now(),
  } as T;
}

/**
 * 检查版本冲突
 * @returns true 如果有冲突，false 如果没有冲突
 */
export function hasVersionConflict(
  clientItem: Note | Folder | Url,
  serverItem: Note | Folder | Url | undefined
): boolean {
  if (!serverItem) return false; // 服务器没有该项，无冲突
  
  const clientVersion = (clientItem as any).version || 0;
  const serverVersion = (serverItem as any).version || 0;
  const clientUpdatedAt = clientItem.updatedAt || 0;
  const serverUpdatedAt = serverItem.updatedAt || 0;
  
  // 如果版本号相同但 updatedAt 不同，说明有冲突
  if (clientVersion === serverVersion && clientUpdatedAt !== serverUpdatedAt) {
    return true;
  }
  
  // 如果客户端版本更小但 updatedAt 更大，可能有冲突
  if (clientVersion < serverVersion && clientUpdatedAt > serverUpdatedAt) {
    return true;
  }
  
  return false;
}

/**
 * 解决版本冲突：使用 updatedAt 更大的版本，如果相同则合并
 */
export function resolveVersionConflict<T extends Note | Folder | Url>(
  clientItem: T,
  serverItem: T
): T {
  const clientUpdatedAt = clientItem.updatedAt || 0;
  const serverUpdatedAt = serverItem.updatedAt || 0;
  
  // 如果客户端更新，使用客户端数据，但版本号使用服务器版本+1
  if (clientUpdatedAt > serverUpdatedAt) {
    return {
      ...clientItem,
      version: ((serverItem as any).version || 0) + 1,
    } as T;
  }
  
  // 如果服务器更新，使用服务器数据
  if (serverUpdatedAt > clientUpdatedAt) {
    return serverItem;
  }
  
  // 如果时间相同，优先保留删除操作
  if (clientItem.isDeleted && !serverItem.isDeleted) {
    return {
      ...clientItem,
      version: ((serverItem as any).version || 0) + 1,
    } as T;
  }
  
  if (serverItem.isDeleted && !clientItem.isDeleted) {
    return serverItem;
  }
  
  // 默认使用服务器数据（服务器是权威来源）
  return serverItem;
}



