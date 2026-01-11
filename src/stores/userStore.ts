import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getApiBaseUrlDynamic } from '../config/api';
import { logger } from '../utils/logger';
import { useDataStore } from './dataStore';
import { useMessageStore } from './messageStore';
import { useSettingsStore } from './settingsStore';

// 辅助函数：动态获取API地址
const getApiUrl = (endpoint: string) => {
  const baseUrl = getApiBaseUrlDynamic();
  return `${baseUrl}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
};

interface User {
  id: string;
  email: string;
  username: string;
  createdAt: string;
  avatar?: string;
  isBanned?: boolean;
  bannedAt?: string | null;
  banReason?: string | null;
}

interface UserState {
  currentUser: User | null;
  token: string | null;
  refreshToken: string | null;
  login: (email: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  refreshAccessToken: () => Promise<{ ok: boolean; message?: string }>;
  registerWithEmail: (data: {
    email: string;
    username: string;
    password: string;
    code: string;
  }) => Promise<{ ok: boolean; message?: string }>;
  sendRegisterCode: (email: string) => Promise<{ ok: boolean; message?: string }>;
  changePassword: (
    email: string,
    newPassword: string,
    code: string
  ) => Promise<{ ok: boolean; message?: string }>;
  logout: () => void;
  isAuthenticated: () => boolean;
  isBanned: () => boolean;
  checkBanStatus: () => Promise<boolean | 'unbanned' | false>;
  updateAvatar: (avatar: string) => Promise<void>;
  updateUsername: (username: string) => Promise<void>;
  deleteAccount: () => Promise<{ ok: boolean; message?: string }>;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      token: null,
      refreshToken: null,

      login: async (email: string, password: string) => {
        try {
          const loginUrl = getApiUrl('/auth/login');
          logger.log('[userStore] 登录请求:', { url: loginUrl, email, hostname: window.location.hostname });
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
          
          let res: Response;
          try {
            res = await fetch(loginUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password }),
              signal: controller.signal,
            });
            clearTimeout(timeoutId);
          } catch (fetchError: unknown) {
            clearTimeout(timeoutId);
            logger.error('[userStore] 登录请求失败:', {
              error: fetchError,
              url: loginUrl,
              hostname: window.location.hostname,
              origin: window.location.origin
            });
            
            if (fetchError instanceof Error && fetchError.name === 'AbortError') {
              return { ok: false, message: '请求超时，请检查网络连接' };
            }
            
            // 网络错误，提供更详细的错误信息
            if (fetchError instanceof TypeError && fetchError.message.includes('Failed to fetch')) {
              return { 
                ok: false, 
                message: `网络连接失败。请检查：\n1. 后端服务是否运行在 ${getApiBaseUrlDynamic()}\n2. 手机和电脑是否在同一WiFi\n3. 防火墙是否允许访问` 
              };
            }
            
            throw fetchError;
          }

          let data;
          try {
            const text = await res.text();
            logger.log('[userStore] 服务器响应文本:', text.substring(0, 200));
            if (!text || text.trim() === '') {
              logger.error('[userStore] 服务器返回空响应');
              return { ok: false, message: '服务器返回空响应，请检查后端服务是否正常运行' };
            }
            data = JSON.parse(text);
          } catch (e) {
            logger.error('[userStore] JSON解析失败:', e);
            return { ok: false, message: '服务器响应格式错误。可能原因：\n1. 后端服务未运行或崩溃\n2. 数据库连接失败\n3. 后端未部署最新代码' };
          }

          if (!res.ok) {
            return { ok: false, message: data.message || '登录失败' };
          }

          // ========== 止血级修复：登录时完全清空所有前端状态 ==========
          logger.log('[userStore] 登录成功，清空所有前端状态（止血级修复）');
          
          // 1. 清空所有 localStorage（包括所有 piccco-* 存储）
          const keysToRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('piccco-')) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach(key => {
            logger.log('[userStore] 清除 localStorage:', key);
            localStorage.removeItem(key);
          });
          
          // 2. 清空所有 store 状态
          useDataStore.setState({
            folders: [],
            notes: [],
            urls: [],
            trash: [],
            permanentlyDeletedFolderIds: new Set(),
            pendingChanges: false,
            isUploading: false,
            isDownloading: false,
            lastSyncTime: null,
            syncError: null,
            syncSuccess: false,
            syncRetryCount: 0,
            lastRetryTime: null,
          });
          
          useMessageStore.setState({
            messages: [],
          });
          
          // 清空首页内容
          const { useHomeContentStore } = await import('./homeContentStore');
          useHomeContentStore.setState({
            content: '',
            isTyping: false,
            lastSavedTime: 0,
          });
          
          // 3. 设置用户信息
          set({
            currentUser: data.user,
            token: data.token,
            refreshToken: data.refreshToken || null,
          });

          // 4. 登录后只从服务器拉取数据（完全覆盖，不合并）
          logger.log('[userStore] 登录后从服务器拉取完整数据（完全覆盖本地）');
          setTimeout(async () => {
            const dataStore = useDataStore.getState();
            // 强制优先使用服务器数据，完全覆盖本地
            await dataStore.syncDataFromServer(0, true);
            
            // 加载设置
            useSettingsStore.getState().loadSettingsFromServer();
          }, 500);

          return { ok: true };
        } catch (e) {
          logger.error('[userStore] login error:', e);
          return { ok: false, message: '网络错误，请稍后重试' };
        }
      },

      registerWithEmail: async ({
        email,
        username,
        password,
        code,
      }: {
        email: string;
        username: string;
        password: string;
        code: string;
      }) => {
        try {
          const res = await fetch(getApiUrl('/auth/register'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, username, password, code }),
          });

          // 检查响应是否成功
          if (!res.ok) {
            // 尝试解析错误消息
            try {
              const data = await res.json();
              return { ok: false, message: data.message || '注册失败' };
            } catch (e) {
              // 如果无法解析JSON，返回状态码相关的错误
              return { ok: false, message: `注册失败 (${res.status})` };
            }
          }

          const data = await res.json();

          // ========== 止血级修复：注册时完全清空所有前端状态 ==========
          logger.log('[userStore] 新用户注册，清空所有前端状态（止血级修复）');
          
          // 1. 清空所有 localStorage
          const keysToRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('piccco-')) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach(key => {
            logger.log('[userStore] 清除 localStorage:', key);
            localStorage.removeItem(key);
          });
          
          // 2. 清空所有 store 状态
          useDataStore.setState({
            folders: [],
            notes: [],
            urls: [],
            trash: [],
            permanentlyDeletedFolderIds: new Set(),
            pendingChanges: false,
            isUploading: false,
            isDownloading: false,
            lastSyncTime: null,
            syncError: null,
            syncSuccess: false,
            syncRetryCount: 0,
            lastRetryTime: null,
          });
          
          useMessageStore.setState({
            messages: [],
          });
          
          // 清空首页内容
          const { useHomeContentStore } = await import('./homeContentStore');
          useHomeContentStore.setState({
            content: '',
            isTyping: false,
            lastSavedTime: 0,
          });

          set({
            currentUser: data.user,
            token: data.token,
            refreshToken: data.refreshToken || null,
          });

          // 3. 注册后只从服务器拉取数据（完全覆盖）
          logger.log('[userStore] 注册后从服务器拉取完整数据（完全覆盖本地）');
          setTimeout(async () => {
            const dataStore = useDataStore.getState();
            await dataStore.syncDataFromServer(0, true);
            useSettingsStore.getState().loadSettingsFromServer();
          }, 500);

          return { ok: true };
        } catch (e) {
          logger.error('[userStore] register error:', e);
          return { ok: false, message: '网络错误，请稍后重试' };
        }
      },

      sendRegisterCode: async (email: string) => {
        try {
          const res = await fetch(getApiUrl('/auth/send-code'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
          });

          const data = await res.json();

          if (!res.ok) {
            return { ok: false, message: data.message || '发送验证码失败' };
          }

          return { ok: true };
        } catch (e) {
          logger.error('[userStore] send code error:', e);
          return { ok: false, message: '网络错误，请稍后重试' };
        }
      },

      changePassword: async (email: string, newPassword: string, code: string) => {
        try {
          const res = await fetch(getApiUrl('/auth/change-password'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, newPassword, code }),
          });

          const data = await res.json();

          if (!res.ok) {
            return { ok: false, message: data.message || '修改密码失败' };
          }

          return { ok: true };
        } catch (e) {
          logger.error('[userStore] change password error:', e);
          return { ok: false, message: '网络错误，请稍后重试' };
        }
      },

      refreshAccessToken: async () => {
        const refreshToken = get().refreshToken;
        if (!refreshToken) {
          return { ok: false, message: '没有刷新Token' };
        }
        
        try {
          const res = await fetch(getApiUrl('/auth/refresh-token'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          });
          
          let data;
          try {
            data = await res.json();
          } catch (e) {
            logger.error('[userStore] JSON解析失败:', e);
            return { ok: false, message: '服务器响应格式错误' };
          }
          
          if (!res.ok) {
            return { ok: false, message: data.message || '刷新Token失败' };
          }
          
          set({
            token: data.token,
            refreshToken: data.refreshToken || refreshToken,
          });
          
          return { ok: true };
        } catch (e) {
          logger.error('[userStore] refresh token error:', e);
          return { ok: false, message: '网络错误，请稍后重试' };
        }
      },
      
      logout: () => {
        // ========== 止血级修复：登出时完全清空所有前端状态 ==========
        logger.log('[userStore] 登出，清空所有前端状态（止血级修复）');
        
        // 1. 清空所有 localStorage
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('piccco-')) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => {
          logger.log('[userStore] 清除 localStorage:', key);
          localStorage.removeItem(key);
        });
        
        // 2. 清空所有 store 状态
        useDataStore.setState({
          folders: [],
          notes: [],
          urls: [],
          trash: [],
          permanentlyDeletedFolderIds: new Set(),
          pendingChanges: false,
          isUploading: false,
          isDownloading: false,
          lastSyncTime: null,
          syncError: null,
          syncSuccess: false,
          syncRetryCount: 0,
          lastRetryTime: null,
        });
        
        useMessageStore.setState({
          messages: [],
        });
        
        // 清空首页内容
        import('./homeContentStore').then(({ useHomeContentStore }) => {
          useHomeContentStore.setState({
            content: '',
            isTyping: false,
            lastSavedTime: 0,
          });
        });
        
        set({
          currentUser: null,
          token: null,
          refreshToken: null,
        });
      },

      isAuthenticated: () => {
        const state = get();
        return !!state.token && !!state.currentUser;
      },

      isBanned: () => {
        const state = get();
        return state.currentUser?.isBanned === true;
      },

      checkBanStatus: async () => {
        const state = get();
        if (!state.currentUser?.id || !state.token) {
          return false;
        }
        
        try {
          const res = await fetch(getApiUrl('/auth/me'), {
            headers: {
              'Authorization': `Bearer ${state.token}`,
            },
          });
          
          // ========== 止血级修复：401时自动登出并清空所有状态 ==========
          if (res.status === 401 || res.status === 403) {
            logger.warn('[userStore] Token失效或用户不存在（401/403），自动登出并清空所有状态');
            get().logout(); // 使用 logout 方法清空所有状态
            // 跳转到登录页
            if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
              window.location.href = '/login';
            }
            return false;
          }
          
          if (res.ok) {
            const data = await res.json();
            const wasBanned = state.currentUser?.isBanned === true;
            const isNowBanned = data.user?.isBanned === true;
            
            if (isNowBanned) {
              // 用户被封禁，清除登录状态
              logger.warn('[userStore] 用户被封禁，自动登出');
              get().logout();
              return true;
            }
            
            // 更新用户信息（包括解封、头像、用户名等所有字段）
            if (data.user) {
              const updatedUser = {
                ...state.currentUser,
                // 更新所有可能变化的字段
                // 一切以服务器为准：优先使用服务器数据
                username: data.user.username ?? state.currentUser?.username,
                avatar: data.user.avatar ?? state.currentUser?.avatar,
                email: data.user.email ?? state.currentUser?.email,
                isBanned: data.user.isBanned || false,
                bannedAt: data.user.bannedAt || null,
                banReason: data.user.banReason || null,
                createdAt: data.user.createdAt || state.currentUser?.createdAt,
              };
              set({
                currentUser: updatedUser,
              });
              
              // 如果用户从封禁状态变为解封状态，返回特殊标记
              if (wasBanned && !isNowBanned) {
                return 'unbanned';
              }
            }
          }
        } catch (e) {
          logger.error('[userStore] check ban status error:', e);
        }
        return false;
      },

      updateAvatar: async (avatar: string) => {
        const state = get();
        if (!state.currentUser || !state.token) {
          return;
        }

        try {
          const res = await fetch(getApiUrl('/auth/me'), {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${state.token}`,
            },
            body: JSON.stringify({ avatar }),
          });

          if (res.ok) {
            const data = await res.json();
            if (data.user) {
              set({
                currentUser: { ...state.currentUser, avatar: data.user.avatar } as User,
              });
            } else {
              // 如果后端没有返回用户信息，只更新本地状态
              set({
                currentUser: { ...state.currentUser, avatar } as User,
              });
            }
          } else {
            const error = await res.json().catch(() => ({ message: '更新头像失败' }));
            logger.error('[userStore] updateAvatar error:', error);
            // 即使失败也更新本地状态，保证UI响应
            set({
              currentUser: { ...state.currentUser, avatar } as User,
            });
          }
        } catch (e) {
          logger.error('[userStore] updateAvatar error:', e);
          // 即使失败也更新本地状态，保证UI响应
          set({
            currentUser: { ...state.currentUser, avatar } as User,
          });
        }
      },

      updateUsername: async (username: string) => {
        const state = get();
        if (!state.currentUser || !state.token) {
          logger.error('[userStore] updateUsername: 用户未登录或token不存在');
          return;
        }

        try {
          const url = getApiUrl('/auth/me');
          logger.log('[userStore] 更新用户名，请求URL:', url);
          logger.log('[userStore] 请求数据:', { username });
          
          const res = await fetch(url, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${state.token}`,
            },
            body: JSON.stringify({ username }),
          });

          logger.log('[userStore] 更新用户名响应状态:', res.status);

          if (res.ok) {
            const data = await res.json();
            logger.log('[userStore] 更新用户名成功，返回数据:', data);
            if (data.user) {
              set({
                currentUser: { ...state.currentUser, username: data.user.username } as User,
              });
            } else {
              // 如果后端没有返回用户信息，只更新本地状态
              logger.warn('[userStore] 后端未返回用户信息，仅更新本地状态');
              set({
                currentUser: { ...state.currentUser, username } as User,
              });
            }
          } else {
            const errorText = await res.text();
            let error;
            try {
              error = JSON.parse(errorText);
            } catch {
              error = { message: errorText || '更新用户名失败' };
            }
            logger.error('[userStore] updateUsername error:', {
              status: res.status,
              statusText: res.statusText,
              error,
            });
            alert(error.message || `更新用户名失败 (${res.status})`);
            // 失败时不更新本地状态，保持原值
          }
        } catch (e) {
          logger.error('[userStore] updateUsername network error:', e);
          const errorMessage = e instanceof Error ? e.message : '未知错误';
          alert(`网络错误，无法更新用户名: ${errorMessage}`);
          // 失败时不更新本地状态，保持原值
        }
      },

      deleteAccount: async () => {
        try {
          const state = get();
          if (!state.token) {
            return { ok: false, message: '未登录' };
          }

          const deleteUrl = getApiUrl('/auth/account');
          logger.log('[userStore] 开始注销账户，API:', deleteUrl);

          const res = await fetch(deleteUrl, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${state.token}`,
              'Content-Type': 'application/json',
            },
          });

          logger.log('[userStore] 注销账户响应状态:', res.status, res.statusText);

          // 检查响应是否成功
          if (!res.ok) {
            // 尝试解析错误消息
            try {
              const data = await res.json();
              logger.log('[userStore] 注销账户错误响应:', data);
              return { ok: false, message: data.message || '注销账户失败' };
            } catch (e) {
              // 如果无法解析JSON，返回状态码相关的错误
              logger.error('[userStore] 解析错误响应失败:', e);
              return { ok: false, message: `注销账户失败 (${res.status})` };
            }
          }

          const data = await res.json();
          logger.log('[userStore] 注销账户成功:', data);

          // ========== 止血级修复：注销账号时完全清空所有前端状态 ==========
          logger.log('[userStore] 注销账号成功，清空所有前端状态（止血级修复）');
          
          // 使用 logout 方法清空所有状态
          get().logout();

          return { ok: true, message: '账户注销成功' };
        } catch (e) {
          logger.error('[userStore] delete account error:', e);
          const errorMessage = e instanceof Error ? e.message : '未知错误';
          return { ok: false, message: `网络错误：${errorMessage}，请稍后重试` };
        }
      },
    }),
    {
      name: 'piccco-user-storage',
    }
  )
);

