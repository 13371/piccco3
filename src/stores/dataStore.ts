import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Folder, Note, Url, TrashItem, FolderColor } from '../types';
import { useUserStore } from './userStore';
import { API_BASE_URL } from '../config/api';
import { syncQueue } from '../utils/syncQueue';
import { encryptPrivacyPassword, verifyPrivacyPassword } from '../utils/privacyPassword';
import { logger } from '../utils/logger';

interface DataState {
  folders: Folder[];
  notes: Note[];
  urls: Url[];
  trash: TrashItem[];
  
  // 已永久删除的文件夹ID列表（永远不会被恢复）
  permanentlyDeletedFolderIds: Set<string>;
  
  // 同步状态
  pendingChanges: boolean;
  isUploading: boolean;
  isDownloading: boolean;
  lastSyncTime: number | null;
  syncError: string | null; // 同步错误信息
  syncSuccess: boolean; // 最近一次同步是否成功
  syncRetryCount: number; // 同步重试次数
  lastRetryTime: number | null; // 最后重试时间
  
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
function mergeItem<T extends { id: string; updatedAt?: number; isDeleted?: boolean; deletedAt?: number | null }>(
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
    return {
      ...server,
      // 确保所有字段都以服务器为准
      isDeleted: server.isDeleted !== undefined ? server.isDeleted : false,
      deletedAt: server.deletedAt !== undefined ? server.deletedAt : null,
      updatedAt: server.updatedAt !== undefined ? server.updatedAt : local.updatedAt,
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

// 防抖同步函数（优化：缩短延迟时间，确保数据变动后快速同步）
let uploadSyncTimer: ReturnType<typeof setTimeout> | null = null;

function debouncedUploadSync(syncFn: () => void, delay: number = 500) {
  if (uploadSyncTimer) {
    clearTimeout(uploadSyncTimer);
  }
  uploadSyncTimer = setTimeout(() => {
    syncFn();
    uploadSyncTimer = null;
  }, delay);
}

// 立即同步函数（用于删除等关键操作）
function immediateSync(syncFn: () => void) {
  // 取消任何待执行的防抖同步
  if (uploadSyncTimer) {
    clearTimeout(uploadSyncTimer);
    uploadSyncTimer = null;
  }
  // 立即执行同步
  syncFn();
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
        };
        set((state) => ({
          folders: [...state.folders, newFolder],
        }));
        
        // 标记有变更，自动同步到服务器（优化：缩短防抖时间，快速同步）
        set({ pendingChanges: true });
        debouncedUploadSync(() => get().syncDataToServer(), 500);
        
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
          folders: state.folders.map((f) =>
            f.id === id ? { ...f, ...processedUpdates, updatedAt: Date.now() } : f
          ),
        }));
        
        // 标记有变更，自动同步到服务器（优化：缩短防抖时间，快速同步）
        set({ pendingChanges: true });
        debouncedUploadSync(() => get().syncDataToServer(), 500);
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
          // 软删除文件夹
          const updatedFolders = state.folders.map((f) =>
            f.id === id ? { ...f, isDeleted: true, deletedAt: now, updatedAt: now } : f
          );
          
          // 软删除文件夹内的所有笔记
          const updatedNotes = state.notes.map((n) =>
            n.folderId === id && !n.isDeleted ? { ...n, isDeleted: true, deletedAt: now, updatedAt: now } : n
          );
          
          // 软删除文件夹内的所有网址
          const updatedUrls = state.urls.map((u) =>
            u.folderId === id && !u.isDeleted ? { ...u, isDeleted: true, deletedAt: now, updatedAt: now } : u
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
        
        // 标记有变更，自动同步到服务器（优化：缩短防抖时间，快速同步）
        set({ pendingChanges: true });
        debouncedUploadSync(() => get().syncDataToServer(), 500);
      },
      
      changeFolderColor: (id, color) => {
        if (checkBanned()) return;
        set((state) => ({
          folders: state.folders.map((f) =>
            f.id === id ? { ...f, color, updatedAt: Date.now() } : f
          ),
        }));
        
        // 标记有变更，自动同步到服务器（优化：缩短防抖时间，快速同步）
        set({ pendingChanges: true });
        debouncedUploadSync(() => get().syncDataToServer(), 500);
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
        
        // 标记有变更，自动同步到服务器（优化：缩短防抖时间，快速同步）
        set({ pendingChanges: true });
        debouncedUploadSync(() => get().syncDataToServer(), 500);
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
        };
        set((state) => ({
          notes: [...state.notes, newNote],
        }));
        
        // 标记有变更，自动同步到服务器（优化：缩短防抖时间，快速同步）
        set({ pendingChanges: true });
        debouncedUploadSync(() => get().syncDataToServer(), 500);
        
        return id;
      },
      
      updateNote: (id, content, folderId) => {
        if (checkBanned()) return;
        set((state) => ({
          notes: state.notes.map((n) =>
            n.id === id ? { ...n, content, folderId, updatedAt: Date.now() } : n
          ),
        }));
        
        // 标记有变更，自动同步到服务器（优化：缩短防抖时间，快速同步）
        set({ pendingChanges: true });
        debouncedUploadSync(() => get().syncDataToServer(), 500);
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
              ? { ...n, isDeleted: true, deletedAt: now, updatedAt: now }
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
        
        // 确保删除状态已更新
        setTimeout(() => {
          const currentNote = get().notes.find((n) => n.id === id);
          logger.log('[dataStore] 删除后检查笔记状态:', {
            id,
            isDeleted: currentNote?.isDeleted,
            deletedAt: currentNote?.deletedAt,
            updatedAt: currentNote?.updatedAt,
          });
          
          immediateSync(() => {
            logger.log('[dataStore] immediateSync 执行，调用 syncDataToServer(true)');
            const state = get();
            const deletedNotes = state.notes.filter((n) => n.isDeleted);
            logger.log('[dataStore] 同步前检查已删除的笔记数量:', deletedNotes.length);
            deletedNotes.forEach((n) => {
              logger.log('[dataStore] 已删除的笔记:', {
                id: n.id,
                isDeleted: n.isDeleted,
                deletedAt: n.deletedAt,
                updatedAt: n.updatedAt,
              });
            });
            get().syncDataToServer(true);
          });
        }, 100); // 延迟100ms确保状态已更新
      },
      
      toggleNoteStar: (id) => {
        if (checkBanned()) return;
        set((state) => ({
          notes: state.notes.map((n) =>
            n.id === id ? { ...n, isStarred: !n.isStarred, updatedAt: Date.now() } : n
          ),
        }));
        
        // 标记有变更，自动同步到服务器（优化：缩短防抖时间，快速同步）
        set({ pendingChanges: true });
        debouncedUploadSync(() => get().syncDataToServer(), 500);
      },
      
      addUrl: (title, url, folderId) => {
        if (checkBanned()) return '';
        const id = `url_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newUrl: Url = {
          id,
          title,
          url: url.startsWith('http') ? url : `https://${url}`,
          folderId,
          isStarred: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isDeleted: false,
          deletedAt: null,
        };
        set((state) => ({
          urls: [...state.urls, newUrl],
        }));
        
        // 标记有变更，自动同步到服务器（优化：缩短防抖时间，快速同步）
        set({ pendingChanges: true });
        debouncedUploadSync(() => get().syncDataToServer(), 500);
        
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
        
        // 标记有变更，自动同步到服务器（优化：缩短防抖时间，快速同步）
        set({ pendingChanges: true });
        debouncedUploadSync(() => get().syncDataToServer(), 500);
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
            u.id === id ? { ...u, isDeleted: true, deletedAt: now, updatedAt: now } : u
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
            // 永久删除笔记：从 notes 中物理移除
            const newNotes = state.notes.filter((n) => n.id !== id);
            return { notes: newNotes };
          } else if (deletedUrl) {
            // 永久删除网址：从 urls 中物理移除
            const newUrls = state.urls.filter((u) => u.id !== id);
            return { urls: newUrls };
          }
          
          return {};
        });
        
        // 标记有变更，立即同步到服务器（删除操作需要立即同步）
        set({ pendingChanges: true });
        logger.log('[dataStore] 立即同步永久删除操作到服务器');
        immediateSync(() => get().syncDataToServer(true));
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
            const res = await fetch(`${API_BASE_URL}/data/sync`, {
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
                
              // 验证数据格式
              if (!Array.isArray(serverData.folders) || 
                  !Array.isArray(serverData.notes) || 
                  !Array.isArray(serverData.urls)) {
                logger.error('[dataStore] 服务器数据格式不正确');
                set({ isDownloading: false });
                return;
              }
              
              // 合并服务器数据和本地数据
              // 使用服务器数据为主，但保留本地未同步的数据
              const localData = get();
              
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
                
                // 合并笔记和网址（一切以服务器为准）
                const mergedNotes = mergeArrays(localData.notes, serverData.notes || [], undefined, true);
                const mergedUrls = mergeArrays(localData.urls, serverData.urls || [], undefined, true);
                
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
                
                // 最终验证：确保合并后的 folders 中不包含任何已删除的文件夹
                // 这是最后的防线，防止任何边缘情况
                // 基于 isDeleted 字段和永久删除列表进行最终过滤
                const allDeletedIds = new Set<string>([
                  ...Array.from(allDeletedFolderIds), // 已包含永久删除的文件夹ID
                  ...Array.from(permanentlyDeletedIds), // 再次确保永久删除的文件夹ID被包含
                ]);
                
                // 重要：同步时必须保留所有数据（包括已删除的），以便：
                // 1. 回收站可以显示（isDeleted = true）
                // 2. 多设备同步可以正常工作
                // 3. 列表查询时会自动过滤（isDeleted = false）
                // 只过滤永久删除的文件夹
                const finalVerifiedFolders = finalMergedFolders.filter(
                  (folder: Folder) => !permanentlyDeletedIds.has(folder.id)
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
                const localDeletedBeforeSync = new Set<string>(
                  localData.folders
                    .filter((f: Folder) => f.isDeleted && f.deletedAt)
                    .map((f: Folder) => f.id)
                );
                
                // 检查合并后的文件夹，如果有本地已删除的文件夹变成了未删除，强制恢复删除状态
                const restoredFolders: Folder[] = [];
                finalVerifiedFolders.forEach((folder: Folder) => {
                  if (localDeletedBeforeSync.has(folder.id) && !folder.isDeleted) {
                    // 本地已删除，但合并后变成了未删除，强制恢复删除状态
                    const originalDeleted = localData.folders.find((f: Folder) => f.id === folder.id);
                    if (originalDeleted && originalDeleted.isDeleted && originalDeleted.deletedAt) {
                      restoredFolders.push({
                        ...folder,
                        isDeleted: true,
                        deletedAt: originalDeleted.deletedAt,
                        updatedAt: originalDeleted.updatedAt || originalDeleted.deletedAt,
                      });
                      logger.error('[dataStore] 检测到已删除的文件夹被恢复，强制重新标记为已删除:', {
                        id: folder.id,
                        name: folder.name,
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
                // 使用 deduplicateById 确保 id 唯一性
                set({
                  folders: deduplicateById(finalFolders), // 包含已删除的文件夹（isDeleted = true），列表查询时会过滤
                  notes: deduplicateById(mergedNotes), // 包含已删除的笔记（isDeleted = true），列表查询时会过滤
                  urls: deduplicateById(mergedUrls), // 包含已删除的网址（isDeleted = true），列表查询时会过滤
                  trash: [], // 保留 trash 数组（向后兼容），但不再使用
                  lastSyncTime: serverData.lastSyncAt || Date.now(),
                  isDownloading: false,
                  syncError: null,
                  syncSuccess: true,
                  syncRetryCount: 0, // 重置重试计数
                  lastRetryTime: null,
                });
                
                if (restoredFolders.length > 0) {
                  logger.warn('[dataStore] 已强制恢复', restoredFolders.length, '个已删除文件夹的删除状态');
                }
                
                logger.log('[dataStore] 从服务器同步完成（包含已删除的项）:', {
                  folders: { total: finalVerifiedFolders.length, deleted: deletedFoldersCount, active: finalVerifiedFolders.length - deletedFoldersCount },
                  notes: { total: mergedNotes.length, deleted: deletedNotesCount, active: mergedNotes.length - deletedNotesCount },
                  urls: { total: mergedUrls.length, deleted: deletedUrlsCount, active: mergedUrls.length - deletedUrlsCount },
                });
                
                logger.log('[dataStore] 从服务器同步完成:', {
                  folders: finalVerifiedFolders.length,
                  notes: mergedNotes.length,
                  urls: mergedUrls.length,
                  deletedFolderIds: Array.from(allDeletedIds),
                });
                
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
                syncError: null,
              });
            } else {
              logger.log('[dataStore] 正在上传数据，跳过此次同步（非删除操作）');
              return;
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
          if (!get().pendingChanges && !isDeleteOperation) {
            const timeSinceLastSync = Date.now() - (get().lastSyncTime || 0);
            // 如果最近3秒内已同步，跳过（避免频繁同步，但确保数据变动能及时同步）
            if (timeSinceLastSync < 3000 && get().lastSyncTime) {
              logger.log('[dataStore] 数据无变化且最近已同步，跳过');
              return;
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
            
            // 确保 permanentlyDeletedFolderIds 是 Set 类型
            let permanentlyDeletedIds: Set<string>;
            if (state.permanentlyDeletedFolderIds instanceof Set) {
              permanentlyDeletedIds = state.permanentlyDeletedFolderIds;
            } else if (Array.isArray(state.permanentlyDeletedFolderIds)) {
              permanentlyDeletedIds = new Set(state.permanentlyDeletedFolderIds);
            } else {
              permanentlyDeletedIds = new Set<string>();
            }
            
            // 对于删除操作，需要同步已删除的文件夹（isDeleted = true），以便服务器能正确保存删除状态
            // 对于普通同步，过滤掉已删除的文件夹（只同步活跃数据）
            const foldersToSync = (state.folders || []).filter(
              (folder: Folder) => {
                // 排除永久删除的文件夹
                if (permanentlyDeletedIds.has(folder.id)) {
                  return false;
                }
                // 如果是删除操作，包含已删除的文件夹（isDeleted = true）
                if (isDeleteOperation) {
                  return true; // 包含所有未永久删除的文件夹（包括已删除的）
                }
                // 普通同步，只包含未删除的文件夹
                return !folder.isDeleted;
              }
            );
            
            // 对于删除操作，也需要同步已删除的笔记和网址
            const notesToSync = (state.notes || []).filter((note: Note) => {
              if (isDeleteOperation) {
                return true; // 删除操作时，包含所有笔记（包括已删除的）
              }
              return !note.isDeleted;
            });
            
            const urlsToSync = (state.urls || []).filter((url: Url) => {
              if (isDeleteOperation) {
                return true; // 删除操作时，包含所有网址（包括已删除的）
              }
              return !url.isDeleted;
            });
            
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
            
            const dataToSync = {
              folders: foldersToSync,
              notes: notesToSync,
              urls: urlsToSync,
              trash: [], // 保留 trash 数组（向后兼容），但不再使用
              permanentlyDeletedFolderIds: Array.from(permanentlyDeletedIds), // 同步永久删除列表
            };
            
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
                url: `${API_BASE_URL}/data/sync`,
              });
              
              const res = await fetch(`${API_BASE_URL}/data/sync`, {
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
                  set({
                    lastSyncTime: result.data?.lastSyncAt || Date.now(),
                    isUploading: false,
                    pendingChanges: false,
                    syncError: null,
                    syncSuccess: true,
                    syncRetryCount: 0, // 重置重试计数
                    lastRetryTime: null,
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
                  
                  // 优化：上传成功后，立即从服务器拉取最新数据并强制应用服务器数据
                  // 这确保数据一致性，服务器数据始终是权威来源
                  logger.log('[dataStore] 上传成功，立即从服务器拉取最新数据并强制应用服务器数据');
                  // 使用 Promise 包装，确保异步错误被正确处理
                  new Promise<void>((resolve) => {
                    setTimeout(() => {
                      get().syncDataFromServer(0, true) // 强制优先使用服务器数据
                        .then(() => {
                          logger.log('[dataStore] 服务器数据比对和应用完成');
                          resolve();
                        })
                        .catch((error) => {
                          logger.error('[dataStore] 从服务器拉取数据失败:', error);
                          resolve(); // 即使失败也 resolve，避免未处理的 Promise
                        });
                    }, 1000); // 延迟1秒，确保服务器已处理完上传的数据
                  });
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
                // 同步失败，触发自动重试
                await get().handleSyncRetry('upload', errorMessage);
              }
            } catch (fetchError: unknown) {
              clearTimeout(timeoutId);
              clearTimeout(timeoutProtection);
              let errorMessage = '网络错误，请检查网络连接';
              if (fetchError instanceof Error && fetchError.name === 'AbortError') {
                errorMessage = '请求超时，请检查网络连接';
                logger.error('[dataStore] 请求超时');
              } else {
                logger.error('[dataStore] 同步数据到服务器失败:', fetchError);
              }
              // 同步失败，触发自动重试
              await get().handleSyncRetry('upload', errorMessage);
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
        set({
          isUploading: false,
          isDownloading: false,
          syncError: null,
          syncSuccess: false,
          syncRetryCount: 0,
          lastRetryTime: null,
          // 保留 pendingChanges，以便用户重试
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
      // 序列化时，将 Set 转换为数组
      serialize: (state: any) => {
        const serialized = {
          ...state,
          permanentlyDeletedFolderIds: Array.from(state?.permanentlyDeletedFolderIds || []),
        };
        return JSON.stringify(serialized);
      },
      // 反序列化时，将数组转换回 Set
      deserialize: (str: string) => {
        const parsed = JSON.parse(str);
        return {
          ...parsed,
          permanentlyDeletedFolderIds: new Set(parsed.permanentlyDeletedFolderIds || []),
        };
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        
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

