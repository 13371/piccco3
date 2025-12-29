import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { API_BASE_URL } from '../config/api';
import { useDataStore } from './dataStore';
import { useMessageStore } from './messageStore';

interface User {
  id: string;
  email: string;
  username: string;
  createdAt: string;
  isBanned?: boolean;
  bannedAt?: string | null;
  banReason?: string | null;
}

interface UserState {
  currentUser: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<{ ok: boolean; message?: string }>;
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
  updateAvatar: (avatar: string) => void;
  updateUsername: (username: string) => void;
  deleteAccount: () => Promise<{ ok: boolean; message?: string }>;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      token: null,

      login: async (email: string, password: string) => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
          
          let res: Response;
          try {
            res = await fetch(`${API_BASE_URL}/auth/login`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password }),
              signal: controller.signal,
            });
            clearTimeout(timeoutId);
          } catch (fetchError: any) {
            clearTimeout(timeoutId);
            if (fetchError.name === 'AbortError') {
              return { ok: false, message: '请求超时，请检查网络连接' };
            }
            throw fetchError;
          }

          let data;
          try {
            data = await res.json();
          } catch (e) {
            console.error('[userStore] JSON解析失败:', e);
            return { ok: false, message: '服务器响应格式错误' };
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
          
          if (isSwitchingUser || isNewUser) {
            if (isSwitchingUser) {
              console.log('[userStore] 切换用户，清除旧用户数据:', oldUser.id);
            } else {
              console.log('[userStore] 新用户首次登录，清除可能存在的旧数据');
            }
            
            // 先清除 localStorage，确保 onRehydrateStorage 不会恢复旧数据
            localStorage.removeItem('piccco-data-storage');
            localStorage.removeItem('piccco-message-storage');
            
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
          }

          set({
            currentUser: data.user,
            token: data.token,
          });

          // 保存登录时间（如果之前没有保存）
          if (data.user?.id) {
            const key = `piccco-login-time-${data.user.id}`;
            if (!localStorage.getItem(key)) {
              localStorage.setItem(key, String(Date.now()));
            }
          }

          // 登录后自动从服务器同步数据（延迟1秒，避免与Layout的同步冲突）
          setTimeout(() => {
            useDataStore.getState().syncDataFromServer();
          }, 1000);

          return { ok: true };
        } catch (e) {
          console.error('[userStore] login error:', e);
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
          const res = await fetch(`${API_BASE_URL}/auth/register`, {
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
          console.log('[userStore] 新用户注册，清除所有旧数据');
          
          // 先清除 localStorage，确保 onRehydrateStorage 不会恢复旧数据
          localStorage.removeItem('piccco-data-storage');
          localStorage.removeItem('piccco-message-storage');
          
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
          console.error('[userStore] register error:', e);
          return { ok: false, message: '网络错误，请稍后重试' };
        }
      },

      sendRegisterCode: async (email: string) => {
        try {
          const res = await fetch(`${API_BASE_URL}/auth/send-code`, {
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
          console.error('[userStore] send code error:', e);
          return { ok: false, message: '网络错误，请稍后重试' };
        }
      },

      changePassword: async (email: string, newPassword: string, code: string) => {
        try {
          const res = await fetch(`${API_BASE_URL}/auth/change-password`, {
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
          console.error('[userStore] change password error:', e);
          return { ok: false, message: '网络错误，请稍后重试' };
        }
      },

      logout: () => {
        // 清除用户相关的本地存储数据
        const currentUser = get().currentUser;
        if (currentUser?.id) {
          // 清除该用户的数据存储
          localStorage.removeItem(`piccco-data-storage-${currentUser.id}`);
          localStorage.removeItem(`piccco-message-storage-${currentUser.id}`);
          localStorage.removeItem(`piccco-login-time-${currentUser.id}`);
        }
        set({
          currentUser: null,
          token: null,
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
          const res = await fetch(`${API_BASE_URL}/admin/users/${state.currentUser.id}`);
          if (res.ok) {
            const data = await res.json();
            const wasBanned = state.currentUser?.isBanned === true;
            const isNowBanned = data.user?.isBanned === true;
            
            if (isNowBanned) {
              // 用户被封禁，清除登录状态
              set({
                currentUser: null,
                token: null,
              });
              return true;
            }
            
            // 更新用户信息（包括解封的情况）
            if (data.user) {
              const updatedUser = {
                ...state.currentUser,
                isBanned: data.user.isBanned || false,
                bannedAt: data.user.bannedAt || null,
                banReason: data.user.banReason || null,
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
          console.error('[userStore] check ban status error:', e);
        }
        return false;
      },

      updateAvatar: (avatar: string) => {
        const state = get();
        if (state.currentUser) {
          set({
            currentUser: { ...state.currentUser, avatar } as User,
          });
        }
      },

      updateUsername: (username: string) => {
        const state = get();
        if (state.currentUser) {
          set({
            currentUser: { ...state.currentUser, username },
          });
        }
      },

      deleteAccount: async () => {
        try {
          const state = get();
          if (!state.token) {
            return { ok: false, message: '未登录' };
          }

          console.log('[userStore] 开始注销账户，API:', `${API_BASE_URL}/auth/account`);

          const res = await fetch(`${API_BASE_URL}/auth/account`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${state.token}`,
              'Content-Type': 'application/json',
            },
          });

          console.log('[userStore] 注销账户响应状态:', res.status, res.statusText);

          // 检查响应是否成功
          if (!res.ok) {
            // 尝试解析错误消息
            try {
              const data = await res.json();
              console.log('[userStore] 注销账户错误响应:', data);
              return { ok: false, message: data.message || '注销账户失败' };
            } catch (e) {
              // 如果无法解析JSON，返回状态码相关的错误
              console.error('[userStore] 解析错误响应失败:', e);
              return { ok: false, message: `注销账户失败 (${res.status})` };
            }
          }

          const data = await res.json();
          console.log('[userStore] 注销账户成功:', data);

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
          });

          return { ok: true, message: '账户注销成功' };
        } catch (e) {
          console.error('[userStore] delete account error:', e);
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

