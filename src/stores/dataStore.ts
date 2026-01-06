import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Folder, Note, Url, TrashItem, FolderColor } from '../types';
import { useUserStore } from './userStore';
import { API_BASE_URL } from '../config/api';
import { syncQueue } from '../utils/syncQueue';
import { retryQueue } from '../utils/retryQueue';
import { createDebouncedSync, updateLocalVersion, markAsSynced } from '../utils/syncManager';
import { encryptPrivacyPassword, verifyPrivacyPassword } from '../utils/privacyPassword';
import { logger } from '../utils/logger';

interface DataState {
  folders: Folder[];
  notes: Note[];
  urls: Url[];
  trash: TrashItem[];
  
  // 已永久删除的文件夹ID列表（永远不会被恢复）
  permanentlyDeletedFolderIds: Set<string>;
  // 已永久删除的笔记ID列表（永远不会被恢复）
  permanentlyDeletedNoteIds: Set<string>;
  // 已永久删除的网址ID列表（永远不会被恢复）
  permanentlyDeletedUrlIds: Set<string>;
  
  // 同步状态
  pendingChanges: boolean;
  isUploading: boolean;
  isDownloading: boolean;
  lastSyncTime: number | null;
  syncError: string | null; // 同步错误信息
  syncSuccess: boolean; // 最近一次同步是否成功
  syncRetryCount: number; // 同步重试次数
  lastRetryTime: number | null; // 最后重试时间
  lastSyncedSnapshot: { // 上次同步的数据快照（用于增量同步）
    folders: Map<string, Folder>;
    notes: Map<string, Note>;
    urls: Map<string, Url>;
    homeContent: string;
  } | null;
  
  // 文件夹操作
  addFolder: (name: string, type: Folder['type'], color?: FolderColor, password?: string) => string;
  updateFolder: (id: string, updates: Partial<Folder>) => void;
  deleteFolder: (id: string) => Promise<{ ok: boolean; message?: string }>;
  canDeleteFolder: (id: string) => { canDelete: boolean; message?: string };
  toggleFolderStar: (id: string) => void;
  changeFolderColor: (id: string, color: FolderColor) => void;
  reorderFolder: (dragId: string, targetId: string) => void;
  
  // 记事操作
  addNote: (content: string, folderId?: string) => string;
  updateNote: (id: string, content: string, folderId?: string) => void;
  deleteNote: (id: string) => void;
  toggleNoteStar: (id: string) => void;
  
  // 网址操作
  addUrl: (title: string, url: string, folderId?: string) => string;
  updateUrl: (id: string, updates: Partial<Url>) => void;
  deleteUrl: (id: string) => void;
  toggleUrlStar: (id: string) => void;
  
  // 回收站操作
  restoreFromTrash: (id: string) => void;
  permanentlyDelete: (id: string) => void;
  cleanExpiredTrash: () => void;
  
  // 查询方法
  getNotesByFolder: (folderId?: string) => Note[];
  getUrlsByFolder: (folderId?: string) => Url[];
  getAllNotes: (excludePrivacy?: boolean) => Note[];
  getFolderById: (id: string) => Folder | undefined;
  verifyFolderPassword: (id: string, password: string) => boolean;
  
  // 数据同步方法
  syncDataFromServer: (retryCount?: number, prioritizeServer?: boolean) => Promise<void>;
  syncDataToServer: (isDeleteOperation?: boolean) => Promise<void>;
  getLastSyncTime: () => number | null;
  setLastSyncTime: (time: number | null) => void;
  clearSyncError: () => void;
  handleSyncRetry: (type: 'download' | 'upload', errorMessage: string) => Promise<void>;
  forceResetSyncState: () => void; // 强制重置同步状态
}

const TRASH_EXPIRY_DAYS = 30;
const TRASH_EXPIRY_MS = TRASH_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

/**
 * 清理重复记录：只保留 updatedAt 最大的一条
 * 强制要求：确保 id 唯一性（模拟 UNIQUE(userId, id) 约束）
 * 绝对不允许创建新记录，只允许更新同一个 id 的那条记录
 * 关键修复：使用 mergeItem 逻辑，确保已删除的项不会被未删除的版本覆盖
 */
function deduplicateById<T extends { id: string; updatedAt?: number; isDeleted?: boolean; deletedAt?: number | null }>(list: T[] = []): T[] {
  const map = new Map<string, T>();
  list.forEach((item) => {
    if (!item.id) {
      return; // 跳过没有 id 的项
    }
    if (!map.has(item.id)) {
      map.set(item.id, item);
    } else {
      // 使用 mergeItem 逻辑去重，确保一切以服务器为准
      const existing = map.get(item.id);
      if (existing) {
        const merged = mergeItem(existing, item, true); // 强制优先使用服务器数据
        map.set(item.id, merged);
      }
    }
  });
  return Array.from(map.values());
}

// 合并数组（保留最新的数据）
/**
 * 合并单个数据项
 * 强制要求：同步唯一判断标准是 updatedAt
 * 如果 incoming.updatedAt > local.updatedAt，则使用 incoming
 * 禁止任何字段级别的合并，禁止根据 isDeleted 触发恢复
 */
/**
 * 合并单个数据项
 * 强制要求：
 * 1. 同步唯一判断标准是 updatedAt
 * 2. 如果 incoming.updatedAt > local.updatedAt，则使用 incoming
 * 3. 禁止默认 isDeleted = false
 * 4. 如果 incoming 未提供 isDeleted，保持原值
 */
/**
 * 合并单个数据项
 * 强制要求：一切数据以服务器为准
 * 1. 如果服务器有数据，优先使用服务器数据（无论本地数据如何）
 * 2. 如果服务器已删除，使用服务器删除状态
 * 3. 如果服务器未删除，使用服务器数据
 * 4. 只有在服务器没有该数据时，才保留本地数据（新创建的）
 */
function mergeItem<T extends { id: string; updatedAt?: number; createdAt?: number; isDeleted?: boolean; deletedAt?: number | null }>(
  local: T,
  server: T,
  prioritizeServer: boolean = true  // 默认优先使用服务器数据
): T {
  // 优化：强制服务器数据优先策略
  // 强制要求：一切数据以服务器为准
  // 如果服务器有数据，强制使用服务器数据（无论本地数据如何）
  if (prioritizeServer) {
    // 服务器有数据，强制使用服务器数据（完全覆盖本地数据）
    // 这确保服务器数据始终是权威来源
    // 但保留本地的 createdAt（如果服务器没有或本地更新）
    const localCreatedAt = local.createdAt || 0;
    const serverCreatedAt = server.createdAt || 0;
    // 如果本地创建时间更新（说明是本地新创建的），保留本地创建时间
    const finalCreatedAt = (localCreatedAt > serverCreatedAt && serverCreatedAt === 0) 
      ? localCreatedAt 
      : (serverCreatedAt || localCreatedAt);
    
    return {
      ...server,
      // 确保所有字段都以服务器为准
      isDeleted: server.isDeleted !== undefined ? server.isDeleted : false,
      deletedAt: server.deletedAt !== undefined ? server.deletedAt : null,
      updatedAt: server.updatedAt !== undefined ? server.updatedAt : local.updatedAt,
      createdAt: finalCreatedAt, // 保留正确的创建时间
    };
  }
  
  // 如果 prioritizeServer = false（特殊情况），使用 updatedAt 判断
  const localTime = local.updatedAt || 0;
  const serverTime = server.updatedAt || 0;
  
  // 如果服务器已删除，但本地未删除，使用服务器删除状态
  if (server.isDeleted && !local.isDeleted) {
    return {
      ...local,
      ...server,
      isDeleted: true,
      deletedAt: server.deletedAt,
    };
  }
  
  // 如果本地已删除，但服务器未删除，使用服务器数据（恢复）
  if (local.isDeleted && !server.isDeleted) {
    return {
      ...local,
      ...server,
      isDeleted: false,
      deletedAt: null,
    };
  }
  
  // 两者都删除或都未删除，使用 updatedAt 更大的
  if (serverTime > localTime) {
    return {
      ...local,
      ...server,
      isDeleted: server.isDeleted !== undefined ? server.isDeleted : local.isDeleted,
      deletedAt: server.deletedAt !== undefined ? server.deletedAt : local.deletedAt,
    };
  }
  
  // 否则保留本地数据
  return local;
}

/**
 * 合并数组
 * 强制要求：
 * 1. 同步唯一判断标准是 updatedAt
 * 2. 如果 incoming.updatedAt > local.updatedAt，则使用 incoming
 * 3. 禁止因为 incoming.isDeleted == false 就把本地数据恢复
 * 4. 禁止写 note.isDeleted = incoming.isDeleted || false
 * @param deletedIds 已删除的ID集合（用于过滤，防止恢复已删除的项）
 */
/**
 * 合并数组
 * 强制要求：一切数据以服务器为准
 * 1. 先添加服务器数据（优先）
 * 2. 再添加本地数据，如果服务器没有该数据，才保留本地数据（新创建的）
 * 3. 如果两者都有，优先使用服务器数据
 */
function mergeArrays<T extends { id: string; updatedAt?: number; isDeleted?: boolean }>(
  local: T[],
  server: T[],
  deletedIds?: Set<string>,
  prioritizeServer: boolean = true  // 默认优先使用服务器数据
): T[] {
  const map = new Map<string, T>();
  
  // 优化：强制服务器数据优先策略
  // 第一步：先添加服务器数据（强制优先），但排除已删除的项（永久删除列表）
  server.forEach((item) => {
    // 如果该项在永久删除列表中，直接跳过
    if (deletedIds && deletedIds.has(item.id)) {
      return;
    }
    // 服务器数据优先，直接设置（强制使用服务器数据）
    map.set(item.id, item);
  });
  
  // 第二步：再添加本地数据，但只在服务器没有该数据时才保留
  // 如果服务器已有该数据，强制使用服务器数据（不合并）
  local.forEach((item) => {
    // 如果该项在永久删除列表中，直接跳过
    if (deletedIds && deletedIds.has(item.id)) {
      return;
    }
    
    const existing = map.get(item.id);
    if (!existing) {
      // 本地有但服务器没有，添加本地数据（可能是新创建的，还未同步）
      map.set(item.id, item);
    } else {
      // 两者都有，强制使用服务器数据（不合并，直接使用服务器数据）
      // 这确保服务器数据始终是权威来源
      if (prioritizeServer) {
        // 强制使用服务器数据，不合并
        map.set(item.id, existing);
      } else {
        // 特殊情况：如果 prioritizeServer = false，使用 mergeItem 合并
        const merged = mergeItem(item, existing, prioritizeServer);
        map.set(item.id, merged);
      }
    }
  });
  
  return Array.from(map.values());
}

// 防抖同步函数（优化：800-1200ms 防抖，随机延迟避免并发）
let debouncedSyncFn: (() => void) | null = null;

function debouncedUploadSync(syncFn: () => void) {
  if (!debouncedSyncFn) {
    debouncedSyncFn = createDebouncedSync(syncFn, 800, 1200);
  }
  debouncedSyncFn();
}

// 立即同步函数（用于删除等关键操作）
// 优化：添加延迟机制，避免批量删除时多次同步请求造成的竞态条件
let immediateSyncTimeoutId: ReturnType<typeof setTimeout> | null = null;
function immediateSync(syncFn: () => void) {
  // 重置防抖函数，取消任何待执行的防抖同步
  debouncedSyncFn = null;
  
  // 如果已有待执行的立即同步，取消它（批量删除时，只执行最后一次同步）
  if (immediateSyncTimeoutId) {
    clearTimeout(immediateSyncTimeoutId);
    immediateSyncTimeoutId = null;
  }
  
  // 延迟50ms执行同步，这样可以合并批量删除操作
  immediateSyncTimeoutId = setTimeout(() => {
    immediateSyncTimeoutId = null;
    syncFn();
  }, 50);
}

// 初始化默认文件夹
const initializeDefaultFolders = (): Folder[] => {
  const now = Date.now();
  return [
    {
      id: 'folder_privacy_default',
      name: '隐私',
      type: 'privacy',
      color: 'purple',
      isStarred: false,
      order: 0,
      createdAt: now,
      updatedAt: now,
      // 首次进入时由用户自行设置密码
      password: undefined,
      isDeleted: false,
      deletedAt: null,
    },
    {
      id: 'folder_category1_default',
      name: '分类1',
      type: 'normal',
      color: 'blue',
      isStarred: false,
      order: 1,
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
      deletedAt: null,
    },
    {
      id: 'folder_category2_default',
      name: '分类2',
      type: 'normal',
      color: 'green',
      isStarred: false,
      order: 2,
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
      deletedAt: null,
    },
  ];
};

// 检查用户是否被封禁
const checkBanned = () => {
  const userStore = useUserStore.getState();
  if (userStore.isBanned()) {
    alert('您的账号已被封禁，无法进行此操作');
    return true;
  }
  return false;
};

export const useDataStore = create<DataState>()(
  persist(
    (set, get) => ({
      folders: [],
      notes: [],
      urls: [],
      trash: [], // 新用户回收站默认为空
      permanentlyDeletedFolderIds: new Set<string>(),
      permanentlyDeletedNoteIds: new Set<string>(),
      permanentlyDeletedUrlIds: new Set<string>(),
      
      addFolder: (name, type, color = 'blue', password) => {
        if (checkBanned()) return '';
        const id = `folder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const now = Date.now();
        const current = get().folders;
        const maxOrder =
          current.length > 0 ? Math.max(...current.map((f) => (f.order ?? 0))) : -1;
        
        // 如果设置了密码（隐私文件夹），需要加密
        let encryptedPassword = password;
        if (password && type === 'privacy') {
          try {
            encryptedPassword = encryptPrivacyPassword(password);
          } catch (e) {
            logger.warn('[dataStore] 密码加密失败，使用明文:', e);
            // 如果加密失败，使用明文（向后兼容）
          }
        }
        
        const newFolder: Folder = {
          id,
          name,
          type,
          color,
          isStarred: false,
          order: maxOrder + 1,
          createdAt: now,
          updatedAt: now,
          password: encryptedPassword,
          isDeleted: false,
          deletedAt: null,
          version: 1, // 新创建的文件夹版本号为1
        };
        set((state) => ({
          folders: [...state.folders, newFolder],
        }));
        
        // 标记有变更，自动同步到服务器（防抖1秒）
        set({ pendingChanges: true });
        debouncedUploadSync(() => get().syncDataToServer());
        
        return id;
      },
      
      updateFolder: (id, updates) => {
        if (checkBanned()) return;
        
        // 如果更新包含密码，需要加密
        const processedUpdates: Partial<Folder> = {};
        
        // 只更新提供的字段，禁止默认 isDeleted = false
        if (updates.name !== undefined) processedUpdates.name = updates.name;
        if (updates.type !== undefined) processedUpdates.type = updates.type;
        if (updates.color !== undefined) processedUpdates.color = updates.color;
        if (updates.icon !== undefined) processedUpdates.icon = updates.icon;
        if (updates.isStarred !== undefined) processedUpdates.isStarred = updates.isStarred;
        if (updates.order !== undefined) processedUpdates.order = updates.order;
        if (updates.password !== undefined) {
          processedUpdates.password = typeof updates.password === 'string' 
            ? encryptPrivacyPassword(updates.password) 
            : updates.password;
        }
        // 禁止默认 isDeleted = false：只在显式提供时更新
        if (updates.isDeleted !== undefined) processedUpdates.isDeleted = updates.isDeleted;
        if (updates.deletedAt !== undefined) processedUpdates.deletedAt = updates.deletedAt;
        
        set((state) => ({
          folders: state.folders.map((f) => {
            if (f.id === id) {
              // 使用版本控制更新
              const updated = updateLocalVersion({
                ...f,
                ...processedUpdates,
              });
              return updated;
            }
            return f;
          }),
        }));
        
        // 标记有变更，自动同步到服务器（防抖1秒）
        set({ pendingChanges: true });
        debouncedUploadSync(() => get().syncDataToServer());
      },
      
      canDeleteFolder: (id) => {
        const folder = get().folders.find((f) => f.id === id && !f.isDeleted);
        if (!folder) {
          return { canDelete: false, message: '文件夹不存在或已被删除' };
        }
        
        // 隐私文件夹不能被删除
        if (folder.type === 'privacy') {
          return { canDelete: false, message: '隐私文件夹不能被删除' };
        }
        
        // 检查文件夹内是否有记事（未删除的）
        const notesInFolder = get().notes.filter((n) => n.folderId === id && !n.isDeleted);
        if (notesInFolder.length > 0) {
          return { 
            canDelete: false, 
            message: `文件夹内还有 ${notesInFolder.length} 条记事，请先删除或移出记事后再删除文件夹` 
          };
        }
        
        // 检查文件夹内是否有网址（未删除的）
        const urlsInFolder = get().urls.filter((u) => u.folderId === id && !u.isDeleted);
        if (urlsInFolder.length > 0) {
          return { 
            canDelete: false, 
            message: `文件夹内还有 ${urlsInFolder.length} 个网址，请先删除或移出网址后再删除文件夹` 
          };
        }
        
        return { canDelete: true };
      },
      
      deleteFolder: async (id) => {
        if (checkBanned()) {
          return { ok: false, message: '账号已被封禁' };
        }
        
        const folder = get().folders.find((f) => f.id === id && !f.isDeleted);
        if (!folder) {
          logger.warn('[dataStore] 尝试删除不存在的文件夹:', id);
          return { ok: false, message: '文件夹不存在或已被删除' };
        }
        
        // 使用 canDeleteFolder 检查是否可以删除
        const checkResult = get().canDeleteFolder(id);
        if (!checkResult.canDelete) {
          return { ok: false, message: checkResult.message };
        }
        
        logger.log('[dataStore] 准备删除文件夹:', { folderId: id, folderName: folder.name });
        
        // 先更新本地状态，然后尝试同步到后端
        const now = Date.now();
        set((state) => {
          // 软删除文件夹（版本号递增）
          const updatedFolders = state.folders.map((f) =>
            f.id === id 
              ? { 
                  ...f, 
                  isDeleted: true, 
                  deletedAt: now, 
                  updatedAt: now,
                  version: ((f.version || 0) + 1), // 删除操作也增加版本号
                } 
              : f
          );
          
          // 软删除文件夹内的所有笔记（版本号递增）
          const updatedNotes = state.notes.map((n) =>
            n.folderId === id && !n.isDeleted 
              ? { 
                  ...n, 
                  isDeleted: true, 
                  deletedAt: now, 
                  updatedAt: now,
                  version: ((n.version || 0) + 1), // 删除操作也增加版本号
                } 
              : n
          );
          
          // 软删除文件夹内的所有网址（版本号递增）
          const updatedUrls = state.urls.map((u) =>
            u.folderId === id && !u.isDeleted 
              ? { 
                  ...u, 
                  isDeleted: true, 
                  deletedAt: now, 
                  updatedAt: now,
                  version: ((u.version || 0) + 1), // 删除操作也增加版本号
                } 
              : u
          );
          
          return {
            folders: updatedFolders,
            notes: updatedNotes,
            urls: updatedUrls,
          };
        });
        
        logger.log('[dataStore] 本地删除完成，尝试同步到后端');
        
        // 尝试调用后端删除接口（不阻塞，失败也不影响本地删除）
        const { token } = useUserStore.getState();
        if (token) {
          // 异步调用后端接口，不等待结果
          fetch(`${API_BASE_URL}/v1/data/folder/delete`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ folderId: id }),
          })
            .then(async (response) => {
              if (response.ok) {
                logger.log('[dataStore] 后端删除成功');
                // 记录成功日志到后端
                try {
                  await fetch(`${API_BASE_URL}/v1/data/logs`, {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${token}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ 
                      message: `前端删除文件夹成功: folderId=${id}, folderName=${folder.name}`,
                      level: 'info'
                    }),
                  }).catch(() => {}); // 忽略日志记录失败
                } catch {}
              } else {
                const errorText = await response.text().catch(() => '');
                let errorData;
                try {
                  errorData = errorText ? JSON.parse(errorText) : { message: '删除失败' };
                } catch {
                  errorData = { message: `HTTP ${response.status}` };
                }
                logger.warn('[dataStore] 后端删除失败，但本地已删除:', response.status, errorData);
                // 记录失败日志到后端
                try {
                  await fetch(`${API_BASE_URL}/v1/data/logs`, {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${token}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ 
                      message: `前端删除文件夹失败: folderId=${id}, folderName=${folder.name}, 错误: ${errorData.message || response.status}`,
                      level: 'warn'
                    }),
                  }).catch(() => {}); // 忽略日志记录失败
                } catch {}
              }
            })
            .catch((error) => {
              logger.warn('[dataStore] 调用后端删除接口失败，但本地已删除:', error);
            });
          
          // 标记有变更，立即同步到服务器
          set({ pendingChanges: true });
          logger.log('[dataStore] 删除文件夹后，立即触发同步，isDeleteOperation=true');
          immediateSync(() => {
            logger.log('[dataStore] immediateSync 执行，调用 syncDataToServer(true)');
            get().syncDataToServer(true);
          });
        } else {
          // 未登录，只更新本地状态
          set({ pendingChanges: true });
        }
        
        logger.log('[dataStore] 软删除文件夹及内部内容完成:', { folderId: id, folderName: folder.name });
        return { ok: true };
      },
      
      toggleFolderStar: (id) => {
        if (checkBanned()) return;
        set((state) => ({
          folders: state.folders.map((f) =>
            f.id === id ? { ...f, isStarred: !f.isStarred, updatedAt: Date.now() } : f
          ),
        }));
        
        // 标记有变更，自动同步到服务器（防抖1秒）
        set({ pendingChanges: true });
        debouncedUploadSync(() => get().syncDataToServer());
      },
      
      changeFolderColor: (id, color) => {
        if (checkBanned()) return;
        set((state) => ({
          folders: state.folders.map((f) =>
            f.id === id ? { ...f, color, updatedAt: Date.now() } : f
          ),
        }));
        
        // 标记有变更，自动同步到服务器（防抖1秒）
        set({ pendingChanges: true });
        debouncedUploadSync(() => get().syncDataToServer());
      },

      reorderFolder: (dragId, targetId) => {
        if (checkBanned()) return;
        set((state) => {
          const folders = [...state.folders];
          const drag = folders.find((f) => f.id === dragId);
          const target = folders.find((f) => f.id === targetId);
          if (!drag || !target || drag.id === target.id) {
            return { folders };
          }
          const dragOrder = drag.order ?? 0;
          const targetOrder = target.order ?? 0;
          drag.order = targetOrder;
          target.order = dragOrder;
          return { folders: [...folders] };
        });
        
        // 标记有变更，自动同步到服务器（防抖1秒）
        set({ pendingChanges: true });
        debouncedUploadSync(() => get().syncDataToServer());
      },
      
      addNote: (content, folderId) => {
        if (checkBanned()) return '';
        const id = `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newNote: Note = {
          id,
          content,
          folderId,
          isStarred: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isDeleted: false,
          deletedAt: null,
          version: 1, // 新创建的项版本号为1
        };
        set((state) => ({
          notes: [...state.notes, newNote],
        }));
        
        // 标记有变更，自动同步到服务器（防抖1秒）
        set({ pendingChanges: true });
        debouncedUploadSync(() => get().syncDataToServer());
        
        return id;
      },
      
      updateNote: (id, content, folderId) => {
        if (checkBanned()) return;
        set((state) => ({
          notes: state.notes.map((n) => {
            if (n.id === id) {
              // 使用版本控制更新
              const updated = updateLocalVersion({
                ...n,
                content,
                folderId,
              });
              return updated;
            }
            return n;
          }),
        }));
        
        // 标记有变更，自动同步到服务器（防抖 800-1200ms）
        set({ pendingChanges: true });
        debouncedUploadSync(() => get().syncDataToServer());
      },
      
      deleteNote: (id) => {
        if (checkBanned()) return;
        const note = get().notes.find((n) => n.id === id);
        if (!note) {
          logger.warn('[dataStore] 尝试删除不存在的笔记:', id);
          return;
        }
        
        // 软删除：设置 isDeleted = true, deletedAt = now, updatedAt = now
        const now = Date.now();
        set((state) => ({
          notes: state.notes.map((n) =>
            n.id === id
              ? { 
                  ...n, 
                  isDeleted: true, 
                  deletedAt: now, 
                  updatedAt: now,
                  version: ((n.version || 0) + 1), // 删除操作也增加版本号
                }
              : n
          ),
        }));
        
        const deletedNote = get().notes.find((n) => n.id === id);
        logger.log('[dataStore] 软删除笔记:', { 
          id, 
          folderId: note.folderId,
          isDeleted: deletedNote?.isDeleted,
          deletedAt: deletedNote?.deletedAt,
          updatedAt: deletedNote?.updatedAt,
        });
        
        // 标记有变更，立即同步到服务器（删除操作需要立即同步）
        set({ pendingChanges: true });
        logger.log('[dataStore] 删除笔记后，立即触发同步，isDeleteOperation=true');
        
        // 立即同步删除操作，不使用延迟（确保删除状态及时同步到服务器）
        immediateSync(() => {
          logger.log('[dataStore] immediateSync 执行，调用 syncDataToServer(true)');
          const state = get();
          const currentNote = state.notes.find((n) => n.id === id);
          const deletedNotes = state.notes.filter((n) => n.isDeleted);
          logger.log('[dataStore] 删除后检查笔记状态:', {
            id,
            isDeleted: currentNote?.isDeleted,
            deletedAt: currentNote?.deletedAt,
            updatedAt: currentNote?.updatedAt,
          });
          logger.log('[dataStore] 同步前检查已删除的笔记数量:', deletedNotes.length);
          if (deletedNotes.length > 0) {
            deletedNotes.forEach((n) => {
              logger.log('[dataStore] 已删除的笔记:', {
                id: n.id,
                isDeleted: n.isDeleted,
                deletedAt: n.deletedAt,
                updatedAt: n.updatedAt,
              });
            });
          }
          get().syncDataToServer(true);
        });
      },
      
      toggleNoteStar: (id) => {
        if (checkBanned()) return;
        set((state) => ({
          notes: state.notes.map((n) =>
            n.id === id 
              ? { 
                  ...n, 
                  isStarred: !n.isStarred, 
                  updatedAt: Date.now(),
                  version: ((n.version || 0) + 1), // 星标操作也增加版本号
                } 
              : n
          ),
        }));
        
        // 标记有变更，自动同步到服务器（防抖1秒）
        set({ pendingChanges: true });
        debouncedUploadSync(() => get().syncDataToServer());
      },
      
      addUrl: (title, url, folderId) => {
        if (checkBanned()) return '';
        const id = `url_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        // 自动添加 http:// 或 https:// 前缀
        const normalizedUrl = url.startsWith('http://') || url.startsWith('https://') 
          ? url 
          : `https://${url}`;
        
        const newUrl: Url = {
          id,
          title,
          url: normalizedUrl,
          folderId,
          isStarred: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isDeleted: false,
          deletedAt: null,
          version: 1, // 新创建的URL版本号为1
        };
        set((state) => ({
          urls: [...state.urls, newUrl],
        }));
        
        // 标记有变更，自动同步到服务器（防抖1秒）
        set({ pendingChanges: true });
        debouncedUploadSync(() => get().syncDataToServer());
        
        return id;
      },
      
      updateUrl: (id, updates) => {
        if (checkBanned()) return;
        
        // 只更新提供的字段，禁止默认 isDeleted = false
        const processedUpdates: Partial<Url> = {};
        if (updates.title !== undefined) processedUpdates.title = updates.title;
        if (updates.url !== undefined) processedUpdates.url = updates.url;
        if (updates.folderId !== undefined) processedUpdates.folderId = updates.folderId;
        if (updates.isStarred !== undefined) processedUpdates.isStarred = updates.isStarred;
        // 禁止默认 isDeleted = false：只在显式提供时更新
        if (updates.isDeleted !== undefined) processedUpdates.isDeleted = updates.isDeleted;
        if (updates.deletedAt !== undefined) processedUpdates.deletedAt = updates.deletedAt;
        
        set((state) => ({
          urls: state.urls.map((u) =>
            u.id === id ? { ...u, ...processedUpdates, updatedAt: Date.now() } : u
          ),
        }));
        
        // 标记有变更，自动同步到服务器（防抖1秒）
        set({ pendingChanges: true });
        debouncedUploadSync(() => get().syncDataToServer());
      },
      
      deleteUrl: (id) => {
        if (checkBanned()) return;
        const url = get().urls.find((u) => u.id === id);
        if (!url) {
          logger.warn('[dataStore] 尝试删除不存在的网址:', id);
          return;
        }
        
        // 软删除：设置 isDeleted = true, deletedAt = now, updatedAt = now
        const now = Date.now();
        set((state) => ({
          urls: state.urls.map((u) =>
            u.id === id 
              ? { 
                  ...u, 
                  isDeleted: true, 
                  deletedAt: now, 
                  updatedAt: now,
                  version: ((u.version || 0) + 1), // 删除操作也增加版本号
                } 
              : u
          ),
        }));
        
        logger.log('[dataStore] 软删除网址:', { id, folderId: url.folderId });
        
        // 标记有变更，立即同步到服务器（删除操作需要立即同步）
        set({ pendingChanges: true });
        logger.log('[dataStore] 删除网址后，立即触发同步，isDeleteOperation=true');
        immediateSync(() => {
          logger.log('[dataStore] immediateSync 执行，调用 syncDataToServer(true)');
          get().syncDataToServer(true);
        });
      },
      
      toggleUrlStar: (id) => {
        if (checkBanned()) return;
        set((state) => ({
          urls: state.urls.map((u) =>
            u.id === id ? { ...u, isStarred: !u.isStarred, updatedAt: Date.now() } : u
          ),
        }));
      },
      
      restoreFromTrash: (id) => {
        const state = get();
        const now = Date.now();
        
        // 尝试在 notes、urls、folders 中找到已删除的项
        const deletedNote = state.notes.find((n) => n.id === id && n.isDeleted);
        const deletedUrl = state.urls.find((u) => u.id === id && u.isDeleted);
        const deletedFolder = state.folders.find((f) => f.id === id && f.isDeleted);
        
        if (!deletedNote && !deletedUrl && !deletedFolder) {
          logger.warn('[dataStore] 尝试恢复不存在的回收站项:', id);
          return;
        }
        
        logger.log('[dataStore] 恢复回收站项:', { 
          id, 
          type: deletedNote ? 'note' : deletedUrl ? 'url' : 'folder' 
        });
        
        set((state) => {
          if (deletedNote) {
            // 恢复笔记：设置 isDeleted = false, deletedAt = null, updatedAt = now
            const updatedNotes = state.notes.map((n) =>
              n.id === id ? { ...n, isDeleted: false, deletedAt: null, updatedAt: now } : n
            );
            
            // 如果笔记有 folderId，同时恢复其所属文件夹（如果也被删除了）
            if (deletedNote.folderId) {
              const folder = state.folders.find((f) => f.id === deletedNote.folderId && f.isDeleted);
              if (folder) {
                const updatedFolders = state.folders.map((f) =>
                  f.id === deletedNote.folderId 
                    ? { ...f, isDeleted: false, deletedAt: null, updatedAt: now }
                    : f
                );
                // 同时恢复文件夹内的所有笔记和网址
                const folderNotes = state.notes.filter((n) => n.folderId === deletedNote.folderId && n.isDeleted);
                const folderUrls = state.urls.filter((u) => u.folderId === deletedNote.folderId && u.isDeleted);
                const restoredNotes = updatedNotes.map((n) =>
                  folderNotes.some((fn) => fn.id === n.id) 
                    ? { ...n, isDeleted: false, deletedAt: null, updatedAt: now }
                    : n
                );
                const restoredUrls = state.urls.map((u) =>
                  folderUrls.some((fu) => fu.id === u.id)
                    ? { ...u, isDeleted: false, deletedAt: null, updatedAt: now }
                    : u
                );
                return {
                  folders: updatedFolders,
                  notes: restoredNotes,
                  urls: restoredUrls,
                };
              }
            }
            
            return { notes: updatedNotes };
          } else if (deletedUrl) {
            // 恢复网址：设置 isDeleted = false, deletedAt = null, updatedAt = now
            const updatedUrls = state.urls.map((u) =>
              u.id === id ? { ...u, isDeleted: false, deletedAt: null, updatedAt: now } : u
            );
            
            // 如果网址有 folderId，同时恢复其所属文件夹（如果也被删除了）
            if (deletedUrl.folderId) {
              const folder = state.folders.find((f) => f.id === deletedUrl.folderId && f.isDeleted);
              if (folder) {
                const updatedFolders = state.folders.map((f) =>
                  f.id === deletedUrl.folderId 
                    ? { ...f, isDeleted: false, deletedAt: null, updatedAt: now }
                    : f
                );
                // 同时恢复文件夹内的所有笔记和网址
                const folderNotes = state.notes.filter((n) => n.folderId === deletedUrl.folderId && n.isDeleted);
                const folderUrls = state.urls.filter((u) => u.folderId === deletedUrl.folderId && u.isDeleted);
                const restoredNotes = state.notes.map((n) =>
                  folderNotes.some((fn) => fn.id === n.id) 
                    ? { ...n, isDeleted: false, deletedAt: null, updatedAt: now }
                    : n
                );
                const restoredUrls = updatedUrls.map((u) =>
                  folderUrls.some((fu) => fu.id === u.id)
                    ? { ...u, isDeleted: false, deletedAt: null, updatedAt: now }
                    : u
                );
                return {
                  folders: updatedFolders,
                  notes: restoredNotes,
                  urls: restoredUrls,
                };
              }
            }
            
            return { urls: updatedUrls };
          } else if (deletedFolder) {
            // 恢复文件夹：设置 isDeleted = false, deletedAt = null, updatedAt = now
            const updatedFolders = state.folders.map((f) =>
              f.id === id ? { ...f, isDeleted: false, deletedAt: null, updatedAt: now } : f
            );
            
            // 同时恢复文件夹内的所有笔记和网址
            const folderNotes = state.notes.filter((n) => n.folderId === id && n.isDeleted);
            const folderUrls = state.urls.filter((u) => u.folderId === id && u.isDeleted);
            const restoredNotes = state.notes.map((n) =>
              folderNotes.some((fn) => fn.id === n.id) 
                ? { ...n, isDeleted: false, deletedAt: null, updatedAt: now }
                : n
            );
            const restoredUrls = state.urls.map((u) =>
              folderUrls.some((fu) => fu.id === u.id)
                ? { ...u, isDeleted: false, deletedAt: null, updatedAt: now }
                : u
            );
            
            return {
              folders: updatedFolders,
              notes: restoredNotes,
              urls: restoredUrls,
            };
          }
          
          return {};
        });
        
        // 标记有变更，立即同步到服务器（恢复操作也需要立即同步，确保其他设备能收到）
        set({ pendingChanges: true });
        immediateSync(() => get().syncDataToServer(true));
      },
      
      permanentlyDelete: (id) => {
        const state = get();
        
        // 尝试在 notes、urls、folders 中找到已删除的项
        const deletedNote = state.notes.find((n) => n.id === id && n.isDeleted);
        const deletedUrl = state.urls.find((u) => u.id === id && u.isDeleted);
        const deletedFolder = state.folders.find((f) => f.id === id && f.isDeleted);
        
        if (!deletedNote && !deletedUrl && !deletedFolder) {
          logger.warn('[dataStore] 尝试永久删除不存在的回收站项:', id);
          return;
        }
        
        const itemType = deletedNote ? 'note' : deletedUrl ? 'url' : 'folder';
        logger.log('[dataStore] 永久删除回收站项:', { id, type: itemType });
        
        set((state) => {
          if (deletedFolder) {
            // 永久删除文件夹：从 folders 中物理移除，并添加到永久删除列表
            const newFolders = state.folders.filter((f) => f.id !== id);
            
            // 同时永久删除文件夹内的所有笔记和网址
            const newNotes = state.notes.filter((n) => n.folderId !== id || !n.isDeleted);
            const newUrls = state.urls.filter((u) => u.folderId !== id || !u.isDeleted);
            
            // 确保 permanentlyDeletedFolderIds 是 Set 类型
            let currentDeletedIds: Set<string>;
            if (state.permanentlyDeletedFolderIds instanceof Set) {
              currentDeletedIds = state.permanentlyDeletedFolderIds;
            } else if (Array.isArray(state.permanentlyDeletedFolderIds)) {
              currentDeletedIds = new Set(state.permanentlyDeletedFolderIds);
            } else {
              currentDeletedIds = new Set<string>();
            }
            
            const newPermanentlyDeletedIds = new Set(currentDeletedIds);
            newPermanentlyDeletedIds.add(id);
            
            logger.log('[dataStore] 将文件夹添加到永久删除列表:', id);
            
            return {
              folders: newFolders,
              notes: newNotes,
              urls: newUrls,
              permanentlyDeletedFolderIds: newPermanentlyDeletedIds,
            };
          } else if (deletedNote) {
            // 永久删除笔记：从 notes 中物理移除，并添加到永久删除列表
            const newNotes = state.notes.filter((n) => n.id !== id);
            
            // 确保 permanentlyDeletedNoteIds 是 Set 类型
            let currentDeletedNoteIds: Set<string>;
            if (state.permanentlyDeletedNoteIds instanceof Set) {
              currentDeletedNoteIds = state.permanentlyDeletedNoteIds;
            } else if (Array.isArray(state.permanentlyDeletedNoteIds)) {
              currentDeletedNoteIds = new Set(state.permanentlyDeletedNoteIds);
            } else {
              currentDeletedNoteIds = new Set<string>();
            }
            
            const newPermanentlyDeletedNoteIds = new Set(currentDeletedNoteIds);
            newPermanentlyDeletedNoteIds.add(id);
            
            logger.log('[dataStore] 将笔记添加到永久删除列表:', id);
            
            return { 
              notes: newNotes,
              permanentlyDeletedNoteIds: newPermanentlyDeletedNoteIds,
            };
          } else if (deletedUrl) {
            // 永久删除网址：从 urls 中物理移除，并添加到永久删除列表
            const newUrls = state.urls.filter((u) => u.id !== id);
            
            // 确保 permanentlyDeletedUrlIds 是 Set 类型
            let currentDeletedUrlIds: Set<string>;
            if (state.permanentlyDeletedUrlIds instanceof Set) {
              currentDeletedUrlIds = state.permanentlyDeletedUrlIds;
            } else if (Array.isArray(state.permanentlyDeletedUrlIds)) {
              currentDeletedUrlIds = new Set(state.permanentlyDeletedUrlIds);
            } else {
              currentDeletedUrlIds = new Set<string>();
            }
            
            const newPermanentlyDeletedUrlIds = new Set(currentDeletedUrlIds);
            newPermanentlyDeletedUrlIds.add(id);
            
            logger.log('[dataStore] 将网址添加到永久删除列表:', id);
            
            return { 
              urls: newUrls,
              permanentlyDeletedUrlIds: newPermanentlyDeletedUrlIds,
            };
          }
          
          return {};
        });
        
        // 标记有变更，立即同步到服务器（永久删除操作需要立即同步）
        set({ pendingChanges: true });
        const currentState = get();
        logger.log('[dataStore] 立即同步永久删除操作到服务器', {
          permanentlyDeletedFolderIds: currentState.permanentlyDeletedFolderIds instanceof Set 
            ? Array.from(currentState.permanentlyDeletedFolderIds) 
            : currentState.permanentlyDeletedFolderIds,
          permanentlyDeletedNoteIds: currentState.permanentlyDeletedNoteIds instanceof Set 
            ? Array.from(currentState.permanentlyDeletedNoteIds) 
            : currentState.permanentlyDeletedNoteIds,
          permanentlyDeletedUrlIds: currentState.permanentlyDeletedUrlIds instanceof Set 
            ? Array.from(currentState.permanentlyDeletedUrlIds) 
            : currentState.permanentlyDeletedUrlIds,
        });
        immediateSync(() => {
          const stateBeforeSync = get();
          logger.log('[dataStore] 执行永久删除同步，当前永久删除列表:', {
            permanentlyDeletedFolderIds: stateBeforeSync.permanentlyDeletedFolderIds instanceof Set 
              ? Array.from(stateBeforeSync.permanentlyDeletedFolderIds) 
              : stateBeforeSync.permanentlyDeletedFolderIds,
            permanentlyDeletedNoteIds: stateBeforeSync.permanentlyDeletedNoteIds instanceof Set 
              ? Array.from(stateBeforeSync.permanentlyDeletedNoteIds) 
              : stateBeforeSync.permanentlyDeletedNoteIds,
            permanentlyDeletedUrlIds: stateBeforeSync.permanentlyDeletedUrlIds instanceof Set 
              ? Array.from(stateBeforeSync.permanentlyDeletedUrlIds) 
              : stateBeforeSync.permanentlyDeletedUrlIds,
          });
          get().syncDataToServer(true);
        });
      },
      
      cleanExpiredTrash: () => {
        const now = Date.now();
        const state = get();
        
        // 找出所有已删除且超过30天的项
        const expiredNotes = state.notes.filter(
          (n) => n.isDeleted && n.deletedAt && now - n.deletedAt >= TRASH_EXPIRY_MS
        );
        const expiredUrls = state.urls.filter(
          (u) => u.isDeleted && u.deletedAt && now - u.deletedAt >= TRASH_EXPIRY_MS
        );
        const expiredFolders = state.folders.filter(
          (f) => f.isDeleted && f.deletedAt && now - f.deletedAt >= TRASH_EXPIRY_MS
        );
        
        const totalExpired = expiredNotes.length + expiredUrls.length + expiredFolders.length;
        
        if (totalExpired === 0) {
          // 没有过期项，不需要更新
          return;
        }
        
        logger.log('[dataStore] 清理过期回收站项:', {
          notes: expiredNotes.length,
          urls: expiredUrls.length,
          folders: expiredFolders.length,
          total: totalExpired,
        });
        
        set((state) => {
          // 物理删除过期的笔记
          const expiredNoteIds = new Set(expiredNotes.map((n) => n.id));
          const newNotes = state.notes.filter((n) => !expiredNoteIds.has(n.id));
          
          // 物理删除过期的网址
          const expiredUrlIds = new Set(expiredUrls.map((u) => u.id));
          const newUrls = state.urls.filter((u) => !expiredUrlIds.has(u.id));
          
          // 物理删除过期的文件夹，并添加到永久删除列表
          const expiredFolderIds = new Set(expiredFolders.map((f) => f.id));
          const newFolders = state.folders.filter((f) => !expiredFolderIds.has(f.id));
          
          // 同时删除这些文件夹内的所有笔记和网址（这些笔记和网址会随着文件夹一起被删除）
          const finalNotes = newNotes.filter((n) => 
            !n.folderId || !expiredFolderIds.has(n.folderId)
          );
          const finalUrls = newUrls.filter((u) => 
            !u.folderId || !expiredFolderIds.has(u.folderId)
          );
          
          // 更新永久删除列表
          let currentDeletedIds: Set<string>;
          if (state.permanentlyDeletedFolderIds instanceof Set) {
            currentDeletedIds = state.permanentlyDeletedFolderIds;
          } else if (Array.isArray(state.permanentlyDeletedFolderIds)) {
            currentDeletedIds = new Set(state.permanentlyDeletedFolderIds);
          } else {
            currentDeletedIds = new Set<string>();
          }
          const newPermanentlyDeletedIds = new Set([...currentDeletedIds, ...expiredFolderIds]);
          
          return {
            folders: newFolders,
            notes: finalNotes,
            urls: finalUrls,
            permanentlyDeletedFolderIds: newPermanentlyDeletedIds,
          };
        });
        
        // 标记有变更，立即同步到服务器（清理操作也需要同步）
        set({ pendingChanges: true });
        immediateSync(() => get().syncDataToServer(true));
      },
      
      getNotesByFolder: (folderId) => {
        const { notes } = get();
        // 过滤掉已删除的笔记
        const activeNotes = notes.filter((n) => !n.isDeleted);
        if (!folderId) {
          return activeNotes.filter((n) => !n.folderId);
        }
        return activeNotes.filter((n) => n.folderId === folderId);
      },
      
      getUrlsByFolder: (folderId) => {
        const { urls } = get();
        // 过滤掉已删除的网址
        const activeUrls = urls.filter((u) => !u.isDeleted);
        if (!folderId) {
          return activeUrls.filter((u) => !u.folderId);
        }
        return activeUrls.filter((u) => u.folderId === folderId);
      },
      
      getAllNotes: (excludePrivacy = true) => {
        const { notes, folders } = get();
        // 过滤掉已删除的笔记
        const activeNotes = notes.filter((n) => !n.isDeleted);
        if (!excludePrivacy) {
          return activeNotes;
        }
        const privacyFolderIds = folders
          .filter((f) => f.type === 'privacy' && !f.isDeleted)
          .map((f) => f.id);
        return activeNotes.filter((n) => !n.folderId || !privacyFolderIds.includes(n.folderId));
      },
      
      getFolderById: (id) => {
        // 只返回未删除的文件夹
        return get().folders.find((f) => f.id === id && !f.isDeleted);
      },
      
      verifyFolderPassword: (id, password) => {
        const folder = get().folders.find((f) => f.id === id);
        if (!folder || folder.type !== 'privacy' || !folder.password) {
          return false;
        }
        // 使用加密验证函数
        return verifyPrivacyPassword(password, folder.password);
      },
      
      // 数据同步方法
      pendingChanges: false,
      isUploading: false,
      isDownloading: false,
      lastSyncTime: null as number | null,
      syncError: null as string | null,
      syncSuccess: false,
      syncRetryCount: 0,
      lastRetryTime: null as number | null,
      lastSyncedSnapshot: null as { folders: Map<string, Folder>; notes: Map<string, Note>; urls: Map<string, Url>; homeContent: string } | null,
      
      /**
       * 从服务器同步数据到本地
       * 
       * @param retryCount - 重试次数（内部使用，用于限制重试）
       * @param prioritizeServer - 是否优先使用服务器数据（true时服务器数据完全覆盖本地）
       * @returns Promise<void>
       * 
       * @description
       * 此函数实现了复杂的数据同步逻辑：
       * 1. 使用同步队列确保操作串行执行，避免并发冲突
       * 2. 如果正在上传，会等待上传完成后再同步（最多重试3次）
       * 3. 支持两种模式：
       *    - prioritizeServer=true: 登录时使用，服务器数据完全覆盖本地
       *    - prioritizeServer=false: 正常同步，使用 updatedAt 时间戳合并数据
       * 4. 自动处理 token 刷新和错误重试
       */
      syncDataFromServer: async (retryCount: number = 0, prioritizeServer: boolean = true) => {
        // 使用同步队列确保操作串行执行
        return syncQueue.add(async () => {
          const MAX_RETRIES = 3;
          
          // 如果正在下载，跳过
          if (get().isDownloading) {
            logger.log('[dataStore] 正在下载数据，跳过此次同步');
            return;
          }
          
          // 如果正在上传，等待上传完成（但限制重试次数）
          if (get().isUploading) {
            if (retryCount >= MAX_RETRIES) {
              logger.warn('[dataStore] 上传等待超时，取消同步');
              return;
            }
            logger.log('[dataStore] 正在上传数据，等待完成后同步');
            // 延迟重试
            await new Promise(resolve => setTimeout(resolve, 2000));
            return get().syncDataFromServer(retryCount + 1, prioritizeServer);
          }
          
          try {
            set({ isDownloading: true });
            
            if (prioritizeServer) {
              logger.log('[dataStore] 优先使用服务器数据模式（登录时）');
            }
          
          const { currentUser, token } = useUserStore.getState();
          if (!currentUser || !token) {
            logger.warn('[dataStore] 未登录，无法同步数据');
            set({ isDownloading: false });
            return;
          }
          
          // 使用AbortController实现超时
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
          
          try {
            const res = await fetch(`${API_BASE_URL}/v1/data/sync`, {
              headers: {
                'Authorization': `Bearer ${token}`,
              },
              signal: controller.signal,
            });
            
            clearTimeout(timeoutId);
            
            if (res.ok) {
              let result;
              try {
                const text = await res.text();
                if (!text || text.trim() === '') {
                  logger.error('[dataStore] 服务器返回空响应');
                  set({ 
                    isDownloading: false,
                    syncError: '服务器返回空响应，请重试',
                  });
                  return;
                }
                result = JSON.parse(text);
              } catch (e) {
                logger.error('[dataStore] JSON解析失败:', e);
                set({ 
                  isDownloading: false,
                  syncError: '服务器响应格式错误，请重试',
                });
                return;
              }
              
              if (result.success && result.data) {
                const serverData = result.data;
                
                // 记录服务器返回的永久删除列表（用于调试）
                logger.log('[dataStore] 服务器返回的永久删除列表:', {
                  permanentlyDeletedFolderIds: {
                    type: typeof serverData.permanentlyDeletedFolderIds,
                    isArray: Array.isArray(serverData.permanentlyDeletedFolderIds),
                    value: serverData.permanentlyDeletedFolderIds,
                    length: Array.isArray(serverData.permanentlyDeletedFolderIds) ? serverData.permanentlyDeletedFolderIds.length : null,
                  },
                  permanentlyDeletedNoteIds: {
                    type: typeof serverData.permanentlyDeletedNoteIds,
                    isArray: Array.isArray(serverData.permanentlyDeletedNoteIds),
                    value: serverData.permanentlyDeletedNoteIds,
                    length: Array.isArray(serverData.permanentlyDeletedNoteIds) ? serverData.permanentlyDeletedNoteIds.length : null,
                  },
                  permanentlyDeletedUrlIds: {
                    type: typeof serverData.permanentlyDeletedUrlIds,
                    isArray: Array.isArray(serverData.permanentlyDeletedUrlIds),
                    value: serverData.permanentlyDeletedUrlIds,
                    length: Array.isArray(serverData.permanentlyDeletedUrlIds) ? serverData.permanentlyDeletedUrlIds.length : null,
                  },
                });
                
              // 验证数据格式
              if (!Array.isArray(serverData.folders) || 
                  !Array.isArray(serverData.notes) || 
                  !Array.isArray(serverData.urls)) {
                logger.error('[dataStore] 服务器数据格式不正确');
                set({ isDownloading: false });
                return;
              }
              
              // 同步首页内容（智能合并：避免覆盖用户正在输入的内容）
              if (serverData.homeContent !== undefined) {
                const { useHomeContentStore } = await import('./homeContentStore');
                const homeContentStore = useHomeContentStore.getState();
                const localHomeContent = homeContentStore.content;
                const isTyping = homeContentStore.isTyping;
                const serverHomeContent = serverData.homeContent || '';
                
                logger.log('[dataStore] 同步首页内容:', {
                  local: localHomeContent.substring(0, 50),
                  server: serverHomeContent.substring(0, 50),
                  isTyping,
                  isDifferent: serverHomeContent !== localHomeContent,
                });
                
                // 只有当服务器内容与本地内容不同时才考虑更新
                if (serverHomeContent !== localHomeContent) {
                  // 如果用户正在输入，检查是否真的在输入（移动端可能 isTyping 状态没有及时清除）
                  // 如果本地内容长时间没有变化（超过5秒），认为用户已经停止输入
                  const lastSavedTime = (homeContentStore as any).lastSavedTime || 0;
                  const timeSinceLastSave = Date.now() - lastSavedTime;
                  const isReallyTyping = isTyping && timeSinceLastSave < 5000; // 5秒内保存过，认为还在输入
                  
                  if (isReallyTyping) {
                    logger.log('[dataStore] 用户正在输入（最近5秒内有保存），跳过首页内容同步', {
                      isTyping,
                      timeSinceLastSave,
                    });
                  }
                  // 如果本地内容为空，使用服务器内容
                  else if (localHomeContent === '') {
                    logger.log('[dataStore] 本地内容为空，使用服务器内容');
                    // 使用 setContentWithoutSync 避免循环调用
                    useHomeContentStore.getState().setContentWithoutSync(serverHomeContent);
                  }
                  // 如果服务器内容不为空且与本地不同，可能是其他设备更新的，使用服务器内容
                  else if (serverHomeContent !== '') {
                    logger.log('[dataStore] 服务器内容更新，使用服务器内容');
                    // 使用 setContentWithoutSync 避免循环调用
                    useHomeContentStore.getState().setContentWithoutSync(serverHomeContent);
                  }
                } else {
                  logger.log('[dataStore] 首页内容相同，无需同步');
                }
              } else {
                logger.warn('[dataStore] 服务器未返回 homeContent');
              }
              
              // 合并服务器数据和本地数据
              // 强制要求：一切数据以服务器为准
              const localData = get();
              
              // 记录同步前的数据统计（用于调试）
              const localFoldersCount = localData.folders.length;
              const localNotesCount = localData.notes.length;
              const localUrlsCount = localData.urls.length;
              const serverFoldersCount = (serverData.folders || []).length;
              const serverNotesCount = (serverData.notes || []).length;
              const serverUrlsCount = (serverData.urls || []).length;
              
              logger.log('[dataStore] 同步前数据统计:', {
                local: { folders: localFoldersCount, notes: localNotesCount, urls: localUrlsCount },
                server: { folders: serverFoldersCount, notes: serverNotesCount, urls: serverUrlsCount },
              });
              
              // 基于 isDeleted 字段获取本地已删除的文件夹ID列表
              const localDeletedFolderIds = new Set<string>(
                localData.folders
                  .filter((f: Folder) => f.isDeleted)
                  .map((f: Folder) => f.id)
              );
              
              // 基于 isDeleted 字段获取服务器已删除的文件夹ID列表
              const serverDeletedFolderIds = new Set<string>(
                (serverData.folders || [])
                  .filter((f: Folder) => f.isDeleted)
                  .map((f: Folder) => f.id)
              );
              
              // 关键修复：合并所有已删除的文件夹ID（本地和服务器），并包含永久删除的文件夹ID
              // 永久删除的文件夹ID永远不会被恢复
              // 确保 permanentlyDeletedFolderIds 是 Set 类型
              let permanentlyDeletedIds: Set<string>;
              if (localData.permanentlyDeletedFolderIds instanceof Set) {
                permanentlyDeletedIds = localData.permanentlyDeletedFolderIds;
              } else if (Array.isArray(localData.permanentlyDeletedFolderIds)) {
                permanentlyDeletedIds = new Set(localData.permanentlyDeletedFolderIds);
              } else {
                permanentlyDeletedIds = new Set<string>();
              }
              
              // 合并服务器的永久删除列表（重要：服务器返回的永久删除列表是权威的）
              // 修复：即使服务器返回 null 或 undefined，也要正确处理（转换为空数组）
              const serverPermanentlyDeletedFolderIds = Array.isArray(serverData.permanentlyDeletedFolderIds) 
                ? serverData.permanentlyDeletedFolderIds 
                : (serverData.permanentlyDeletedFolderIds === null || serverData.permanentlyDeletedFolderIds === undefined ? [] : []);
              
              if (serverPermanentlyDeletedFolderIds.length > 0) {
                const beforeMerge = permanentlyDeletedIds.size;
                serverPermanentlyDeletedFolderIds.forEach((id: string) => {
                  if (id && typeof id === 'string') {
                    permanentlyDeletedIds.add(id);
                  }
                });
                logger.log('[dataStore] 合并服务器的永久删除文件夹列表:', {
                  serverCount: serverPermanentlyDeletedFolderIds.length,
                  beforeMerge,
                  afterMerge: permanentlyDeletedIds.size,
                  added: permanentlyDeletedIds.size - beforeMerge,
                  serverIds: serverPermanentlyDeletedFolderIds,
                });
              } else if (serverData.permanentlyDeletedFolderIds === null || serverData.permanentlyDeletedFolderIds === undefined) {
                logger.warn('[dataStore] 服务器返回的永久删除文件夹列表为 null 或 undefined，使用空数组');
              }
              
              // 合并所有已删除的文件夹ID（包括永久删除的）
              const allDeletedFolderIds = new Set<string>([
                ...localDeletedFolderIds,
                ...serverDeletedFolderIds,
                ...Array.from(permanentlyDeletedIds), // 永久删除的文件夹ID
              ]);
                
                // 如果服务器返回的folders中包含永久删除的文件夹，记录警告
                const restoredPermanentlyDeleted = (serverData.folders || []).filter(
                  (folder: Folder) => permanentlyDeletedIds.has(folder.id)
                );
                if (restoredPermanentlyDeleted.length > 0) {
                  logger.error('[dataStore] 警告：服务器返回了已永久删除的文件夹，将被移除:', {
                    count: restoredPermanentlyDeleted.length,
                    ids: restoredPermanentlyDeleted.map((f: Folder) => f.id),
                  });
                }
                
                // 关键修复：不要预先过滤已删除的文件夹，让 mergeItem 根据 updatedAt 和删除状态来判断
                // 这样可以确保：
                // 1. 如果本地已删除（isDeleted=true, updatedAt=删除时间），即使服务器返回未删除的版本，也保留本地删除状态
                // 2. 如果服务器已删除（isDeleted=true, updatedAt=删除时间），且时间更新，使用服务器删除状态
                // 3. 永久删除的文件夹永远不会被恢复（在 mergeArrays 中过滤）
                
                // 调试日志：检查已删除的文件夹
                if (allDeletedFolderIds.size > 0) {
                  const localDeletedCount = localDeletedFolderIds.size;
                  const serverDeletedCount = serverDeletedFolderIds.size;
                  logger.log('[dataStore] 同步时检测到已删除的文件夹:', {
                    localDeleted: localDeletedCount,
                    serverDeleted: serverDeletedCount,
                    permanentlyDeleted: permanentlyDeletedIds.size,
                    allDeleted: allDeletedFolderIds.size,
                  });
                }
                
                // 强制要求：同步唯一判断标准是 updatedAt
                // 合并策略：严格按照 updatedAt 判断，但已删除的项有特殊处理
                // 注意：这里不预先过滤 isDeleted，让 mergeArrays 和 mergeItem 根据 updatedAt 和删除状态来判断
                // mergeItem 已经修复，会优先保留已删除的状态（如果 updatedAt 是删除时间）
                const mergedFolders = mergeArrays(
                  localData.folders, // 包含所有文件夹（包括已删除的），让 mergeItem 判断
                  serverData.folders || [], // 包含所有文件夹（包括已删除的），让 mergeItem 判断
                  permanentlyDeletedIds, // 只传入永久删除的文件夹ID集合，在合并时过滤
                  true // 强制优先使用服务器数据
                );
                
                // 同步后，过滤掉已删除的文件夹（只保留活跃的文件夹用于显示）
                // 但已删除的文件夹仍然保存在 store 中，只是不显示
                const activeFolders = mergedFolders.filter((f) => !f.isDeleted);
                logger.log('[dataStore] 合并后的文件夹:', {
                  total: mergedFolders.length,
                  active: activeFolders.length,
                  deleted: mergedFolders.filter((f) => f.isDeleted).length,
                });
                
                // 获取永久删除的笔记和网址ID列表
                let permanentlyDeletedNoteIds: Set<string>;
                if (localData.permanentlyDeletedNoteIds instanceof Set) {
                  permanentlyDeletedNoteIds = localData.permanentlyDeletedNoteIds;
                } else if (Array.isArray(localData.permanentlyDeletedNoteIds)) {
                  permanentlyDeletedNoteIds = new Set(localData.permanentlyDeletedNoteIds);
                } else {
                  permanentlyDeletedNoteIds = new Set<string>();
                }
                
                // 合并服务器的永久删除笔记列表（重要：服务器返回的永久删除列表是权威的）
                // 修复：即使服务器返回 null 或 undefined，也要正确处理（转换为空数组）
                const serverPermanentlyDeletedNoteIds = Array.isArray(serverData.permanentlyDeletedNoteIds) 
                  ? serverData.permanentlyDeletedNoteIds 
                  : (serverData.permanentlyDeletedNoteIds === null || serverData.permanentlyDeletedNoteIds === undefined ? [] : []);
                
                if (serverPermanentlyDeletedNoteIds.length > 0) {
                  const beforeMerge = permanentlyDeletedNoteIds.size;
                  serverPermanentlyDeletedNoteIds.forEach((id: string) => {
                    if (id && typeof id === 'string') {
                      permanentlyDeletedNoteIds.add(id);
                    }
                  });
                  logger.log('[dataStore] 合并服务器的永久删除笔记列表:', {
                    serverCount: serverPermanentlyDeletedNoteIds.length,
                    beforeMerge,
                    afterMerge: permanentlyDeletedNoteIds.size,
                    added: permanentlyDeletedNoteIds.size - beforeMerge,
                    serverIds: serverPermanentlyDeletedNoteIds,
                  });
                } else if (serverData.permanentlyDeletedNoteIds === null || serverData.permanentlyDeletedNoteIds === undefined) {
                  logger.warn('[dataStore] 服务器返回的永久删除笔记列表为 null 或 undefined，使用空数组');
                }
                
                let permanentlyDeletedUrlIds: Set<string>;
                if (localData.permanentlyDeletedUrlIds instanceof Set) {
                  permanentlyDeletedUrlIds = localData.permanentlyDeletedUrlIds;
                } else if (Array.isArray(localData.permanentlyDeletedUrlIds)) {
                  permanentlyDeletedUrlIds = new Set(localData.permanentlyDeletedUrlIds);
                } else {
                  permanentlyDeletedUrlIds = new Set<string>();
                }
                
                // 合并服务器的永久删除网址列表（重要：服务器返回的永久删除列表是权威的）
                // 修复：即使服务器返回 null 或 undefined，也要正确处理（转换为空数组）
                const serverPermanentlyDeletedUrlIds = Array.isArray(serverData.permanentlyDeletedUrlIds) 
                  ? serverData.permanentlyDeletedUrlIds 
                  : (serverData.permanentlyDeletedUrlIds === null || serverData.permanentlyDeletedUrlIds === undefined ? [] : []);
                
                if (serverPermanentlyDeletedUrlIds.length > 0) {
                  const beforeMerge = permanentlyDeletedUrlIds.size;
                  serverPermanentlyDeletedUrlIds.forEach((id: string) => {
                    if (id && typeof id === 'string') {
                      permanentlyDeletedUrlIds.add(id);
                    }
                  });
                  logger.log('[dataStore] 合并服务器的永久删除网址列表:', {
                    serverCount: serverPermanentlyDeletedUrlIds.length,
                    beforeMerge,
                    afterMerge: permanentlyDeletedUrlIds.size,
                    added: permanentlyDeletedUrlIds.size - beforeMerge,
                    serverIds: serverPermanentlyDeletedUrlIds,
                  });
                } else if (serverData.permanentlyDeletedUrlIds === null || serverData.permanentlyDeletedUrlIds === undefined) {
                  logger.warn('[dataStore] 服务器返回的永久删除网址列表为 null 或 undefined，使用空数组');
                }
                
                // 重要修复：在合并之前，先从服务器数据和本地数据中过滤掉永久删除的项
                // 这样可以防止永久删除的项在后续同步中被恢复
                const serverNotesBeforeFilter = (serverData.notes || []).length;
                const localNotesBeforeFilter = localData.notes.length;
                const serverUrlsBeforeFilter = (serverData.urls || []).length;
                const localUrlsBeforeFilter = localData.urls.length;
                
                const serverNotesFiltered = (serverData.notes || []).filter(
                  (note: Note) => !permanentlyDeletedNoteIds.has(note.id)
                );
                const localNotesFiltered = localData.notes.filter(
                  (note: Note) => !permanentlyDeletedNoteIds.has(note.id)
                );
                const serverUrlsFiltered = (serverData.urls || []).filter(
                  (url: Url) => !permanentlyDeletedUrlIds.has(url.id)
                );
                const localUrlsFiltered = localData.urls.filter(
                  (url: Url) => !permanentlyDeletedUrlIds.has(url.id)
                );
                
                // 记录过滤结果（用于调试）
                const serverNotesFilteredCount = serverNotesBeforeFilter - serverNotesFiltered.length;
                const localNotesFilteredCount = localNotesBeforeFilter - localNotesFiltered.length;
                const serverUrlsFilteredCount = serverUrlsBeforeFilter - serverUrlsFiltered.length;
                const localUrlsFilteredCount = localUrlsBeforeFilter - localUrlsFiltered.length;
                
                if (serverNotesFilteredCount > 0 || localNotesFilteredCount > 0 || serverUrlsFilteredCount > 0 || localUrlsFilteredCount > 0 || permanentlyDeletedNoteIds.size > 0 || permanentlyDeletedUrlIds.size > 0) {
                  logger.log('[dataStore] 合并前过滤永久删除的项:', {
                    notes: { server: { before: serverNotesBeforeFilter, after: serverNotesFiltered.length, filtered: serverNotesFilteredCount }, local: { before: localNotesBeforeFilter, after: localNotesFiltered.length, filtered: localNotesFilteredCount } },
                    urls: { server: { before: serverUrlsBeforeFilter, after: serverUrlsFiltered.length, filtered: serverUrlsFilteredCount }, local: { before: localUrlsBeforeFilter, after: localUrlsFiltered.length, filtered: localUrlsFilteredCount } },
                    permanentlyDeletedNoteIds: { size: permanentlyDeletedNoteIds.size, list: Array.from(permanentlyDeletedNoteIds).slice(0, 10) },
                    permanentlyDeletedUrlIds: { size: permanentlyDeletedUrlIds.size, list: Array.from(permanentlyDeletedUrlIds).slice(0, 10) },
                  });
                }
                
                // 合并笔记和网址（一切以服务器为准），但排除永久删除的项
                const mergedNotes = mergeArrays(
                  localNotesFiltered, 
                  serverNotesFiltered, 
                  permanentlyDeletedNoteIds, // 传入永久删除的笔记ID集合（双重保险）
                  true
                );
                const mergedUrls = mergeArrays(
                  localUrlsFiltered, 
                  serverUrlsFiltered, 
                  permanentlyDeletedUrlIds, // 传入永久删除的网址ID集合（双重保险）
                  true
                );
                
                // 检查是否有重复的 id（确保 id 唯一性）
                const folderIds = new Set<string>();
                const duplicateFolderIds = new Set<string>();
                mergedFolders.forEach((folder) => {
                  if (folderIds.has(folder.id)) {
                    duplicateFolderIds.add(folder.id);
                  } else {
                    folderIds.add(folder.id);
                  }
                });
                
                if (duplicateFolderIds.size > 0) {
                  logger.error('[dataStore] 检测到重复的文件夹ID:', Array.from(duplicateFolderIds));
                  // 去重：使用 mergeItem 逻辑，确保已删除的文件夹不会被未删除的版本覆盖
                  const folderMap = new Map<string, Folder>();
                  mergedFolders.forEach((folder) => {
                    const existing = folderMap.get(folder.id);
                    if (!existing) {
                      folderMap.set(folder.id, folder);
                    } else {
                      // 使用 mergeItem 逻辑去重，确保一切以服务器为准
                      const merged = mergeItem(existing, folder, true); // 强制优先使用服务器数据
                      folderMap.set(folder.id, merged);
                    }
                  });
                  const deduplicatedFolders = Array.from(folderMap.values());
                  logger.warn('[dataStore] 已去重文件夹，使用 mergeItem 逻辑:', {
                    before: mergedFolders.length,
                    after: deduplicatedFolders.length,
                    duplicateIds: Array.from(duplicateFolderIds),
                  });
                  // 使用去重后的数据
                  mergedFolders.length = 0;
                  mergedFolders.push(...deduplicatedFolders);
                }
                
                // 保留 trash 数组（向后兼容），但不再使用它进行同步
                // 实际的数据同步基于 isDeleted 字段
                
                // 重要：这里不应该过滤已删除的文件夹！
                // 已删除的文件夹需要保留在数据中，以便：
                // 1. 回收站可以显示（isDeleted = true）
                // 2. 多设备同步可以正常工作
                // 3. 列表查询时会自动过滤（isDeleted = false）
                // 只过滤永久删除的文件夹
                const finalMergedFolders = mergedFolders.filter(
                  (folder: Folder) => !permanentlyDeletedIds.has(folder.id)
                );
                
                // 检查：合并后的folders中已删除的文件夹（这是正常的，用于回收站显示）
                const deletedFoldersInMerged = finalMergedFolders.filter(
                  (folder: Folder) => folder.isDeleted
                );
                if (deletedFoldersInMerged.length > 0) {
                  logger.log('[dataStore] 合并后的folders中包含已删除的文件夹（正常，用于回收站）:', {
                    count: deletedFoldersInMerged.length,
                    ids: deletedFoldersInMerged.map((f: Folder) => f.id),
                  });
                }
                
                // 如果最终过滤掉了文件夹，记录日志
                if (finalMergedFolders.length !== mergedFolders.length) {
                  logger.warn('[dataStore] 最终安全检查：移除了已删除的文件夹', {
                    before: mergedFolders.length,
                    after: finalMergedFolders.length,
                    removed: mergedFolders.length - finalMergedFolders.length,
                  });
                }
                
                // 检查是否有已删除的项（用于调试）
                const localDeletedCount = localData.folders.filter((f: Folder) => f.isDeleted).length +
                                         localData.notes.filter((n: Note) => n.isDeleted).length +
                                         localData.urls.filter((u: Url) => u.isDeleted).length;
                const serverDeletedCount = (serverData.folders || []).filter((f: Folder) => f.isDeleted).length +
                                          (serverData.notes || []).filter((n: Note) => n.isDeleted).length +
                                          (serverData.urls || []).filter((u: Url) => u.isDeleted).length;
                if (localDeletedCount > 0 || serverDeletedCount > 0) {
                  logger.log('[dataStore] 检测到已删除的项:', {
                    local: { folders: localData.folders.filter((f: Folder) => f.isDeleted).length,
                             notes: localData.notes.filter((n: Note) => n.isDeleted).length,
                             urls: localData.urls.filter((u: Url) => u.isDeleted).length },
                    server: { folders: (serverData.folders || []).filter((f: Folder) => f.isDeleted).length,
                              notes: (serverData.notes || []).filter((n: Note) => n.isDeleted).length,
                              urls: (serverData.urls || []).filter((u: Url) => u.isDeleted).length },
                  });
                }
                
                // 最终验证：确保合并后的 folders 中不包含任何永久删除的文件夹
                // 这是最后的防线，防止任何边缘情况
                // 基于永久删除列表进行最终过滤
                
                // 重要：同步时必须保留所有数据（包括已删除的），以便：
                // 1. 回收站可以显示（isDeleted = true）
                // 2. 多设备同步可以正常工作
                // 3. 列表查询时会自动过滤（isDeleted = false）
                // 只过滤永久删除的文件夹（双重保险，确保永久删除的文件夹不会被恢复）
                const finalVerifiedFolders = finalMergedFolders.filter(
                  (folder: Folder) => {
                    const isPermanentlyDeleted = permanentlyDeletedIds.has(folder.id);
                    if (isPermanentlyDeleted) {
                      logger.warn('[dataStore] 检测到永久删除的文件夹被恢复，强制移除:', folder.id);
                    }
                    return !isPermanentlyDeleted;
                  }
                );
                
                // 检查是否有永久删除的文件夹被恢复
                const restoredPermanentlyDeletedFinal = finalMergedFolders.filter(
                  (folder: Folder) => permanentlyDeletedIds.has(folder.id)
                );
                if (restoredPermanentlyDeletedFinal.length > 0) {
                  logger.error('[dataStore] 严重错误：永久删除的文件夹被恢复了，强制移除:', {
                    count: restoredPermanentlyDeletedFinal.length,
                    ids: restoredPermanentlyDeletedFinal.map((f: Folder) => f.id),
                  });
                }
                
                // 统计已删除的项（用于调试）
                const deletedFoldersCount = finalVerifiedFolders.filter((f: Folder) => f.isDeleted).length;
                const deletedNotesCount = mergedNotes.filter((n: Note) => n.isDeleted).length;
                const deletedUrlsCount = mergedUrls.filter((u: Url) => u.isDeleted).length;
                
                // 关键修复：在保存前，检查是否有本地已删除的文件夹被恢复
                // 如果有，强制重新标记为已删除
                // 修复：只检查 isDeleted，不要求 deletedAt（因为服务器可能返回 deletedAt: null）
                const localDeletedBeforeSync = new Set<string>(
                  localData.folders
                    .filter((f: Folder) => f.isDeleted === true)
                    .map((f: Folder) => f.id)
                );
                
                // 检查合并后的文件夹，如果有本地已删除的文件夹变成了未删除，强制恢复删除状态
                const restoredFolders: Folder[] = [];
                finalVerifiedFolders.forEach((folder: Folder) => {
                  if (localDeletedBeforeSync.has(folder.id) && !folder.isDeleted) {
                    // 本地已删除，但合并后变成了未删除，强制恢复删除状态
                    const originalDeleted = localData.folders.find((f: Folder) => f.id === folder.id);
                    if (originalDeleted && originalDeleted.isDeleted === true) {
                      restoredFolders.push({
                        ...folder,
                        isDeleted: true,
                        deletedAt: originalDeleted.deletedAt || originalDeleted.updatedAt || Date.now(),
                        updatedAt: originalDeleted.updatedAt || originalDeleted.deletedAt || Date.now(),
                      });
                      logger.error('[dataStore] 检测到已删除的文件夹被恢复，强制重新标记为已删除:', {
                        id: folder.id,
                        name: folder.name,
                        originalDeletedAt: originalDeleted.deletedAt,
                      });
                    }
                  }
                });
                
                // 检查合并后的笔记，如果有本地已删除的笔记变成了未删除，强制恢复删除状态
                // 修复：只检查 isDeleted，不要求 deletedAt
                const localDeletedNotesBeforeSync = new Set<string>(
                  localData.notes
                    .filter((n: Note) => n.isDeleted === true)
                    .map((n: Note) => n.id)
                );
                const restoredNotes: Note[] = [];
                mergedNotes.forEach((note: Note) => {
                  if (localDeletedNotesBeforeSync.has(note.id) && !note.isDeleted) {
                    // 本地已删除，但合并后变成了未删除，强制恢复删除状态
                    const originalDeleted = localData.notes.find((n: Note) => n.id === note.id);
                    if (originalDeleted && originalDeleted.isDeleted === true) {
                      restoredNotes.push({
                        ...note,
                        isDeleted: true,
                        deletedAt: originalDeleted.deletedAt || originalDeleted.updatedAt || Date.now(),
                        updatedAt: originalDeleted.updatedAt || originalDeleted.deletedAt || Date.now(),
                      });
                      logger.error('[dataStore] 检测到已删除的笔记被恢复，强制重新标记为已删除:', {
                        id: note.id,
                        originalDeletedAt: originalDeleted.deletedAt,
                      });
                    }
                  }
                });
                
                // 检查合并后的网址，如果有本地已删除的网址变成了未删除，强制恢复删除状态
                // 修复：只检查 isDeleted，不要求 deletedAt
                const localDeletedUrlsBeforeSync = new Set<string>(
                  localData.urls
                    .filter((u: Url) => u.isDeleted === true)
                    .map((u: Url) => u.id)
                );
                const restoredUrls: Url[] = [];
                mergedUrls.forEach((url: Url) => {
                  if (localDeletedUrlsBeforeSync.has(url.id) && !url.isDeleted) {
                    // 本地已删除，但合并后变成了未删除，强制恢复删除状态
                    const originalDeleted = localData.urls.find((u: Url) => u.id === url.id);
                    if (originalDeleted && originalDeleted.isDeleted === true) {
                      restoredUrls.push({
                        ...url,
                        isDeleted: true,
                        deletedAt: originalDeleted.deletedAt || originalDeleted.updatedAt || Date.now(),
                        updatedAt: originalDeleted.updatedAt || originalDeleted.deletedAt || Date.now(),
                      });
                      logger.error('[dataStore] 检测到已删除的网址被恢复，强制重新标记为已删除:', {
                        id: url.id,
                        originalDeletedAt: originalDeleted.deletedAt,
                      });
                    }
                  }
                });
                
                // 如果有被恢复的文件夹，替换它们
                const finalFolders = finalVerifiedFolders.map((folder: Folder) => {
                  const restored = restoredFolders.find((r: Folder) => r.id === folder.id);
                  return restored || folder;
                });
                
                // 强制要求：同步逻辑（保留所有数据）
                // 重要：mergeArrays 已经过滤掉了永久删除的项，但为了安全起见，再次过滤一次
                // 确保即使 mergeArrays 有遗漏，也不会恢复永久删除的项
                const finalNotesFiltered = mergedNotes.filter((note: Note) => !permanentlyDeletedNoteIds.has(note.id));
                const finalUrlsFiltered = mergedUrls.filter((url: Url) => !permanentlyDeletedUrlIds.has(url.id));
                
                // 记录被永久删除的项（用于日志）
                const permanentlyDeletedNotesCount = mergedNotes.length - finalNotesFiltered.length;
                const permanentlyDeletedUrlsCount = mergedUrls.length - finalUrlsFiltered.length;
                
                // 即使过滤数量为0，也输出日志（用于调试永久删除列表）
                logger.log('[dataStore] 从本地移除服务器已永久删除的项:', {
                  notes: { filtered: permanentlyDeletedNotesCount, before: mergedNotes.length, after: finalNotesFiltered.length },
                  urls: { filtered: permanentlyDeletedUrlsCount, before: mergedUrls.length, after: finalUrlsFiltered.length },
                  permanentlyDeletedNoteIds: { size: permanentlyDeletedNoteIds.size, list: Array.from(permanentlyDeletedNoteIds).slice(0, 10) },
                  permanentlyDeletedUrlIds: { size: permanentlyDeletedUrlIds.size, list: Array.from(permanentlyDeletedUrlIds).slice(0, 10) },
                  serverPermanentlyDeletedNoteIds: serverData.permanentlyDeletedNoteIds ? { count: serverData.permanentlyDeletedNoteIds.length, list: Array.isArray(serverData.permanentlyDeletedNoteIds) ? serverData.permanentlyDeletedNoteIds.slice(0, 10) : [] } : null,
                });
                
                // 如果有被恢复的笔记和网址，替换它们
                const finalNotes = mergedNotes.map((note: Note) => {
                  const restored = restoredNotes.find((r: Note) => r.id === note.id);
                  return restored || note;
                });
                const finalUrls = mergedUrls.map((url: Url) => {
                  const restored = restoredUrls.find((r: Url) => r.id === url.id);
                  return restored || url;
                });
                
                // 使用 deduplicateById 确保 id 唯一性
                const finalFoldersDedup = deduplicateById(finalFolders);
                const finalNotesDedup = deduplicateById(finalNotes.filter((note: Note) => !permanentlyDeletedNoteIds.has(note.id)));
                const finalUrlsDedup = deduplicateById(finalUrls.filter((url: Url) => !permanentlyDeletedUrlIds.has(url.id)));
                
                // 更新同步快照（用于增量同步）
                const newSnapshot = {
                  folders: new Map<string, Folder>(finalFoldersDedup.map(f => [f.id, f])),
                  notes: new Map<string, Note>(finalNotesDedup.map(n => [n.id, n])),
                  urls: new Map<string, Url>(finalUrlsDedup.map(u => [u.id, u])),
                  homeContent: serverData.homeContent || '',
                };
                
                set({
                  folders: finalFoldersDedup, // 包含已删除的文件夹（isDeleted = true），列表查询时会过滤
                  notes: finalNotesDedup, // 包含已删除的笔记（isDeleted = true），列表查询时会过滤
                  urls: finalUrlsDedup, // 包含已删除的网址（isDeleted = true），列表查询时会过滤
                  trash: [], // 保留 trash 数组（向后兼容），但不再使用
                  permanentlyDeletedFolderIds: permanentlyDeletedIds, // 更新永久删除的文件夹列表（使用合并后的列表）
                  permanentlyDeletedNoteIds: permanentlyDeletedNoteIds, // 更新永久删除的笔记列表（使用合并后的列表）
                  permanentlyDeletedUrlIds: permanentlyDeletedUrlIds, // 更新永久删除的网址列表（使用合并后的列表）
                  lastSyncTime: serverData.lastSyncAt || Date.now(),
                  isDownloading: false,
                  syncError: null,
                  syncSuccess: true,
                  syncRetryCount: 0, // 重置重试计数
                  lastRetryTime: null,
                  lastSyncedSnapshot: newSnapshot, // 更新同步快照
                });
                
                if (restoredFolders.length > 0 || restoredNotes.length > 0 || restoredUrls.length > 0) {
                  logger.warn('[dataStore] 已强制恢复删除状态:', {
                    folders: restoredFolders.length,
                    notes: restoredNotes.length,
                    urls: restoredUrls.length,
                  });
                }
                
                // 记录同步后的数据统计（用于调试）
                const finalFoldersCount = finalVerifiedFolders.length;
                const finalNotesCount = mergedNotes.length;
                const finalUrlsCount = mergedUrls.length;
                
                // 详细检查：服务器返回的数据中 isDeleted 字段的状态
                const serverDeletedFolders = (serverData.folders || []).filter((f: Folder) => f.isDeleted === true);
                const serverDeletedNotes = (serverData.notes || []).filter((n: Note) => n.isDeleted === true);
                const serverDeletedUrls = (serverData.urls || []).filter((u: Url) => u.isDeleted === true);
                
                logger.log('[dataStore] 🔍 服务器返回的数据统计:', {
                  server: {
                    folders: { total: (serverData.folders || []).length, deleted: serverDeletedFolders.length },
                    notes: { total: (serverData.notes || []).length, deleted: serverDeletedNotes.length },
                    urls: { total: (serverData.urls || []).length, deleted: serverDeletedUrls.length },
                  },
                  sampleDeletedFolders: serverDeletedFolders.slice(0, 3).map((f: Folder) => ({
                    id: f.id,
                    name: f.name,
                    isDeleted: f.isDeleted,
                    deletedAt: f.deletedAt,
                  })),
                  sampleDeletedNotes: serverDeletedNotes.slice(0, 3).map((n: Note) => ({
                    id: n.id,
                    isDeleted: n.isDeleted,
                    deletedAt: n.deletedAt,
                  })),
                });
                
                logger.log('[dataStore] 从服务器同步完成（包含已删除的项）:', {
                  folders: { total: finalFoldersCount, deleted: deletedFoldersCount, active: finalFoldersCount - deletedFoldersCount },
                  notes: { total: finalNotesCount, deleted: deletedNotesCount, active: finalNotesCount - deletedNotesCount },
                  urls: { total: finalUrlsCount, deleted: deletedUrlsCount, active: finalUrlsCount - deletedUrlsCount },
                });
                
                // 如果服务器有已删除的项目，但合并后没有，输出警告
                if (serverDeletedFolders.length > 0 && deletedFoldersCount === 0) {
                  logger.error('[dataStore] ⚠️ 警告：服务器返回了已删除的文件夹，但合并后没有找到！', {
                    serverDeletedCount: serverDeletedFolders.length,
                    mergedDeletedCount: deletedFoldersCount,
                    sampleServerDeleted: serverDeletedFolders.slice(0, 5),
                  });
                }
                if (serverDeletedNotes.length > 0 && deletedNotesCount === 0) {
                  logger.error('[dataStore] ⚠️ 警告：服务器返回了已删除的笔记，但合并后没有找到！', {
                    serverDeletedCount: serverDeletedNotes.length,
                    mergedDeletedCount: deletedNotesCount,
                    sampleServerDeleted: serverDeletedNotes.slice(0, 5),
                  });
                }
                
                logger.log('[dataStore] 同步前后对比:', {
                  before: { folders: localFoldersCount, notes: localNotesCount, urls: localUrlsCount },
                  after: { folders: finalFoldersCount, notes: finalNotesCount, urls: finalUrlsCount },
                  server: { folders: serverFoldersCount, notes: serverNotesCount, urls: serverUrlsCount },
                });
                
                // 如果数据不一致，记录警告
                if (finalFoldersCount !== serverFoldersCount || 
                    finalNotesCount !== serverNotesCount || 
                    finalUrlsCount !== serverUrlsCount) {
                  logger.warn('[dataStore] ⚠️ 同步后数据数量与服务器不一致:', {
                    folders: { local: finalFoldersCount, server: serverFoldersCount },
                    notes: { local: finalNotesCount, server: serverNotesCount },
                    urls: { local: finalUrlsCount, server: serverUrlsCount },
                  });
                }
                
                // 3秒后清除成功状态
                setTimeout(() => {
                  set({ syncSuccess: false });
                }, 3000);
              } else {
                set({ isDownloading: false });
              }
            } else if (res.status === 401 || res.status === 403) {
              // Token过期，尝试刷新Token
              const refreshResult = await useUserStore.getState().refreshAccessToken();
              if (refreshResult.ok) {
                // 刷新成功，重试同步（一切以服务器为准）
                logger.log('[dataStore] Token已刷新，重试同步');
                return get().syncDataFromServer(0, true); // 强制优先使用服务器数据
              } else {
                // 刷新失败，清除登录状态
                logger.warn('[dataStore] Token无效且刷新失败，清除登录状态');
                set({ 
                  isDownloading: false,
                  syncError: '登录已过期，请重新登录',
                  syncSuccess: false,
                });
                useUserStore.getState().logout();
              }
            } else {
              let errorMessage = '同步失败';
              try {
                const errorData = await res.json();
                errorMessage = errorData.message || errorMessage;
              } catch (e) {
                // 忽略JSON解析错误
              }
              set({ 
                isDownloading: false,
                syncError: errorMessage,
                syncSuccess: false,
              });
            }
          } catch (fetchError: unknown) {
            clearTimeout(timeoutId);
            let errorMessage = '网络错误，请检查网络连接';
            if (fetchError instanceof Error && fetchError.name === 'AbortError') {
              errorMessage = '请求超时，请检查网络连接';
              logger.error('[dataStore] 请求超时');
            } else {
              throw fetchError;
            }
            set({ 
              isDownloading: false,
              syncError: errorMessage,
              syncSuccess: false,
            });
          }
        } catch (e) {
          logger.error('[dataStore] 同步数据失败:', e);
          const errorMessage = e instanceof Error ? e.message : '同步失败，请稍后重试';
          set({ 
            isDownloading: false,
            syncError: errorMessage,
            syncSuccess: false,
          });
        }
        });
      },
      
      syncDataToServer: async (isDeleteOperation: boolean = false) => {
        logger.log('[dataStore] syncDataToServer 被调用', { isDeleteOperation, pendingChanges: get().pendingChanges });
        // 使用同步队列确保操作串行执行
        return syncQueue.add(async () => {
          logger.log('[dataStore] syncQueue 开始执行同步', { isDeleteOperation, pendingChanges: get().pendingChanges });
          
          // 检查是否有实际变化（增量同步检测）
          const state = get();
          let snapshot = state.lastSyncedSnapshot;
          
          // 修复：如果快照是从 localStorage 恢复的，Map 可能被序列化为普通对象
          // 需要确保快照中的 Map 是正确的类型
          if (snapshot) {
            // 检查并修复快照中的 Map（如果被序列化为普通对象）
            if (!(snapshot.folders instanceof Map)) {
              logger.warn('[dataStore] 快照中的 folders 不是 Map，正在修复...');
              snapshot = {
                folders: new Map<string, Folder>(Object.entries(snapshot.folders as any).map(([id, f]: [string, any]) => [id, f])),
                notes: snapshot.notes instanceof Map ? snapshot.notes : new Map<string, Note>(Object.entries(snapshot.notes as any).map(([id, n]: [string, any]) => [id, n])),
                urls: snapshot.urls instanceof Map ? snapshot.urls : new Map<string, Url>(Object.entries(snapshot.urls as any).map(([id, u]: [string, any]) => [id, u])),
                homeContent: snapshot.homeContent || '',
              };
            }
            if (!(snapshot.notes instanceof Map)) {
              logger.warn('[dataStore] 快照中的 notes 不是 Map，正在修复...');
              snapshot = {
                folders: snapshot.folders instanceof Map ? snapshot.folders : new Map<string, Folder>(Object.entries(snapshot.folders as any).map(([id, f]: [string, any]) => [id, f])),
                notes: new Map<string, Note>(Object.entries(snapshot.notes as any).map(([id, n]: [string, any]) => [id, n])),
                urls: snapshot.urls instanceof Map ? snapshot.urls : new Map<string, Url>(Object.entries(snapshot.urls as any).map(([id, u]: [string, any]) => [id, u])),
                homeContent: snapshot.homeContent || '',
              };
            }
            if (!(snapshot.urls instanceof Map)) {
              logger.warn('[dataStore] 快照中的 urls 不是 Map，正在修复...');
              snapshot = {
                folders: snapshot.folders instanceof Map ? snapshot.folders : new Map<string, Folder>(Object.entries(snapshot.folders as any).map(([id, f]: [string, any]) => [id, f])),
                notes: snapshot.notes instanceof Map ? snapshot.notes : new Map<string, Note>(Object.entries(snapshot.notes as any).map(([id, n]: [string, any]) => [id, n])),
                urls: new Map<string, Url>(Object.entries(snapshot.urls as any).map(([id, u]: [string, any]) => [id, u])),
                homeContent: snapshot.homeContent || '',
              };
            }
          }
          
          // 如果没有快照，说明是首次同步，需要同步
          if (!snapshot) {
            logger.log('[dataStore] 首次同步，同步所有数据');
          } else {
            // 检查是否有变化
            let hasChanges = false;
            
            // 检查文件夹变化（包括新建的文件夹）
            const currentFoldersMap = new Map(state.folders.map(f => [f.id, f]));
            for (const [id, folder] of currentFoldersMap) {
              const oldFolder = snapshot.folders.get(id);
              // 如果是新建的文件夹（快照中没有），或者有变化，需要同步
              if (!oldFolder) {
                logger.log('[dataStore] 检测到新建的文件夹（快照检查）:', { id, name: folder.name });
                hasChanges = true;
                break;
              } else if (oldFolder.updatedAt !== folder.updatedAt || oldFolder.isDeleted !== folder.isDeleted) {
                hasChanges = true;
                break;
              }
            }
            // 检查是否有新增或删除的文件夹（数量变化）
            if (!hasChanges) {
              if (currentFoldersMap.size !== snapshot.folders.size) {
                logger.log('[dataStore] 检测到文件夹数量变化:', { 
                  current: currentFoldersMap.size, 
                  snapshot: snapshot.folders.size 
                });
                hasChanges = true;
              }
            }
            
            // 检查笔记变化（包括新建的笔记）
            if (!hasChanges) {
              const currentNotesMap = new Map(state.notes.map(n => [n.id, n]));
              for (const [id, note] of currentNotesMap) {
                const oldNote = snapshot.notes.get(id);
                // 如果是新建的笔记（快照中没有），或者有变化，需要同步
                if (!oldNote) {
                  logger.log('[dataStore] 检测到新建的笔记（快照检查）:', { id, content: note.content.substring(0, 50) });
                  hasChanges = true;
                  break;
                } else if (oldNote.updatedAt !== note.updatedAt || oldNote.isDeleted !== note.isDeleted) {
                  hasChanges = true;
                  break;
                }
              }
              if (!hasChanges && currentNotesMap.size !== snapshot.notes.size) {
                logger.log('[dataStore] 检测到笔记数量变化:', { 
                  current: currentNotesMap.size, 
                  snapshot: snapshot.notes.size 
                });
                hasChanges = true;
              }
            }
            
            // 检查网址变化（包括新建的网址）
            if (!hasChanges) {
              const currentUrlsMap = new Map(state.urls.map(u => [u.id, u]));
              for (const [id, url] of currentUrlsMap) {
                const oldUrl = snapshot.urls.get(id);
                // 如果是新建的网址（快照中没有），或者有变化，需要同步
                if (!oldUrl) {
                  logger.log('[dataStore] 检测到新建的网址（快照检查）:', { id, title: url.title });
                  hasChanges = true;
                  break;
                } else if (oldUrl.updatedAt !== url.updatedAt || oldUrl.isDeleted !== url.isDeleted) {
                  hasChanges = true;
                  break;
                }
              }
              if (!hasChanges && currentUrlsMap.size !== snapshot.urls.size) {
                logger.log('[dataStore] 检测到网址数量变化:', { 
                  current: currentUrlsMap.size, 
                  snapshot: snapshot.urls.size 
                });
                hasChanges = true;
              }
            }
            
            // 检查首页内容变化
            if (!hasChanges) {
              const { useHomeContentStore } = await import('./homeContentStore');
              const currentHomeContent = useHomeContentStore.getState().content || '';
              const snapshotHomeContent = snapshot.homeContent || '';
              if (currentHomeContent !== snapshotHomeContent) {
                hasChanges = true;
                logger.log('[dataStore] 检测到首页内容变化:', {
                  current: currentHomeContent.substring(0, 50),
                  snapshot: snapshotHomeContent.substring(0, 50),
                  currentLength: currentHomeContent.length,
                  snapshotLength: snapshotHomeContent.length,
                });
              } else {
                logger.log('[dataStore] 首页内容无变化:', {
                  content: currentHomeContent.substring(0, 50),
                  length: currentHomeContent.length,
                });
              }
            }
            
            // 如果没有变化且不是删除操作，跳过同步
            if (!hasChanges && !isDeleteOperation) {
              logger.log('[dataStore] 数据无变化，跳过同步');
              return;
            }
            
            logger.log('[dataStore] 检测到数据变化，开始同步');
          }
          // 如果正在上传，检查是否卡住（超过30秒）
          // 重要：删除操作必须立即同步，即使正在上传也要等待或强制同步
          if (get().isUploading && !isDeleteOperation) {
            const lastSyncTime = get().lastSyncTime;
            const timeSinceLastSync = lastSyncTime ? Date.now() - lastSyncTime : Infinity;
            // 如果上传超过30秒，可能是卡住了，强制重置并继续
            if (timeSinceLastSync > 30000) {
              logger.warn('[dataStore] 检测到上传可能卡住（超过30秒），强制重置状态并继续上传');
              set({
                isUploading: false,
                isDownloading: false, // 同时重置下载状态，防止死锁
                syncError: null,
                pendingChanges: true, // 标记为有待同步的变更
              });
            } else {
              logger.log('[dataStore] 正在上传数据，跳过此次同步（非删除操作）', {
                timeSinceLastSync,
                lastSyncTime: get().lastSyncTime,
              });
              return;
            }
          }
          
          // 如果正在下载，也检查是否卡住（超过30秒）
          if (get().isDownloading) {
            const lastSyncTime = get().lastSyncTime;
            const timeSinceLastSync = lastSyncTime ? Date.now() - lastSyncTime : Infinity;
            // 如果下载超过30秒，可能是卡住了，强制重置并继续
            if (timeSinceLastSync > 30000) {
              logger.warn('[dataStore] 检测到下载可能卡住（超过30秒），强制重置状态');
              set({
                isDownloading: false,
                isUploading: false, // 同时重置上传状态，防止死锁
                syncError: null,
              });
            } else {
              logger.log('[dataStore] 正在下载数据，跳过此次上传同步', {
                timeSinceLastSync,
                lastSyncTime: get().lastSyncTime,
              });
              // 下载时不上传，避免冲突
              if (!isDeleteOperation) {
                return;
              }
            }
          }
          
          // 如果是删除操作且正在上传，等待当前上传完成或强制重置
          if (get().isUploading && isDeleteOperation) {
            const lastSyncTime = get().lastSyncTime;
            const timeSinceLastSync = lastSyncTime ? Date.now() - lastSyncTime : Infinity;
            // 如果上传超过30秒，强制重置并继续
            if (timeSinceLastSync > 30000) {
              logger.warn('[dataStore] 删除操作：检测到上传可能卡住，强制重置状态并继续上传');
              set({
                isUploading: false,
                syncError: null,
              });
            } else {
              logger.log('[dataStore] 删除操作：等待当前上传完成（最多等待5秒）');
              // 等待最多5秒，让当前上传完成
              let waitCount = 0;
              while (get().isUploading && waitCount < 50) {
                await new Promise(resolve => setTimeout(resolve, 100));
                waitCount++;
              }
              // 如果还在上传，强制重置（删除操作必须同步）
              if (get().isUploading) {
                logger.warn('[dataStore] 删除操作：等待超时，强制重置上传状态');
                set({
                  isUploading: false,
                  syncError: null,
                });
              }
            }
          }
          
          // 优化：删除操作始终同步，其他操作如果有变更也同步
          // 如果没有待同步的变更且不是删除操作，检查是否需要同步
          // 重要：即使没有 pendingChanges，也要检查是否有新建的项或 homeContent 是否有变化
          if (!get().pendingChanges && !isDeleteOperation) {
            const state = get();
            const snapshot = state.lastSyncedSnapshot;
            
            // 检查是否有新建的项（快照中没有的项）
            let hasNewItems = false;
            if (snapshot) {
              // 检查是否有新建的文件夹
              const currentFoldersMap = new Map(state.folders.map(f => [f.id, f]));
              for (const [id] of currentFoldersMap) {
                if (!snapshot.folders.get(id)) {
                  logger.log('[dataStore] 检测到新建的文件夹（即使没有 pendingChanges）:', { id });
                  hasNewItems = true;
                  break;
                }
              }
              
              // 检查是否有新建的笔记
              if (!hasNewItems) {
                const currentNotesMap = new Map(state.notes.map(n => [n.id, n]));
                for (const [id] of currentNotesMap) {
                  if (!snapshot.notes.get(id)) {
                    logger.log('[dataStore] 检测到新建的笔记（即使没有 pendingChanges）:', { id });
                    hasNewItems = true;
                    break;
                  }
                }
              }
              
              // 检查是否有新建的网址
              if (!hasNewItems) {
                const currentUrlsMap = new Map(state.urls.map(u => [u.id, u]));
                for (const [id] of currentUrlsMap) {
                  if (!snapshot.urls.get(id)) {
                    logger.log('[dataStore] 检测到新建的网址（即使没有 pendingChanges）:', { id });
                    hasNewItems = true;
                    break;
                  }
                }
              }
            }
            
            // 检查 homeContent 是否有变化（即使其他数据没变化）
            const { useHomeContentStore } = await import('./homeContentStore');
            const currentHomeContent = useHomeContentStore.getState().content || '';
            const snapshotHomeContent = snapshot?.homeContent || '';
            const hasHomeContentChange = currentHomeContent !== snapshotHomeContent;
            
            if (hasNewItems || hasHomeContentChange) {
              if (hasNewItems) {
                logger.log('[dataStore] 检测到新建的项（即使没有 pendingChanges），需要同步');
              }
              if (hasHomeContentChange) {
                logger.log('[dataStore] 检测到首页内容变化（即使其他数据无变化），需要同步:', {
                  current: currentHomeContent.substring(0, 50),
                  snapshot: snapshotHomeContent.substring(0, 50),
                });
              }
              // 继续同步
            } else {
              const timeSinceLastSync = Date.now() - (get().lastSyncTime || 0);
              // 如果最近3秒内已同步，跳过（避免频繁同步，但确保数据变动能及时同步）
              if (timeSinceLastSync < 3000 && get().lastSyncTime) {
                logger.log('[dataStore] 数据无变化且最近已同步，跳过');
                return;
              }
            }
          }
          
          // 如果有待同步的变更或删除操作，强制同步
          if (get().pendingChanges || isDeleteOperation) {
            logger.log('[dataStore] 检测到数据变动，开始同步到服务器', {
              pendingChanges: get().pendingChanges,
              isDeleteOperation,
            });
          }
          
          // 添加超时保护：如果同步操作超过30秒，自动重置状态
          const timeoutProtection = setTimeout(() => {
            const state = get();
            if (state.isUploading) {
              logger.error('[dataStore] 同步超时（30秒），强制重置状态');
              set({
                isUploading: false,
                isDownloading: false, // 同时重置下载状态，防止死锁
                syncError: '同步超时，请检查网络连接',
                syncSuccess: false,
                pendingChanges: true, // 标记为有待同步的变更，以便重试
              });
            }
          }, 30000); // 30秒超时（缩短到30秒）
          
          try {
            const syncStartTime = Date.now();
            logger.log('[dataStore] 开始同步数据到服务器', {
              isDeleteOperation,
              pendingChanges: get().pendingChanges,
              lastSyncTime: get().lastSyncTime,
            });
            set({ isUploading: true, pendingChanges: false });
            
            const { currentUser, token } = useUserStore.getState();
            if (!currentUser || !token) {
              clearTimeout(timeoutProtection);
              logger.warn('[dataStore] 未登录，无法同步数据');
              set({ isUploading: false });
              return;
            }
            
            const state = get();
            
            // 确保永久删除的文件夹、笔记、网址ID列表是 Set 类型
            let permanentlyDeletedIds: Set<string>;
            if (state.permanentlyDeletedFolderIds instanceof Set) {
              permanentlyDeletedIds = state.permanentlyDeletedFolderIds;
            } else if (Array.isArray(state.permanentlyDeletedFolderIds)) {
              permanentlyDeletedIds = new Set(state.permanentlyDeletedFolderIds);
            } else {
              permanentlyDeletedIds = new Set<string>();
            }
            
            let permanentlyDeletedNoteIds: Set<string>;
            if (state.permanentlyDeletedNoteIds instanceof Set) {
              permanentlyDeletedNoteIds = state.permanentlyDeletedNoteIds;
            } else if (Array.isArray(state.permanentlyDeletedNoteIds)) {
              permanentlyDeletedNoteIds = new Set(state.permanentlyDeletedNoteIds);
            } else {
              permanentlyDeletedNoteIds = new Set<string>();
            }
            
            let permanentlyDeletedUrlIds: Set<string>;
            if (state.permanentlyDeletedUrlIds instanceof Set) {
              permanentlyDeletedUrlIds = state.permanentlyDeletedUrlIds;
            } else if (Array.isArray(state.permanentlyDeletedUrlIds)) {
              permanentlyDeletedUrlIds = new Set(state.permanentlyDeletedUrlIds);
            } else {
              permanentlyDeletedUrlIds = new Set<string>();
            }
            
            // 增量同步：只发送变化的数据（与快照对比）
            let snapshot = state.lastSyncedSnapshot;
            
            // 再次修复快照（确保 Map 类型正确）
            if (snapshot) {
              if (!(snapshot.folders instanceof Map) || !(snapshot.notes instanceof Map) || !(snapshot.urls instanceof Map)) {
                logger.warn('[dataStore] syncDataToServer: 快照中的 Map 类型不正确，正在修复...');
                try {
                  snapshot = {
                    folders: snapshot.folders instanceof Map 
                      ? snapshot.folders 
                      : (Array.isArray(snapshot.folders) 
                          ? new Map<string, Folder>(snapshot.folders)
                          : new Map<string, Folder>(Object.entries(snapshot.folders as any))),
                    notes: snapshot.notes instanceof Map 
                      ? snapshot.notes 
                      : (Array.isArray(snapshot.notes) 
                          ? new Map<string, Note>(snapshot.notes)
                          : new Map<string, Note>(Object.entries(snapshot.notes as any || {}))),
                    urls: snapshot.urls instanceof Map 
                      ? snapshot.urls 
                      : (Array.isArray(snapshot.urls) 
                          ? new Map<string, Url>(snapshot.urls)
                          : new Map<string, Url>(Object.entries(snapshot.urls as any || {}))),
                    homeContent: snapshot.homeContent || '',
                  };
                  // 更新 state 中的快照
                  set({ lastSyncedSnapshot: snapshot });
                } catch (e) {
                  logger.error('[dataStore] syncDataToServer: 修复快照失败，重置为 null:', e);
                  snapshot = null;
                  set({ lastSyncedSnapshot: null });
                }
              }
            }
            
            let foldersToSync: Folder[] = [];
            let notesToSync: Note[] = [];
            let urlsToSync: Url[] = [];
            
            if (!snapshot) {
              // 首次同步，发送所有数据
              logger.log('[dataStore] 首次同步，发送所有数据');
              foldersToSync = (state.folders || []).filter((folder: Folder) => {
                if (permanentlyDeletedIds.has(folder.id)) return false;
                return !folder.isDeleted || isDeleteOperation;
              });
              notesToSync = (state.notes || []).filter((note: Note) => {
                if (permanentlyDeletedNoteIds.has(note.id)) return false;
                return !note.isDeleted || isDeleteOperation;
              });
              urlsToSync = (state.urls || []).filter((url: Url) => {
                if (permanentlyDeletedUrlIds.has(url.id)) return false;
                return !url.isDeleted || isDeleteOperation;
              });
            } else {
              // 增量同步：只发送变化的数据
              logger.log('[dataStore] 增量同步，只发送变化的数据');
              
              // 找出变化的文件夹
              const currentFoldersMap = new Map(state.folders.map(f => [f.id, f]));
              for (const [id, folder] of currentFoldersMap) {
                if (permanentlyDeletedIds.has(id)) continue;
                
                const oldFolder = snapshot.folders.get(id);
                // 如果是新文件夹，或者有变化（updatedAt、isDeleted 或其他字段不同），需要同步
                if (!oldFolder) {
                  // 新建的文件夹，必须同步
                  logger.log('[dataStore] 检测到新建的文件夹，需要同步:', { id, name: folder.name });
                  foldersToSync.push(folder);
                } else {
                  // 检查是否有变化：updatedAt、isDeleted、name、color、type 等
                  const hasUpdatedAtChange = oldFolder.updatedAt !== folder.updatedAt;
                  const hasDeletedChange = oldFolder.isDeleted !== folder.isDeleted;
                  const hasNameChange = oldFolder.name !== folder.name;
                  const hasColorChange = oldFolder.color !== folder.color;
                  const hasTypeChange = oldFolder.type !== folder.type;
                  const hasVersionChange = (oldFolder as any).version !== (folder as any).version;
                  
                  if (hasUpdatedAtChange || hasDeletedChange || hasNameChange || hasColorChange || hasTypeChange || hasVersionChange || (isDeleteOperation && folder.isDeleted)) {
                    // 有变化的文件夹，需要同步
                    logger.log('[dataStore] 检测到文件夹变化，需要同步:', { 
                      id, 
                      name: folder.name,
                      oldUpdatedAt: oldFolder.updatedAt, 
                      newUpdatedAt: folder.updatedAt,
                      oldIsDeleted: oldFolder.isDeleted,
                      newIsDeleted: folder.isDeleted,
                      hasNameChange,
                      hasColorChange,
                      hasTypeChange,
                      hasVersionChange,
                    });
                    foldersToSync.push(folder);
                  }
                }
              }
              
              // 找出变化的笔记
              const currentNotesMap = new Map(state.notes.map(n => [n.id, n]));
              for (const [id, note] of currentNotesMap) {
                if (permanentlyDeletedNoteIds.has(id)) continue;
                
                const oldNote = snapshot.notes.get(id);
                // 如果是新笔记，或者有变化（updatedAt、isDeleted 或内容不同），需要同步
                if (!oldNote) {
                  // 新建的笔记，必须同步
                  logger.log('[dataStore] 检测到新建的笔记，需要同步:', { id, content: note.content.substring(0, 50) });
                  notesToSync.push(note);
                } else {
                  // 检查是否有变化：updatedAt、isDeleted、content、folderId
                  const hasUpdatedAtChange = oldNote.updatedAt !== note.updatedAt;
                  const hasDeletedChange = oldNote.isDeleted !== note.isDeleted;
                  const hasContentChange = oldNote.content !== note.content;
                  const hasFolderIdChange = oldNote.folderId !== note.folderId;
                  const hasVersionChange = (oldNote as any).version !== (note as any).version;
                  
                  if (hasUpdatedAtChange || hasDeletedChange || hasContentChange || hasFolderIdChange || hasVersionChange || (isDeleteOperation && note.isDeleted)) {
                    // 有变化的笔记，需要同步
                    logger.log('[dataStore] 检测到笔记变化，需要同步:', { 
                      id, 
                      oldUpdatedAt: oldNote.updatedAt, 
                      newUpdatedAt: note.updatedAt,
                      oldIsDeleted: oldNote.isDeleted,
                      newIsDeleted: note.isDeleted,
                      hasContentChange,
                      hasFolderIdChange,
                      hasVersionChange,
                    });
                    notesToSync.push(note);
                  }
                }
              }
              
              // 找出变化的网址
              const currentUrlsMap = new Map(state.urls.map(u => [u.id, u]));
              for (const [id, url] of currentUrlsMap) {
                if (permanentlyDeletedUrlIds.has(id)) continue;
                
                const oldUrl = snapshot.urls.get(id);
                // 如果是新网址，或者有变化（updatedAt、isDeleted 或其他字段不同），需要同步
                if (!oldUrl) {
                  // 新建的网址，必须同步
                  logger.log('[dataStore] 检测到新建的网址，需要同步:', { id, title: url.title });
                  urlsToSync.push(url);
                } else {
                  // 检查是否有变化：updatedAt、isDeleted、title、url、folderId 等
                  const hasUpdatedAtChange = oldUrl.updatedAt !== url.updatedAt;
                  const hasDeletedChange = oldUrl.isDeleted !== url.isDeleted;
                  const hasTitleChange = oldUrl.title !== url.title;
                  const hasUrlChange = oldUrl.url !== url.url;
                  const hasFolderIdChange = oldUrl.folderId !== url.folderId;
                  const hasVersionChange = (oldUrl as any).version !== (url as any).version;
                  
                  if (hasUpdatedAtChange || hasDeletedChange || hasTitleChange || hasUrlChange || hasFolderIdChange || hasVersionChange || (isDeleteOperation && url.isDeleted)) {
                    // 有变化的网址，需要同步
                    logger.log('[dataStore] 检测到网址变化，需要同步:', { 
                      id, 
                      title: url.title,
                      oldUpdatedAt: oldUrl.updatedAt, 
                      newUpdatedAt: url.updatedAt,
                      oldIsDeleted: oldUrl.isDeleted,
                      newIsDeleted: url.isDeleted,
                      hasTitleChange,
                      hasUrlChange,
                      hasFolderIdChange,
                      hasVersionChange,
                    });
                    urlsToSync.push(url);
                  }
                }
              }
              
              logger.log('[dataStore] 增量同步数据统计:', {
                folders: { total: state.folders.length, changed: foldersToSync.length, snapshotSize: snapshot.folders.size },
                notes: { total: state.notes.length, changed: notesToSync.length, snapshotSize: snapshot.notes.size },
                urls: { total: state.urls.length, changed: urlsToSync.length, snapshotSize: snapshot.urls.size },
                newFolders: foldersToSync.filter(f => !snapshot.folders.get(f.id)).length,
                newNotes: notesToSync.filter(n => !snapshot.notes.get(n.id)).length,
                newUrls: urlsToSync.filter(u => !snapshot.urls.get(u.id)).length,
              });
              
              // 如果没有变化的数据，记录警告
              if (foldersToSync.length === 0 && notesToSync.length === 0 && urlsToSync.length === 0) {
                logger.warn('[dataStore] 警告：增量同步没有检测到任何变化的数据！', {
                  totalFolders: state.folders.length,
                  totalNotes: state.notes.length,
                  totalUrls: state.urls.length,
                  snapshotFolders: snapshot.folders.size,
                  snapshotNotes: snapshot.notes.size,
                  snapshotUrls: snapshot.urls.size,
                });
              }
            }
            
            // 如果过滤掉了数据，记录日志
            const filteredFolders = (state.folders || []).length - foldersToSync.length;
            const filteredNotes = (state.notes || []).length - notesToSync.length;
            const filteredUrls = (state.urls || []).length - urlsToSync.length;
            if (filteredFolders > 0 || filteredNotes > 0 || filteredUrls > 0) {
              logger.log('[dataStore] 同步到服务器前过滤已删除的项:', {
                folders: { before: (state.folders || []).length, after: foldersToSync.length, removed: filteredFolders },
                notes: { before: (state.notes || []).length, after: notesToSync.length, removed: filteredNotes },
                urls: { before: (state.urls || []).length, after: urlsToSync.length, removed: filteredUrls },
              });
            }
            
            // 获取首页内容，检查是否有变化（增量同步）
            const { useHomeContentStore } = await import('./homeContentStore');
            const currentHomeContent = useHomeContentStore.getState().content || '';
            const snapshotHomeContent = snapshot?.homeContent || '';
            
            // 只同步变化的首页内容（如果内容有变化）
            let homeContentToSync: string | undefined = undefined;
            if (currentHomeContent !== snapshotHomeContent) {
              homeContentToSync = currentHomeContent;
              logger.log('[dataStore] 首页内容有变化，需要同步:', {
                current: currentHomeContent.substring(0, 50),
                snapshot: snapshotHomeContent.substring(0, 50),
                length: currentHomeContent.length,
              });
            } else {
              logger.log('[dataStore] 首页内容无变化，不发送');
            }
            
            // 构建同步数据（只包含变化的部分）
            const dataToSync: any = {
              folders: foldersToSync,
              notes: notesToSync,
              urls: urlsToSync,
              trash: [], // 保留 trash 数组（向后兼容），但不再使用
              permanentlyDeletedFolderIds: Array.from(permanentlyDeletedIds), // 同步永久删除列表
              permanentlyDeletedNoteIds: Array.from(permanentlyDeletedNoteIds), // 同步永久删除的笔记列表
              permanentlyDeletedUrlIds: Array.from(permanentlyDeletedUrlIds), // 同步永久删除的网址列表
            };
            
            // 只有首页内容有变化时才包含
            if (homeContentToSync !== undefined) {
              dataToSync.homeContent = homeContentToSync;
            }
            
            logger.log('[dataStore] 准备同步的数据（增量）:', {
              folders: foldersToSync.length,
              notes: notesToSync.length,
              urls: urlsToSync.length,
              hasHomeContent: homeContentToSync !== undefined,
              homeContentLength: homeContentToSync?.length || 0,
              permanentlyDeletedFolderIds: permanentlyDeletedIds.size,
              permanentlyDeletedNoteIds: permanentlyDeletedNoteIds.size,
              permanentlyDeletedUrlIds: permanentlyDeletedUrlIds.size,
            });
            
            // 检查删除操作是否包含已删除的项
            const deletedNotesCount = notesToSync.filter((n) => n.isDeleted).length;
            const deletedUrlsCount = urlsToSync.filter((u) => u.isDeleted).length;
            const deletedFoldersCount = foldersToSync.filter((f) => f.isDeleted).length;
            
            // 获取已删除的笔记详情（用于调试）
            const deletedNotes = notesToSync.filter((n) => n.isDeleted).map((n) => ({
              id: n.id,
              isDeleted: n.isDeleted,
              deletedAt: n.deletedAt,
              updatedAt: n.updatedAt,
            }));
            
            logger.log('[dataStore] 自动同步数据到服务器（数据变动触发）:', {
              folders: foldersToSync.length,
              notes: notesToSync.length,
              urls: urlsToSync.length,
              permanentlyDeletedFolderIds: permanentlyDeletedIds.size,
              permanentlyDeletedNoteIds: permanentlyDeletedNoteIds.size,
              permanentlyDeletedUrlIds: permanentlyDeletedUrlIds.size,
              permanentlyDeletedFolderIdsList: Array.from(permanentlyDeletedIds).slice(0, 10),
              permanentlyDeletedNoteIdsList: Array.from(permanentlyDeletedNoteIds).slice(0, 10),
              isDeleteOperation,
              pendingChanges: get().pendingChanges,
              deletedItems: {
                folders: deletedFoldersCount,
                notes: deletedNotesCount,
                urls: deletedUrlsCount,
              },
              deletedNotesDetails: deletedNotes.length > 0 ? deletedNotes : undefined,
            });
            
            // 如果是删除操作但没有包含已删除的项，记录警告
            if (isDeleteOperation && deletedNotesCount === 0 && deletedUrlsCount === 0 && deletedFoldersCount === 0) {
              logger.warn('[dataStore] 警告：删除操作但没有检测到已删除的项！', {
                totalNotes: notesToSync.length,
                totalUrls: urlsToSync.length,
                totalFolders: foldersToSync.length,
                allNotes: notesToSync.map((n) => ({ id: n.id, isDeleted: n.isDeleted })),
              });
            }
            
            // 使用AbortController实现超时
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
            
            // 详细记录要同步的删除数据
            const deletedNotesInSync = notesToSync.filter((n) => n.isDeleted);
            if (deletedNotesInSync.length > 0 || isDeleteOperation) {
              logger.log('[dataStore] 🔴 准备同步已删除的笔记到服务器:', {
                count: deletedNotesInSync.length,
                isDeleteOperation,
                notes: deletedNotesInSync.map((n) => ({
                  id: n.id,
                  isDeleted: n.isDeleted,
                  deletedAt: n.deletedAt,
                  updatedAt: n.updatedAt,
                })),
              });
            }
            
            try {
              logger.log('[dataStore] 📤 发送同步请求到服务器:', {
                folders: foldersToSync.length,
                notes: notesToSync.length,
                urls: urlsToSync.length,
                deletedNotes: deletedNotesInSync.length,
                isDeleteOperation,
                url: `${API_BASE_URL}/v1/data/sync`,
              });
              
              const res = await fetch(`${API_BASE_URL}/v1/data/sync`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(dataToSync),
                signal: controller.signal,
              });
              
              logger.log('[dataStore] 📥 服务器响应:', {
                status: res.status,
                statusText: res.statusText,
                ok: res.ok,
              });
              
              clearTimeout(timeoutId);
              
              if (res.ok) {
                let result;
                try {
                  const text = await res.text();
                  if (!text || text.trim() === '') {
                    logger.error('[dataStore] 服务器返回空响应');
                    clearTimeout(timeoutProtection);
                    set({ 
                      isUploading: false, 
                      pendingChanges: true,
                      syncError: '服务器返回空响应，请重试',
                    });
                    return;
                  }
                  result = JSON.parse(text);
                } catch (e) {
                  clearTimeout(timeoutProtection);
                  logger.error('[dataStore] JSON解析失败:', e);
                  set({ 
                    isUploading: false, 
                    pendingChanges: true,
                    syncError: '服务器响应格式错误，请重试',
                  });
                  return;
                }
                
                if (result && result.success) {
                  clearTimeout(timeoutProtection);
                  const syncDuration = Date.now() - syncStartTime;
                  
                  // 更新版本信息：同步成功后，标记为已同步
                  // 注意：版本控制使用统一的 version 字段，不再使用 isDirty 和 localVersion
                  const currentState = get();
                  const updatedNotes = currentState.notes.map((note) => {
                    // 使用服务器返回的版本号（如果有）
                    const serverVersion = result.data?.versions?.notes?.find((v: any) => v.id === note.id)?.serverVersion;
                    if (serverVersion !== undefined) {
                      return markAsSynced(note, serverVersion);
                    }
                    return note;
                  });
                  
                  set({
                    notes: updatedNotes,
                    lastSyncTime: result.data?.lastSyncAt || Date.now(),
                    isUploading: false,
                    pendingChanges: false,
                    syncError: null,
                    syncSuccess: true,
                    syncRetryCount: 0, // 重置重试计数
                    lastRetryTime: null,
                    // 重要：不在这里更新快照，等待从服务器拉取数据后再更新快照
                    // 这样可以确保快照与服务器数据一致
                  });
                  logger.log('[dataStore] 数据已同步到服务器', {
                    duration: `${syncDuration}ms`,
                    folders: foldersToSync.length,
                    notes: notesToSync.length,
                    urls: urlsToSync.length,
                  });
                  
                  // 3秒后清除成功状态
                  setTimeout(() => {
                    set({ syncSuccess: false });
                  }, 3000);
                  
                  // 关键修复：上传成功后，必须从服务器拉取最新数据，然后基于服务器数据更新快照
                  // 这确保快照与服务器数据一致，所有设备都能正确同步
                  // 重要：如果是删除操作，延迟拉取服务器数据，确保服务器有足够时间保存删除状态
                  if (isDeleteOperation) {
                    logger.log('[dataStore] 删除操作上传成功，延迟2秒后从服务器拉取最新数据（确保服务器有足够时间保存删除状态）');
                    // 延迟2秒，确保服务器有足够时间保存删除状态
                    setTimeout(async () => {
                      try {
                        await get().syncDataFromServer(0, true); // 强制优先使用服务器数据，这会更新快照
                        logger.log('[dataStore] 删除操作后，服务器数据比对和应用完成（确保以服务器为准）');
                      } catch (error) {
                        logger.error('[dataStore] 删除操作后，从服务器拉取数据失败:', error);
                      }
                    }, 2000);
                  } else {
                    logger.log('[dataStore] 上传成功，立即从服务器拉取最新数据并强制应用服务器数据（确保所有设备一致性）');
                    // 使用 Promise 包装，确保异步错误被正确处理
                    // 增加重试机制，确保能获取到服务器最新数据
                    const fetchServerData = async (retryCount = 0): Promise<void> => {
                      const MAX_RETRIES = 3;
                      const DELAY = 500; // 初始延迟500ms
                      
                      try {
                        await new Promise(resolve => setTimeout(resolve, DELAY * (retryCount + 1)));
                        await get().syncDataFromServer(0, true); // 强制优先使用服务器数据，这会更新快照
                        logger.log('[dataStore] 服务器数据比对和应用完成（确保以服务器为准）');
                      } catch (error) {
                        logger.error('[dataStore] 从服务器拉取数据失败:', error);
                        if (retryCount < MAX_RETRIES) {
                          logger.log(`[dataStore] 重试拉取服务器数据 (${retryCount + 1}/${MAX_RETRIES})`);
                          return fetchServerData(retryCount + 1);
                        } else {
                          logger.warn('[dataStore] 达到最大重试次数，停止拉取服务器数据');
                          // 如果拉取失败，基于当前本地状态更新快照（降级方案）
                          const currentState = get();
                          const { useHomeContentStore } = await import('./homeContentStore');
                          const currentHomeContent = useHomeContentStore.getState().content || '';
                          const fallbackSnapshot = {
                            folders: new Map<string, Folder>(currentState.folders.map(f => [f.id, f])),
                            notes: new Map<string, Note>(currentState.notes.map(n => [n.id, n])),
                            urls: new Map<string, Url>(currentState.urls.map(u => [u.id, u])),
                            homeContent: currentHomeContent,
                          };
                          set({ lastSyncedSnapshot: fallbackSnapshot });
                          logger.warn('[dataStore] 使用降级方案：基于本地状态更新快照');
                        }
                      }
                    };
                    
                    // 异步执行，不阻塞主流程
                    fetchServerData().catch(() => {
                      // 忽略错误，避免未处理的 Promise
                    });
                  }
                } else {
                  clearTimeout(timeoutProtection);
                  set({ 
                    isUploading: false,
                    syncError: result.message || '同步失败',
                    syncSuccess: false,
                  });
                }
              } else if (res.status === 401 || res.status === 403) {
                // Token过期，尝试刷新Token
                const refreshResult = await useUserStore.getState().refreshAccessToken();
                if (refreshResult.ok) {
                  // 刷新成功，重试同步
                  logger.log('[dataStore] Token已刷新，重试同步');
                  return get().syncDataToServer();
                } else {
                  // 刷新失败，清除登录状态
                  clearTimeout(timeoutProtection);
                  logger.warn('[dataStore] Token无效且刷新失败，清除登录状态');
                  set({ 
                    isUploading: false,
                    syncError: '登录已过期，请重新登录',
                    syncSuccess: false,
                  });
                  useUserStore.getState().logout();
                }
              } else {
                clearTimeout(timeoutProtection);
                let errorData = {};
                try {
                  errorData = await res.json();
                } catch (e) {
                  // 忽略JSON解析错误
                }
                const errorMessage = (errorData && typeof errorData === 'object' && 'message' in errorData 
                  ? String(errorData.message) 
                  : '同步失败，请稍后重试');
                logger.error('[dataStore] 同步失败:', errorMessage);
                
                // 使用重试队列进行自动重试（退避策略）
                const syncId = `sync-${Date.now()}`;
                retryQueue.add(
                  syncId,
                  async () => {
                    await get().syncDataToServer(isDeleteOperation);
                  },
                  {
                    maxRetries: 3,
                    onSuccess: () => {
                      logger.log('[dataStore] 重试同步成功');
                      set({ syncError: null, syncSuccess: true });
                    },
                    onFailure: (error) => {
                      logger.error('[dataStore] 重试同步失败，已达最大重试次数:', error);
                      set({ 
                        syncError: '同步失败，请检查网络连接或稍后重试',
                        syncSuccess: false,
                        pendingChanges: false, // 停止重试，避免无限循环
                      });
                    },
                  }
                );
                
                set({ 
                  isUploading: false,
                  syncError: '同步失败，将自动重试',
                  syncSuccess: false,
                });
              }
            } catch (fetchError: unknown) {
              clearTimeout(timeoutId);
              clearTimeout(timeoutProtection);
              const errorMessage = fetchError instanceof Error && fetchError.name === 'AbortError'
                ? '请求超时，请检查网络连接'
                : '网络错误，请检查网络连接';
              
              if (fetchError instanceof Error && fetchError.name === 'AbortError') {
                logger.error('[dataStore] 请求超时');
              } else {
                logger.error('[dataStore] 同步数据到服务器失败:', fetchError);
              }
              
              // 使用重试队列进行自动重试（退避策略）
              const syncId = `sync-${Date.now()}`;
              retryQueue.add(
                syncId,
                async () => {
                  await get().syncDataToServer(isDeleteOperation);
                },
                {
                  maxRetries: 3,
                  onSuccess: () => {
                    logger.log('[dataStore] 重试同步成功');
                    set({ syncError: null, syncSuccess: true });
                  },
                  onFailure: (error) => {
                    logger.error('[dataStore] 重试同步失败，已达最大重试次数:', error);
                    set({ 
                      syncError: errorMessage || '同步失败，请检查网络连接或稍后重试', // 使用错误信息
                      syncSuccess: false,
                      pendingChanges: false, // 停止重试，避免无限循环
                    });
                  },
                }
              );
              
              set({ 
                isUploading: false,
                syncError: errorMessage, // 使用错误信息
                syncSuccess: false,
              });
            }
          } catch (e) {
            clearTimeout(timeoutProtection);
            logger.error('[dataStore] 同步数据到服务器失败:', e);
            const errorMessage = e instanceof Error ? e.message : '同步失败，请稍后重试';
            // 同步失败，触发自动重试
            await get().handleSyncRetry('upload', errorMessage);
          }
        });
      },
      
      getLastSyncTime: () => {
        return get().lastSyncTime;
      },
      
      setLastSyncTime: (time: number | null) => {
        set({ lastSyncTime: time });
      },
      
      clearSyncError: () => {
        set({ syncError: null, syncRetryCount: 0, lastRetryTime: null });
      },
      
      // 强制重置同步状态（用于解决同步卡住的问题）
      forceResetSyncState: () => {
        logger.warn('[dataStore] 强制重置同步状态');
        // 清空重试队列
        retryQueue.clear();
        set({
          isUploading: false,
          isDownloading: false,
          syncError: null,
          syncSuccess: false,
          syncRetryCount: 0,
          lastRetryTime: null,
          pendingChanges: false, // 重置待同步状态，避免无限重试
        });
      },
      
      handleSyncRetry: async (type: 'download' | 'upload', errorMessage: string) => {
        const MAX_RETRIES = 5;
        const currentRetryCount = get().syncRetryCount;
        
        if (currentRetryCount >= MAX_RETRIES) {
          // 超过最大重试次数，停止重试并提示用户
          set({ 
            isDownloading: false,
            isUploading: false,
            syncError: `${errorMessage}（已重试${MAX_RETRIES}次，请检查网络连接）`,
            syncSuccess: false,
            syncRetryCount: 0,
            lastRetryTime: null,
            pendingChanges: false, // 停止重试，避免无限循环
          });
          return;
        }
        
        // 计算延迟时间（指数退避：1s, 2s, 4s, 8s, 16s）
        const delay = Math.min(1000 * Math.pow(2, currentRetryCount), 30000);
        
        // 注意：不要立即设置 isUploading/isDownloading 为 false
        // 因为重试会立即开始，应该保持状态为 true
        set({ 
          syncError: `${errorMessage}（${delay / 1000}秒后重试...）`,
          syncSuccess: false,
          syncRetryCount: currentRetryCount + 1,
          lastRetryTime: Date.now(),
        });
        
        // 延迟后重试（使用 Promise 包装，确保异步错误被正确处理）
        new Promise<void>((resolve) => {
          setTimeout(() => {
            const syncPromise = type === 'download' 
              ? get().syncDataFromServer(0, true) // 强制优先使用服务器数据
              : get().syncDataToServer();
            
            syncPromise
              .then(() => resolve())
              .catch((e) => {
                // 如果重试失败，确保状态被重置
                logger.error('[dataStore] 重试同步失败:', e);
                set({
                  isDownloading: false,
                  isUploading: false,
                  syncError: `重试失败: ${e instanceof Error ? e.message : '未知错误'}`,
                });
                resolve(); // 即使失败也 resolve，避免未处理的 Promise
              });
          }, delay);
        });
      },
    }),
    {
      name: 'piccco-data-storage',
      // 序列化时，将 Set 转换为数组，将 Map 转换为对象
      serialize: (state: any) => {
        const serialized = {
          ...state,
          permanentlyDeletedFolderIds: Array.from(state?.permanentlyDeletedFolderIds || []),
          permanentlyDeletedNoteIds: Array.from(state?.permanentlyDeletedNoteIds || []),
          permanentlyDeletedUrlIds: Array.from(state?.permanentlyDeletedUrlIds || []),
          // 将快照中的 Map 转换为可序列化的格式
          lastSyncedSnapshot: state?.lastSyncedSnapshot ? {
            folders: Array.from(state.lastSyncedSnapshot.folders.entries()),
            notes: Array.from(state.lastSyncedSnapshot.notes.entries()),
            urls: Array.from(state.lastSyncedSnapshot.urls.entries()),
            homeContent: state.lastSyncedSnapshot.homeContent || '',
          } : null,
        };
        return JSON.stringify(serialized);
      },
      // 反序列化时，将数组转换回 Set，将对象转换回 Map
      deserialize: (str: string) => {
        const parsed = JSON.parse(str);
        // 修复快照中的 Map（如果存在）
        let fixedSnapshot = null;
        if (parsed.lastSyncedSnapshot) {
          try {
            // 如果已经是数组格式（新格式）
            if (Array.isArray(parsed.lastSyncedSnapshot.folders)) {
              fixedSnapshot = {
                folders: new Map<string, Folder>(parsed.lastSyncedSnapshot.folders),
                notes: new Map<string, Note>(parsed.lastSyncedSnapshot.notes),
                urls: new Map<string, Url>(parsed.lastSyncedSnapshot.urls),
                homeContent: parsed.lastSyncedSnapshot.homeContent || '',
              };
            } else if (parsed.lastSyncedSnapshot.folders && typeof parsed.lastSyncedSnapshot.folders === 'object' && !(parsed.lastSyncedSnapshot.folders instanceof Map)) {
              // 如果是普通对象（旧格式），转换为 Map
              fixedSnapshot = {
                folders: new Map<string, Folder>(Object.entries(parsed.lastSyncedSnapshot.folders)),
                notes: new Map<string, Note>(Object.entries(parsed.lastSyncedSnapshot.notes || {})),
                urls: new Map<string, Url>(Object.entries(parsed.lastSyncedSnapshot.urls || {})),
                homeContent: parsed.lastSyncedSnapshot.homeContent || '',
              };
            } else {
              // 已经是 Map（理论上不应该发生，但为了安全）
              fixedSnapshot = parsed.lastSyncedSnapshot;
            }
          } catch (e) {
            console.warn('[dataStore] 快照反序列化失败，重置为 null:', e);
            fixedSnapshot = null;
          }
        }
        
        return {
          ...parsed,
          permanentlyDeletedFolderIds: new Set(parsed.permanentlyDeletedFolderIds || []),
          permanentlyDeletedNoteIds: new Set(parsed.permanentlyDeletedNoteIds || []),
          permanentlyDeletedUrlIds: new Set(parsed.permanentlyDeletedUrlIds || []),
          lastSyncedSnapshot: fixedSnapshot,
        };
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        
        // 修复快照中的 Map（如果从 localStorage 恢复时还是普通对象）
        if (state.lastSyncedSnapshot) {
          try {
            // 如果 folders 是数组格式（新序列化格式）
            if (Array.isArray(state.lastSyncedSnapshot.folders)) {
              state.lastSyncedSnapshot = {
                folders: new Map<string, Folder>(state.lastSyncedSnapshot.folders),
                notes: new Map<string, Note>(state.lastSyncedSnapshot.notes || []),
                urls: new Map<string, Url>(state.lastSyncedSnapshot.urls || []),
                homeContent: state.lastSyncedSnapshot.homeContent || '',
              };
            } 
            // 如果 folders 是普通对象（旧格式）
            else if (state.lastSyncedSnapshot.folders && typeof state.lastSyncedSnapshot.folders === 'object' && !(state.lastSyncedSnapshot.folders instanceof Map)) {
              logger.warn('[dataStore] onRehydrateStorage: 快照中的 Map 被序列化为普通对象，正在修复...');
              state.lastSyncedSnapshot = {
                folders: new Map<string, Folder>(Object.entries(state.lastSyncedSnapshot.folders as any)),
                notes: state.lastSyncedSnapshot.notes instanceof Map 
                  ? state.lastSyncedSnapshot.notes 
                  : new Map<string, Note>(Object.entries(state.lastSyncedSnapshot.notes as any || {})),
                urls: state.lastSyncedSnapshot.urls instanceof Map 
                  ? state.lastSyncedSnapshot.urls 
                  : new Map<string, Url>(Object.entries(state.lastSyncedSnapshot.urls as any || {})),
                homeContent: state.lastSyncedSnapshot.homeContent || '',
              };
            }
            // 如果已经是 Map，但其他字段可能不是
            else if (state.lastSyncedSnapshot.folders instanceof Map) {
              if (!(state.lastSyncedSnapshot.notes instanceof Map)) {
                state.lastSyncedSnapshot.notes = new Map<string, Note>(Object.entries(state.lastSyncedSnapshot.notes as any || {}));
              }
              if (!(state.lastSyncedSnapshot.urls instanceof Map)) {
                state.lastSyncedSnapshot.urls = new Map<string, Url>(Object.entries(state.lastSyncedSnapshot.urls as any || {}));
              }
            }
          } catch (e) {
            logger.error('[dataStore] onRehydrateStorage: 修复快照失败，重置为 null:', e);
            state.lastSyncedSnapshot = null;
          }
        }
        
        // 检查当前用户，如果是新用户（没有登录记录），清空回收站和重置文件夹
        const currentUser = useUserStore.getState().currentUser;
        let isNewUser = false;
        
        if (!currentUser) {
          // 没有用户登录，清空回收站（可能是新用户首次访问）
          state.trash = [];
          isNewUser = true;
        } else {
          // 检查是否有该用户的登录时间记录
          const loginTimeKey = `piccco-login-time-${currentUser.id}`;
          const loginTime = localStorage.getItem(loginTimeKey);
          if (!loginTime) {
            // 新用户首次登录，清空回收站
            state.trash = [];
            isNewUser = true;
          } else {
            // 检查登录时间是否很近（5分钟内），如果是，说明是新用户首次登录
            // 此时即使回收站有数据，也应该清空
            const loginTimestamp = parseInt(loginTime, 10);
            const now = Date.now();
            const timeSinceLogin = now - loginTimestamp;
            
            // 如果登录时间记录是在5分钟内设置的，且回收站有内容，清空回收站
            // 这确保新用户首次登录时回收站为空
            if (state.trash && state.trash.length > 0 && timeSinceLogin < 5 * 60 * 1000) {
              logger.log('[dataStore] 检测到新用户首次登录（登录时间:', timeSinceLogin, 'ms前），清空回收站');
              state.trash = [];
            }
          }
        }
        
        // 强制确保新用户的回收站为空
        if (isNewUser) {
          logger.log('[dataStore] 新用户首次登录，强制清空回收站');
          state.trash = [];
        }
        
        // 确保 permanentlyDeletedFolderIds 是 Set 类型
        if (!(state.permanentlyDeletedFolderIds instanceof Set)) {
          state.permanentlyDeletedFolderIds = new Set(state.permanentlyDeletedFolderIds || []);
        }
        
        // 清理 folders 中已在回收站的文件夹（防止从 localStorage 恢复已删除的文件夹）
        // 同时清理永久删除的文件夹
        // 确保 permanentlyDeletedFolderIds 是 Set 类型
        let permanentlyDeletedIds: Set<string>;
        if (state.permanentlyDeletedFolderIds instanceof Set) {
          permanentlyDeletedIds = state.permanentlyDeletedFolderIds;
        } else if (Array.isArray(state.permanentlyDeletedFolderIds)) {
          permanentlyDeletedIds = new Set(state.permanentlyDeletedFolderIds);
        } else {
          permanentlyDeletedIds = new Set<string>();
        }
        
        const trashFolderIds = new Set<string>(
          (state.trash || [])
            .filter((item: TrashItem) => item.type === 'folder')
            .map((item: TrashItem) => (item.data as Folder).id)
            .filter(Boolean)
        );
        
        const allDeletedIds = new Set<string>([
          ...Array.from(trashFolderIds),
          ...Array.from(permanentlyDeletedIds),
        ]);
        
        if (allDeletedIds.size > 0 && state.folders && state.folders.length > 0) {
          const beforeCount = state.folders.length;
          const beforeFolderIds = state.folders.map((f: Folder) => f.id);
          
          // 过滤掉已删除的文件夹（包括永久删除的）
          state.folders = state.folders.filter((folder: Folder) => !allDeletedIds.has(folder.id));
          
          const afterCount = state.folders.length;
          const removedFolderIds = beforeFolderIds.filter((id: string) => allDeletedIds.has(id));
          
          if (beforeCount !== afterCount) {
            logger.log('[dataStore] 从 localStorage 恢复时清理已删除的文件夹:', {
              deletedCount: allDeletedIds.size,
              removedCount: beforeCount - afterCount,
              removedFolderIds: removedFolderIds,
              deletedFolderIds: Array.from(allDeletedIds),
            });
          }
        }
        
        // 额外检查：确保 folders 和 trash 中没有重复的文件夹ID
        // 如果发现重复，以 trash 为准（已删除的文件夹不应该在 folders 中）
        // 这是双重保险，防止任何遗漏
        if (state.folders && state.trash) {
          const trashFolderIds = new Set(
            state.trash
              .filter((item) => item.type === 'folder')
              .map((item) => (item.data as Folder).id)
              .filter(Boolean) // 确保ID不为空
          );
          
          const duplicateFolders = state.folders.filter((folder) => trashFolderIds.has(folder.id));
          if (duplicateFolders.length > 0) {
            logger.warn('[dataStore] 检测到 folders 和 trash 中有重复的文件夹，移除 folders 中的重复项:', {
              duplicateCount: duplicateFolders.length,
              duplicateIds: duplicateFolders.map((f) => f.id),
              trashFolderIds: Array.from(trashFolderIds),
            });
            state.folders = state.folders.filter((folder) => !trashFolderIds.has(folder.id));
          }
        }
        
        // 最终检查：再次确保 folders 中不包含任何在 trash 中的文件夹
        // 这是三重保险，确保万无一失
        if (state.folders && state.trash && state.trash.length > 0) {
          const finalTrashFolderIds = new Set(
            state.trash
              .filter((item) => item.type === 'folder')
              .map((item) => (item.data as Folder).id)
              .filter(Boolean)
          );
          
          const finalDuplicateFolders = state.folders.filter((folder: Folder) => finalTrashFolderIds.has(folder.id));
          if (finalDuplicateFolders.length > 0) {
            logger.error('[dataStore] 最终检查：发现 folders 中仍有已删除的文件夹，强制移除:', {
              duplicateCount: finalDuplicateFolders.length,
              duplicateIds: finalDuplicateFolders.map((f: Folder) => f.id),
            });
            state.folders = state.folders.filter((folder: Folder) => !finalTrashFolderIds.has(folder.id));
          }
        }
        
        // 最终验证：确保清理后的状态是正确的
        // 在页面刷新时，这是最后一道防线
        if (state.folders && state.trash && state.trash.length > 0) {
          const verifyTrashFolderIds = new Set<string>(
            state.trash
              .filter((item: TrashItem) => item.type === 'folder')
              .map((item: TrashItem) => (item.data as Folder).id)
              .filter(Boolean)
          );
          
          const verifyDuplicateFolders = state.folders.filter((folder: Folder) => verifyTrashFolderIds.has(folder.id));
          if (verifyDuplicateFolders.length > 0) {
            logger.error('[dataStore] 页面恢复时最终验证：发现仍有已删除的文件夹，强制移除:', {
              duplicateCount: verifyDuplicateFolders.length,
              duplicateIds: verifyDuplicateFolders.map((f: Folder) => f.id),
            });
            state.folders = state.folders.filter((folder: Folder) => !verifyTrashFolderIds.has(folder.id));
          }
        }
        
        // 额外检查：如果回收站有数据但没有对应的用户数据（笔记、文件夹等），清空回收站
        // 这可以清理孤立的数据
        if (state.trash && state.trash.length > 0) {
          const hasValidData = state.folders.length > 0 || state.notes.length > 0 || state.urls.length > 0;
          // 如果只有默认文件夹（3个），且回收站有数据，可能是旧数据残留，清空回收站
          if (!hasValidData || (state.folders.length === 3 && state.notes.length === 0 && state.urls.length === 0)) {
            const defaultFolderIds = ['folder_privacy_default', 'folder_category1_default', 'folder_category2_default'];
            const onlyDefaultFolders = state.folders.every(f => defaultFolderIds.includes(f.id));
            if (onlyDefaultFolders) {
              logger.log('[dataStore] 检测到只有默认文件夹，清空回收站');
              state.trash = [];
            }
          }
        }
        
        // 最终检查：如果是新用户（没有登录记录或登录时间很近），强制清空回收站
        if (currentUser) {
          const loginTimeKey = `piccco-login-time-${currentUser.id}`;
          const loginTime = localStorage.getItem(loginTimeKey);
          if (loginTime) {
            const loginTimestamp = parseInt(loginTime, 10);
            const now = Date.now();
            const timeSinceLogin = now - loginTimestamp;
            // 如果登录时间在10分钟内，且回收站有数据，强制清空（确保新用户回收站为空）
            if (timeSinceLogin < 10 * 60 * 1000 && state.trash && state.trash.length > 0) {
              logger.log('[dataStore] 新用户首次登录（登录时间:', Math.round(timeSinceLogin / 1000), '秒前），强制清空回收站');
              state.trash = [];
            }
          }
        }
        
        // 如果状态为空或没有文件夹，或者是新用户，初始化默认文件夹
        if (!state.folders || state.folders.length === 0 || isNewUser) {
          const defaultFolders = initializeDefaultFolders();
          state.folders = defaultFolders;
        } else {
          // 确保默认文件夹存在，但不删除用户创建的文件夹
          const defaultFolderIds = [
            'folder_privacy_default',
            'folder_category1_default',
            'folder_category2_default',
          ];
          
          // 检查哪些默认文件夹已存在（包括已删除的）
          const existingDefaultFolders = new Set<string>();
          state.folders.forEach((folder) => {
            if (defaultFolderIds.includes(folder.id)) {
              existingDefaultFolders.add(folder.id);
            }
          });
          
          // 只添加缺失的默认文件夹（不包括已删除的）
          const now = Date.now();
          const foldersToAdd: Folder[] = [];
          
          // 检查永久删除列表，已永久删除的默认文件夹不应该重新创建
          let permanentlyDeletedIds: Set<string>;
          if (state.permanentlyDeletedFolderIds instanceof Set) {
            permanentlyDeletedIds = state.permanentlyDeletedFolderIds;
          } else if (Array.isArray(state.permanentlyDeletedFolderIds)) {
            permanentlyDeletedIds = new Set(state.permanentlyDeletedFolderIds);
          } else {
            permanentlyDeletedIds = new Set<string>();
          }
          
          if (!existingDefaultFolders.has('folder_privacy_default') && !permanentlyDeletedIds.has('folder_privacy_default')) {
            foldersToAdd.push({
              id: 'folder_privacy_default',
              name: '隐私',
              type: 'privacy',
              color: 'purple',
              isStarred: false,
              order: 0,
              createdAt: now,
              updatedAt: now,
              password: undefined,
              isDeleted: false,
              deletedAt: null,
            });
          }
          
          if (!existingDefaultFolders.has('folder_category1_default') && !permanentlyDeletedIds.has('folder_category1_default')) {
            foldersToAdd.push({
              id: 'folder_category1_default',
              name: '分类1',
              type: 'normal',
              color: 'blue',
              isStarred: false,
              order: 1,
              createdAt: now,
              updatedAt: now,
              isDeleted: false,
              deletedAt: null,
            });
          }
          
          if (!existingDefaultFolders.has('folder_category2_default') && !permanentlyDeletedIds.has('folder_category2_default')) {
            foldersToAdd.push({
              id: 'folder_category2_default',
              name: '分类2',
              type: 'normal',
              color: 'green',
              isStarred: false,
              order: 2,
              createdAt: now,
              updatedAt: now,
              isDeleted: false,
              deletedAt: null,
            });
          }
          
          // 只添加缺失的默认文件夹，保留所有用户创建的文件夹
          if (foldersToAdd.length > 0) {
            state.folders = [...state.folders, ...foldersToAdd];
            logger.log('[dataStore] 添加了缺失的默认文件夹:', foldersToAdd.map(f => f.id));
          }
          
          // 使用 deduplicateById 去重，确保每个ID只有一个（保留最新的）
          state.folders = deduplicateById(state.folders);
        }
      },
    }
  )
);

