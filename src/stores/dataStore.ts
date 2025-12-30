import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Folder, Note, Url, TrashItem, FolderColor } from '../types';
import { useUserStore } from './userStore';
import { API_BASE_URL } from '../config/api';
import { syncQueue } from '../utils/syncQueue';
import { encryptPrivacyPassword, verifyPrivacyPassword } from '../utils/privacyPassword';

interface DataState {
  folders: Folder[];
  notes: Note[];
  urls: Url[];
  trash: TrashItem[];
  
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
  deleteFolder: (id: string) => void;
  toggleFolderStar: (id: string) => void;
  changeFolderColor: (id: string, color: FolderColor) => void;
  reorderFolder: (dragId: string, targetId: string) => void;
  
  // 记事操作
  addNote: (content: string, folderId?: string) => string;
  updateNote: (id: string, content: string) => void;
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
  syncDataFromServer: (retryCount?: number) => Promise<void>;
  syncDataToServer: () => Promise<void>;
  getLastSyncTime: () => number | null;
  setLastSyncTime: (time: number | null) => void;
  clearSyncError: () => void;
  handleSyncRetry: (type: 'download' | 'upload', errorMessage: string) => Promise<void>;
}

const TRASH_EXPIRY_DAYS = 30;
const TRASH_EXPIRY_MS = TRASH_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

// 合并数组（保留最新的数据）
/**
 * 智能合并单个数据项（字段级别合并）
 * 如果时间戳接近（1秒内），合并字段；否则保留时间戳更新的版本
 */
function mergeItem<T extends { id: string; updatedAt?: number; deletedAt?: number }>(
  local: T,
  server: T,
  timeField: 'updatedAt' | 'deletedAt' = 'updatedAt'
): T {
  const localTime = local[timeField] || 0;
  const serverTime = server[timeField] || 0;
  const timeDiff = Math.abs(localTime - serverTime);
  
  // 如果时间戳相同或接近（1秒内），合并字段（保留所有非空值）
  if (timeDiff < 1000) {
    // 合并策略：服务器数据为基础，本地数据覆盖（保留本地更新的字段）
    const merged: Partial<T> = { ...server };
    (Object.keys(local) as Array<keyof T>).forEach((key) => {
      const localValue = local[key];
      const serverValue = server[key];
      // 如果本地值不为空且与服务器值不同，使用本地值
      if (localValue !== null && localValue !== undefined && localValue !== serverValue) {
        merged[key] = localValue;
      }
    });
    // 确保时间戳使用较大的值
    if (localTime > serverTime) {
      merged[timeField] = localTime as T[typeof timeField];
    }
    return merged as T;
  }
  
  // 否则保留时间戳更新的版本
  return localTime > serverTime ? local : server;
}

/**
 * 合并数组（改进的冲突处理）
 */
function mergeArrays<T extends { id: string; updatedAt?: number; deletedAt?: number }>(
  local: T[],
  server: T[],
  timeField: 'updatedAt' | 'deletedAt' = 'updatedAt'
): T[] {
  const map = new Map<string, T>();
  
  // 先添加服务器数据
  server.forEach((item) => {
    map.set(item.id, item);
  });
  
  // 再添加本地数据，使用智能合并
  local.forEach((item) => {
    const existing = map.get(item.id);
    if (!existing) {
      // 本地有但服务器没有，添加本地数据
      map.set(item.id, item);
    } else {
      // 两者都有，使用智能合并
      const merged = mergeItem(item, existing, timeField);
      map.set(item.id, merged);
    }
  });
  
  return Array.from(map.values());
}

// 防抖同步函数（避免频繁请求）
let uploadSyncTimer: ReturnType<typeof setTimeout> | null = null;

function debouncedUploadSync(syncFn: () => void, delay: number = 1500) {
  if (uploadSyncTimer) {
    clearTimeout(uploadSyncTimer);
  }
  uploadSyncTimer = setTimeout(() => {
    syncFn();
    uploadSyncTimer = null;
  }, delay);
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
            console.warn('[dataStore] 密码加密失败，使用明文:', e);
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
        };
        set((state) => ({
          folders: [...state.folders, newFolder],
        }));
        
        // 标记有变更，自动同步到服务器（防抖）
        set({ pendingChanges: true });
        debouncedUploadSync(() => get().syncDataToServer(), 1500);
        
        return id;
      },
      
      updateFolder: (id, updates) => {
        if (checkBanned()) return;
        
        // 如果更新包含密码，需要加密
        const processedUpdates = { ...updates };
        if (updates.password && typeof updates.password === 'string') {
          processedUpdates.password = encryptPrivacyPassword(updates.password);
        }
        
        set((state) => ({
          folders: state.folders.map((f) =>
            f.id === id ? { ...f, ...processedUpdates, updatedAt: Date.now() } : f
          ),
        }));
        
        // 标记有变更，自动同步到服务器（防抖）
        set({ pendingChanges: true });
        debouncedUploadSync(() => get().syncDataToServer(), 1500);
      },
      
      deleteFolder: (id) => {
        if (checkBanned()) return;
        const folder = get().folders.find((f) => f.id === id);
        if (!folder) return;
        
        // 隐私文件夹不能被删除
        if (folder.type === 'privacy') {
          console.warn('隐私文件夹不能被删除');
          return;
        }
        
        // 移动到回收站
        const trashItem: TrashItem = {
          id: `trash_${Date.now()}`,
          type: 'folder',
          data: folder,
          deletedAt: Date.now(),
        };
        
        set((state) => ({
          folders: state.folders.filter((f) => f.id !== id),
          trash: [...state.trash, trashItem],
        }));
        
        // 标记有变更，自动同步到服务器（防抖）
        set({ pendingChanges: true });
        debouncedUploadSync(() => get().syncDataToServer(), 1500);
      },
      
      toggleFolderStar: (id) => {
        if (checkBanned()) return;
        set((state) => ({
          folders: state.folders.map((f) =>
            f.id === id ? { ...f, isStarred: !f.isStarred, updatedAt: Date.now() } : f
          ),
        }));
        
        // 标记有变更，自动同步到服务器（防抖）
        set({ pendingChanges: true });
        debouncedUploadSync(() => get().syncDataToServer(), 1500);
      },
      
      changeFolderColor: (id, color) => {
        if (checkBanned()) return;
        set((state) => ({
          folders: state.folders.map((f) =>
            f.id === id ? { ...f, color, updatedAt: Date.now() } : f
          ),
        }));
        
        // 标记有变更，自动同步到服务器（防抖）
        set({ pendingChanges: true });
        debouncedUploadSync(() => get().syncDataToServer(), 1500);
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
        
        // 标记有变更，自动同步到服务器（防抖）
        set({ pendingChanges: true });
        debouncedUploadSync(() => get().syncDataToServer(), 1500);
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
        };
        set((state) => ({
          notes: [...state.notes, newNote],
        }));
        
        // 标记有变更，自动同步到服务器（防抖）
        set({ pendingChanges: true });
        debouncedUploadSync(() => get().syncDataToServer(), 1500);
        
        return id;
      },
      
      updateNote: (id, content) => {
        if (checkBanned()) return;
        set((state) => ({
          notes: state.notes.map((n) =>
            n.id === id ? { ...n, content, updatedAt: Date.now() } : n
          ),
        }));
        
        // 标记有变更，自动同步到服务器（防抖）
        set({ pendingChanges: true });
        debouncedUploadSync(() => get().syncDataToServer(), 1500);
      },
      
      deleteNote: (id) => {
        if (checkBanned()) return;
        const note = get().notes.find((n) => n.id === id);
        if (!note) return;
        
        const trashItem: TrashItem = {
          id: `trash_${Date.now()}`,
          type: 'note',
          data: note,
          deletedAt: Date.now(),
        };
        
        set((state) => ({
          notes: state.notes.filter((n) => n.id !== id),
          trash: [...state.trash, trashItem],
        }));
        
        // 标记有变更，自动同步到服务器（防抖）
        set({ pendingChanges: true });
        debouncedUploadSync(() => get().syncDataToServer(), 1500);
      },
      
      toggleNoteStar: (id) => {
        if (checkBanned()) return;
        set((state) => ({
          notes: state.notes.map((n) =>
            n.id === id ? { ...n, isStarred: !n.isStarred, updatedAt: Date.now() } : n
          ),
        }));
        
        // 标记有变更，自动同步到服务器（防抖）
        set({ pendingChanges: true });
        debouncedUploadSync(() => get().syncDataToServer(), 1500);
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
        };
        set((state) => ({
          urls: [...state.urls, newUrl],
        }));
        
        // 标记有变更，自动同步到服务器（防抖）
        set({ pendingChanges: true });
        debouncedUploadSync(() => get().syncDataToServer(), 1500);
        
        return id;
      },
      
      updateUrl: (id, updates) => {
        if (checkBanned()) return;
        set((state) => ({
          urls: state.urls.map((u) =>
            u.id === id ? { ...u, ...updates, updatedAt: Date.now() } : u
          ),
        }));
        
        // 标记有变更，自动同步到服务器（防抖）
        set({ pendingChanges: true });
        debouncedUploadSync(() => get().syncDataToServer(), 1500);
      },
      
      deleteUrl: (id) => {
        if (checkBanned()) return;
        const url = get().urls.find((u) => u.id === id);
        if (!url) return;
        
        const trashItem: TrashItem = {
          id: `trash_${Date.now()}`,
          type: 'url',
          data: url,
          deletedAt: Date.now(),
        };
        
        set((state) => ({
          urls: state.urls.filter((u) => u.id !== id),
          trash: [...state.trash, trashItem],
        }));
        
        // 标记有变更，自动同步到服务器（防抖）
        set({ pendingChanges: true });
        debouncedUploadSync(() => get().syncDataToServer(), 1500);
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
        const trashItem = get().trash.find((t) => t.id === id);
        if (!trashItem) return;
        
        set((state) => {
          const newTrash = state.trash.filter((t) => t.id !== id);
          
          if (trashItem.type === 'note') {
            return {
              trash: newTrash,
              notes: [...state.notes, trashItem.data as Note],
            };
          } else if (trashItem.type === 'url') {
            return {
              trash: newTrash,
              urls: [...state.urls, trashItem.data as Url],
            };
          } else {
            return {
              trash: newTrash,
              folders: [...state.folders, trashItem.data as Folder],
            };
          }
        });
        
        // 标记有变更，自动同步到服务器（防抖）
        set({ pendingChanges: true });
        debouncedUploadSync(() => get().syncDataToServer(), 1500);
      },
      
      permanentlyDelete: (id) => {
        set((state) => ({
          trash: state.trash.filter((t) => t.id !== id),
        }));
        
        // 标记有变更，自动同步到服务器（防抖）
        set({ pendingChanges: true });
        debouncedUploadSync(() => get().syncDataToServer(), 1500);
      },
      
      cleanExpiredTrash: () => {
        const now = Date.now();
        set((state) => ({
          trash: state.trash.filter((t) => now - t.deletedAt < TRASH_EXPIRY_MS),
        }));
        
        // 标记有变更，自动同步到服务器（防抖）
        set({ pendingChanges: true });
        debouncedUploadSync(() => get().syncDataToServer(), 1500);
      },
      
      getNotesByFolder: (folderId) => {
        const { notes } = get();
        if (!folderId) {
          return notes.filter((n) => !n.folderId);
        }
        return notes.filter((n) => n.folderId === folderId);
      },
      
      getUrlsByFolder: (folderId) => {
        const { urls } = get();
        if (!folderId) {
          return urls.filter((u) => !u.folderId);
        }
        return urls.filter((u) => u.folderId === folderId);
      },
      
      getAllNotes: (excludePrivacy = true) => {
        const { notes, folders } = get();
        if (!excludePrivacy) {
          return notes;
        }
        const privacyFolderIds = folders
          .filter((f) => f.type === 'privacy')
          .map((f) => f.id);
        return notes.filter((n) => !n.folderId || !privacyFolderIds.includes(n.folderId));
      },
      
      getFolderById: (id) => {
        return get().folders.find((f) => f.id === id);
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
      
      syncDataFromServer: async (retryCount: number = 0) => {
        // 使用同步队列确保操作串行执行
        return syncQueue.add(async () => {
          const MAX_RETRIES = 3;
          
          // 如果正在下载，跳过
          if (get().isDownloading) {
            console.log('[dataStore] 正在下载数据，跳过此次同步');
            return;
          }
          
          // 如果正在上传，等待上传完成（但限制重试次数）
          if (get().isUploading) {
            if (retryCount >= MAX_RETRIES) {
              console.warn('[dataStore] 上传等待超时，取消同步');
              return;
            }
            console.log('[dataStore] 正在上传数据，等待完成后同步');
            // 延迟重试
            await new Promise(resolve => setTimeout(resolve, 2000));
            return get().syncDataFromServer(retryCount + 1);
          }
          
          try {
            set({ isDownloading: true });
          
          const { currentUser, token } = useUserStore.getState();
          if (!currentUser || !token) {
            console.warn('[dataStore] 未登录，无法同步数据');
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
                result = await res.json();
              } catch (e) {
                console.error('[dataStore] JSON解析失败:', e);
                set({ isDownloading: false });
                return;
              }
              
              if (result.success && result.data) {
                const serverData = result.data;
                
                // 验证数据格式
                if (!Array.isArray(serverData.folders) || 
                    !Array.isArray(serverData.notes) || 
                    !Array.isArray(serverData.urls) || 
                    !Array.isArray(serverData.trash)) {
                  console.error('[dataStore] 服务器数据格式不正确');
                  set({ isDownloading: false });
                  return;
                }
                
                // 合并服务器数据和本地数据
                // 使用服务器数据为主，但保留本地未同步的数据
                const localData = get();
                
                // 合并策略：服务器数据优先，但保留本地更新的数据（通过时间戳判断）
                const mergedFolders = mergeArrays(localData.folders, serverData.folders || [], 'updatedAt');
                const mergedNotes = mergeArrays(localData.notes, serverData.notes || [], 'updatedAt');
                const mergedUrls = mergeArrays(localData.urls, serverData.urls || [], 'updatedAt');
                const mergedTrash = mergeArrays(localData.trash, serverData.trash || [], 'deletedAt');
                
                set({
                  folders: mergedFolders,
                  notes: mergedNotes,
                  urls: mergedUrls,
                  trash: mergedTrash,
                  lastSyncTime: serverData.lastSyncAt || Date.now(),
                  isDownloading: false,
                  syncError: null,
                  syncSuccess: true,
                  syncRetryCount: 0, // 重置重试计数
                  lastRetryTime: null,
                });
                
                console.log('[dataStore] 数据同步成功');
                
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
                // 刷新成功，重试同步
                console.log('[dataStore] Token已刷新，重试同步');
                return get().syncDataFromServer();
              } else {
                // 刷新失败，清除登录状态
                console.warn('[dataStore] Token无效且刷新失败，清除登录状态');
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
          } catch (fetchError: any) {
            clearTimeout(timeoutId);
            let errorMessage = '网络错误，请检查网络连接';
            if (fetchError.name === 'AbortError') {
              errorMessage = '请求超时，请检查网络连接';
              console.error('[dataStore] 请求超时');
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
          console.error('[dataStore] 同步数据失败:', e);
          const errorMessage = e instanceof Error ? e.message : '同步失败，请稍后重试';
          set({ 
            isDownloading: false,
            syncError: errorMessage,
            syncSuccess: false,
          });
        }
        });
      },
      
      syncDataToServer: async () => {
        // 使用同步队列确保操作串行执行
        return syncQueue.add(async () => {
          // 如果正在上传，跳过
          if (get().isUploading) {
            console.log('[dataStore] 正在上传数据，跳过此次同步');
            return;
          }
          
          // 如果没有待同步的变更，跳过
          if (!get().pendingChanges && get().lastSyncTime) {
            const timeSinceLastSync = Date.now() - (get().lastSyncTime || 0);
            if (timeSinceLastSync < 5000) {
              console.log('[dataStore] 数据无变化且最近已同步，跳过');
              return;
            }
          }
          
          try {
            set({ isUploading: true, pendingChanges: false });
            
            const { currentUser, token } = useUserStore.getState();
            if (!currentUser || !token) {
              console.warn('[dataStore] 未登录，无法同步数据');
              set({ isUploading: false });
              return;
            }
            
            const state = get();
            const dataToSync = {
              folders: state.folders || [],
              notes: state.notes || [],
              urls: state.urls || [],
              trash: state.trash || [],
            };
            
            // 使用AbortController实现超时
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
            
            try {
              const res = await fetch(`${API_BASE_URL}/data/sync`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(dataToSync),
                signal: controller.signal,
              });
              
              clearTimeout(timeoutId);
              
              if (res.ok) {
                let result;
                try {
                  result = await res.json();
                } catch (e) {
                  console.error('[dataStore] JSON解析失败:', e);
                  set({ isUploading: false, pendingChanges: true });
                  return;
                }
                
                if (result.success) {
                  set({
                    lastSyncTime: result.data?.lastSyncAt || Date.now(),
                    isUploading: false,
                    pendingChanges: false,
                    syncError: null,
                    syncSuccess: true,
                    syncRetryCount: 0, // 重置重试计数
                    lastRetryTime: null,
                  });
                  console.log('[dataStore] 数据已同步到服务器');
                  
                  // 3秒后清除成功状态
                  setTimeout(() => {
                    set({ syncSuccess: false });
                  }, 3000);
                } else {
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
                  console.log('[dataStore] Token已刷新，重试同步');
                  return get().syncDataToServer();
                } else {
                  // 刷新失败，清除登录状态
                  console.warn('[dataStore] Token无效且刷新失败，清除登录状态');
                  set({ 
                    isUploading: false,
                    syncError: '登录已过期，请重新登录',
                    syncSuccess: false,
                  });
                  useUserStore.getState().logout();
                }
              } else {
                let errorData = {};
                try {
                  errorData = await res.json();
                } catch (e) {
                  // 忽略JSON解析错误
                }
                const errorMessage = (errorData as any).message || '同步失败，请稍后重试';
                console.error('[dataStore] 同步失败:', errorMessage);
                // 同步失败，触发自动重试
                await get().handleSyncRetry('upload', errorMessage);
              }
            } catch (fetchError: any) {
              clearTimeout(timeoutId);
              let errorMessage = '网络错误，请检查网络连接';
              if (fetchError.name === 'AbortError') {
                errorMessage = '请求超时，请检查网络连接';
                console.error('[dataStore] 请求超时');
              } else {
                console.error('[dataStore] 同步数据到服务器失败:', fetchError);
              }
              // 同步失败，触发自动重试
              await get().handleSyncRetry('upload', errorMessage);
            }
          } catch (e) {
            console.error('[dataStore] 同步数据到服务器失败:', e);
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
        
        set({ 
          isDownloading: false,
          isUploading: false,
          syncError: `${errorMessage}（${delay / 1000}秒后重试...）`,
          syncSuccess: false,
          syncRetryCount: currentRetryCount + 1,
          lastRetryTime: Date.now(),
        });
        
        // 延迟后重试
        setTimeout(async () => {
          if (type === 'download') {
            await get().syncDataFromServer();
          } else {
            await get().syncDataToServer();
          }
        }, delay);
      },
    }),
    {
      name: 'piccco-data-storage',
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
              console.log('[dataStore] 检测到新用户首次登录（登录时间:', timeSinceLogin, 'ms前），清空回收站');
              state.trash = [];
            }
          }
        }
        
        // 强制确保新用户的回收站为空
        if (isNewUser) {
          console.log('[dataStore] 新用户首次登录，强制清空回收站');
          state.trash = [];
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
              console.log('[dataStore] 检测到只有默认文件夹，清空回收站');
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
              console.log('[dataStore] 新用户首次登录（登录时间:', Math.round(timeSinceLogin / 1000), '秒前），强制清空回收站');
              state.trash = [];
            }
          }
        }
        
        // 如果状态为空或没有文件夹，或者是新用户，初始化默认文件夹
        if (!state.folders || state.folders.length === 0 || isNewUser) {
          const defaultFolders = initializeDefaultFolders();
          state.folders = defaultFolders;
        } else {
          // 强制去重：只保留这3个默认文件夹，删除所有重复的和其他文件夹
          const defaultFolderIds = [
            'folder_privacy_default',
            'folder_category1_default',
            'folder_category2_default',
          ];
          
          // 使用 Map 来确保每个默认文件夹只保留一个（取第一个遇到的）
          const folderMap = new Map<string, Folder>();
          
          // 先收集所有默认文件夹（按顺序，第一个遇到的保留）
          for (const folder of state.folders) {
            if (defaultFolderIds.includes(folder.id) && !folderMap.has(folder.id)) {
              folderMap.set(folder.id, folder);
            }
          }
          
          // 如果缺少某个默认文件夹，创建它
          const now = Date.now();
          const finalFolders: Folder[] = [];
          
          if (!folderMap.has('folder_privacy_default')) {
            finalFolders.push({
              id: 'folder_privacy_default',
              name: '隐私',
              type: 'privacy',
              color: 'purple',
              isStarred: false,
              order: 0,
              createdAt: now,
              updatedAt: now,
              password: undefined,
            });
          } else {
            finalFolders.push(folderMap.get('folder_privacy_default')!);
          }
          
          if (!folderMap.has('folder_category1_default')) {
            finalFolders.push({
              id: 'folder_category1_default',
              name: '分类1',
              type: 'normal',
              color: 'blue',
              isStarred: false,
              order: 1,
              createdAt: now,
              updatedAt: now,
            });
          } else {
            finalFolders.push(folderMap.get('folder_category1_default')!);
          }
          
          if (!folderMap.has('folder_category2_default')) {
            finalFolders.push({
              id: 'folder_category2_default',
              name: '分类2',
              type: 'normal',
              color: 'green',
              isStarred: false,
              order: 2,
              createdAt: now,
              updatedAt: now,
            });
          } else {
            finalFolders.push(folderMap.get('folder_category2_default')!);
          }
          
          // 只保留这3个默认文件夹，删除所有其他文件夹
          state.folders = finalFolders;
        }
      },
    }
  )
);

