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
  // 统一使用 v1 版本（推荐版本），确保API路径一致性
  // 如果endpoint已经包含 /v1/，不再添加
  if (endpoint.includes('/v1/')) {
    return `${baseUrl}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
  }
  // 如果endpoint是 /auth/、/admin/、/message/、/data/ 开头，添加 /v1 前缀
  if (endpoint.startsWith('/auth/') || endpoint.startsWith('/admin/') || 
      endpoint.startsWith('/message/') || endpoint.startsWith('/data/')) {
    return `${baseUrl}/v1${endpoint}`;
  }
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
  sendRegisterCode: (email: string) => Promise<{ ok: boolean; message?: string; devCode?: string }>;
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

          // 检查是否是新用户或切换用户
          const oldUser = get().currentUser;
          const loginTimeKey = `piccco-login-time-${data.user.id}`;
          const hasLoginRecord = localStorage.getItem(loginTimeKey);
          const isNewUser = !hasLoginRecord;
          const isSwitchingUser = oldUser && oldUser.id !== data.user.id;
          
          // 只有切换用户时才清除旧用户数据，退出登录再登录（同一用户）不清除数据
          if (isSwitchingUser) {
            logger.log('[userStore] 切换用户，清除旧用户数据:', oldUser.id);
            
            // 先清除 localStorage，确保 onRehydrateStorage 不会恢复旧用户数据
            localStorage.removeItem('piccco-data-storage');
            localStorage.removeItem('piccco-message-storage');
            localStorage.removeItem('piccco-home-content-storage'); // 清除首页内容
            
            // 初始化默认文件夹（确保只有3个默认文件夹）
            const defaultFolders = [
              {
                id: 'folder_privacy_default',
                name: '隐私',
                type: 'privacy' as const,
                color: 'purple' as const,
                isStarred: false,
                order: 0,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                password: undefined,
                isDeleted: false,
                deletedAt: null,
              },
              {
                id: 'folder_category1_default',
                name: '分类1',
                type: 'normal' as const,
                color: 'blue' as const,
                isStarred: false,
                order: 1,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                isDeleted: false,
                deletedAt: null,
              },
              {
                id: 'folder_category2_default',
                name: '分类2',
                type: 'normal' as const,
                color: 'green' as const,
                isStarred: false,
                order: 2,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                isDeleted: false,
                deletedAt: null,
              },
            ];
            
            // 重置数据store - 确保回收站为空，文件夹只有3个默认文件夹
            useDataStore.setState({
              folders: defaultFolders,
              notes: [],
              urls: [],
              trash: [],
            });
            
            // 重置消息store
            useMessageStore.setState({
              messages: [],
            });
          } else if (isNewUser) {
            // 新用户首次登录，但不清除可能存在的旧数据（可能是测试数据）
            // 只记录登录时间，让 onRehydrateStorage 判断是否是新用户
            logger.log('[userStore] 新用户首次登录，保留现有数据（如果有）');
          }
          
          // 保存登录时间（无论是否新用户或切换用户）
          if (data.user?.id) {
            const key = `piccco-login-time-${data.user.id}`;
            localStorage.setItem(key, String(Date.now()));
          }

          set({
            currentUser: data.user,
            token: data.token,
            refreshToken: data.refreshToken || null,
          });

          // 保存登录时间（如果之前没有保存）
          if (data.user?.id) {
            const key = `piccco-login-time-${data.user.id}`;
            if (!localStorage.getItem(key)) {
              localStorage.setItem(key, String(Date.now()));
            }
          }

          // 登录后同步数据：优先使用服务器数据，确保多设备数据一致性
          setTimeout(async () => {
            const dataStore = useDataStore.getState();
            
            // 1. 先下载服务器数据（优先使用服务器最新数据）
            // 这样可以确保B设备登录时使用的是服务器上的最新数据，而不是本地旧数据
            logger.log('[userStore] 登录后从服务器下载最新数据（优先使用服务器数据）');
            await dataStore.syncDataFromServer(0, true); // 第二个参数 true 表示优先使用服务器数据
            
            // 2. 合并后，检查是否有本地新数据需要上传
            // 检查逻辑：本地有但服务器没有的数据（新创建的，还未同步）
            const currentState = useDataStore.getState();
            const serverSyncTime = currentState.lastSyncTime || 0;
            
            // 检查本地是否有新创建的数据（createdAt 或 updatedAt 在最后一次同步之后）
            // 或者本地有但服务器没有的数据
            const hasLocalNewData = 
              (currentState.folders || []).some((f: any) => {
                if (f.isDeleted) return false;
                // 检查是否是本地新创建的（没有同步时间戳，或者更新时间在同步时间之后）
                const itemTime = f.updatedAt || f.createdAt || 0;
                return itemTime > serverSyncTime || !serverSyncTime;
              }) ||
              (currentState.notes || []).some((n: any) => {
                if (n.isDeleted) return false;
                const itemTime = n.updatedAt || n.createdAt || 0;
                return itemTime > serverSyncTime || !serverSyncTime;
              }) ||
              (currentState.urls || []).some((u: any) => {
                if (u.isDeleted) return false;
                const itemTime = u.updatedAt || u.createdAt || 0;
                return itemTime > serverSyncTime || !serverSyncTime;
              });
            
            if (hasLocalNewData || currentState.pendingChanges) {
              logger.log('[userStore] 检测到本地新数据，上传到服务器');
              await dataStore.syncDataToServer();
              // 上传后再次同步，确保数据一致（再次以服务器为准）
              await dataStore.syncDataFromServer(0, true);
            }
            
            // 同时加载设置
            useSettingsStore.getState().loadSettingsFromServer();
          }, 1000);

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

          // 新用户注册时，总是清除所有旧数据
          logger.log('[userStore] 新用户注册，清除所有旧数据');
          
          // 先清除 localStorage，确保 onRehydrateStorage 不会恢复旧数据
          localStorage.removeItem('piccco-data-storage');
          localStorage.removeItem('piccco-message-storage');
          localStorage.removeItem('piccco-home-content-storage'); // 清除首页内容
          
          // 初始化默认文件夹（确保只有3个默认文件夹）
          const defaultFolders = [
            {
              id: 'folder_privacy_default',
              name: '隐私',
              type: 'privacy' as const,
              color: 'purple' as const,
              isStarred: false,
              order: 0,
              createdAt: Date.now(),
              updatedAt: Date.now(),
              password: undefined,
              isDeleted: false,
              deletedAt: null,
            },
            {
              id: 'folder_category1_default',
              name: '分类1',
              type: 'normal' as const,
              color: 'blue' as const,
              isStarred: false,
              order: 1,
              createdAt: Date.now(),
              updatedAt: Date.now(),
              isDeleted: false,
              deletedAt: null,
            },
            {
              id: 'folder_category2_default',
              name: '分类2',
              type: 'normal' as const,
              color: 'green' as const,
              isStarred: false,
              order: 2,
              createdAt: Date.now(),
              updatedAt: Date.now(),
              isDeleted: false,
              deletedAt: null,
            },
          ];
            
            // 重置数据store - 确保回收站为空，文件夹只有3个默认文件夹
            useDataStore.setState({
              folders: defaultFolders,
            notes: [],
            urls: [],
            trash: [],
          });
          
          // 重置消息store
          useMessageStore.setState({
            messages: [],
          });
          
          // 先保存登录时间（在设置用户信息之前），确保 onRehydrateStorage 能正确识别新用户
          if (data.user?.id) {
            const key = `piccco-login-time-${data.user.id}`;
            localStorage.setItem(key, String(Date.now()));
          }

          set({
            currentUser: data.user,
            token: data.token,
            refreshToken: data.refreshToken || null,
          });

          // 确保登录时间已保存
          if (data.user?.id) {
            const key = `piccco-login-time-${data.user.id}`;
            if (!localStorage.getItem(key)) {
              localStorage.setItem(key, String(Date.now()));
            }
          }

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

          // 开发模式：如果后端返回了 devCode，在控制台显示
          if (data.devCode) {
            console.log('\n========================================');
            console.log('📧 验证码（开发模式）');
            console.log('========================================');
            console.log(`收件人: ${email}`);
            console.log(`验证码: ${data.devCode}`);
            console.log('有效期: 10 分钟');
            console.log('========================================\n');
          }

          return { ok: true, devCode: data.devCode };
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
        // 退出登录时不清除数据，只清除用户状态
        // 重要：不清除 piccco-login-time，这样重新登录时能识别是同一用户，不会误判为新用户
        // 也不清除 piccco-data-storage 和 piccco-message-storage，数据会保留在 localStorage 中
        // 只有在切换用户时才会清除旧用户的数据（在 login 函数中处理）
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
          
          // 如果返回401（用户不存在或已被注销），清除登录状态并退出
          if (res.status === 401) {
            logger.warn('[userStore] 用户不存在或已被注销，自动退出登录');
            set({
              currentUser: null,
              token: null,
              refreshToken: null,
            });
            // 清除所有本地存储
            localStorage.removeItem('piccco-data-storage');
            localStorage.removeItem('piccco-message-storage');
            localStorage.removeItem('piccco-user-storage');
            localStorage.removeItem('piccco-home-content-storage'); // 清除首页内容
            return true;
          }
          
          if (res.ok) {
            const data = await res.json();
            const wasBanned = state.currentUser?.isBanned === true;
            const isNowBanned = data.user?.isBanned === true;
            
            if (isNowBanned) {
              // 用户被封禁，清除登录状态
        set({
          currentUser: null,
          token: null,
          refreshToken: null,
        });
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

          // 注销成功，清除所有数据并初始化
          const currentUser = state.currentUser;
          if (currentUser?.id) {
            // 清除登录时间记录
            localStorage.removeItem(`piccco-login-time-${currentUser.id}`);
          }

          // 清除所有本地存储
          localStorage.removeItem('piccco-data-storage');
          localStorage.removeItem('piccco-message-storage');
          localStorage.removeItem('piccco-user-storage');

          // 初始化默认文件夹
          const defaultFolders = [
            {
              id: 'folder_privacy_default',
              name: '隐私',
              type: 'privacy' as const,
              color: 'purple' as const,
              isStarred: false,
              order: 0,
              createdAt: Date.now(),
              updatedAt: Date.now(),
              password: undefined,
              isDeleted: false,
              deletedAt: null,
            },
            {
              id: 'folder_category1_default',
              name: '分类1',
              type: 'normal' as const,
              color: 'blue' as const,
              isStarred: false,
              order: 1,
              createdAt: Date.now(),
              updatedAt: Date.now(),
              isDeleted: false,
              deletedAt: null,
            },
            {
              id: 'folder_category2_default',
              name: '分类2',
              type: 'normal' as const,
              color: 'green' as const,
              isStarred: false,
              order: 2,
              createdAt: Date.now(),
              updatedAt: Date.now(),
              isDeleted: false,
              deletedAt: null,
            },
          ];

          // 重置所有store
          useDataStore.setState({
            folders: defaultFolders,
            notes: [],
            urls: [],
            trash: [],
          });
          useMessageStore.setState({
            messages: [],
          });

          // 清除用户信息
        set({
          currentUser: null,
          token: null,
          refreshToken: null,
        });

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

