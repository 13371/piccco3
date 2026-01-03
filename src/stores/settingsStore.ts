import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Language } from '../i18n/translations';
import { API_BASE_URL } from '../config/api';
import { logger } from '../utils/logger';
import { useUserStore } from './userStore';

export type SortMode = 'updatedAt' | 'name';
export type FontSizeLevel = 'small' | 'medium' | 'large';
export type NightMode = 'day' | 'night' | 'auto';

interface SettingsState {
  sortMode: SortMode;
  setSortMode: (mode: SortMode) => void;
  fontSize: FontSizeLevel;
  setFontSize: (level: FontSizeLevel) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  nightMode: NightMode;
  setNightMode: (mode: NightMode) => void;
  // 同步相关
  syncSettingsToServer: () => Promise<void>;
  loadSettingsFromServer: () => Promise<void>;
  isSyncing: boolean;
}

// 防抖定时器（模块级别，避免内存泄漏）
let syncTimer: ReturnType<typeof setTimeout> | null = null;

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      // 默认按照最后编辑时间排序
      sortMode: 'updatedAt',
      setSortMode: (mode: SortMode) => {
        set({ sortMode: mode });
        // 延迟同步，避免频繁请求（使用防抖）
        if (syncTimer) {
          clearTimeout(syncTimer);
        }
        syncTimer = setTimeout(() => {
          get().syncSettingsToServer();
          syncTimer = null;
        }, 500);
      },
      // 默认字体大小：中
      fontSize: 'medium',
      setFontSize: (level: FontSizeLevel) => {
        set({ fontSize: level });
        // 延迟同步，避免频繁请求（使用防抖）
        if (syncTimer) {
          clearTimeout(syncTimer);
        }
        syncTimer = setTimeout(() => {
          get().syncSettingsToServer();
          syncTimer = null;
        }, 500);
      },
      // 默认语言：中文
      language: 'zh',
      setLanguage: (lang: Language) => {
        set({ language: lang });
        // 延迟同步，避免频繁请求（使用防抖）
        if (syncTimer) {
          clearTimeout(syncTimer);
        }
        syncTimer = setTimeout(() => {
          get().syncSettingsToServer();
          syncTimer = null;
        }, 500);
      },
      // 默认夜间模式：自动
      nightMode: 'auto',
      setNightMode: (mode: NightMode) => {
        set({ nightMode: mode });
        // 延迟同步，避免频繁请求（使用防抖）
        if (syncTimer) {
          clearTimeout(syncTimer);
        }
        syncTimer = setTimeout(() => {
          get().syncSettingsToServer();
          syncTimer = null;
        }, 500);
      },
      // 同步状态
      isSyncing: false,
      
      // 同步设置到服务器
      syncSettingsToServer: async () => {
        const state = get();
        const userStore = useUserStore.getState();
        
        if (!userStore.currentUser || !userStore.token) {
          // 未登录，不同步
          return;
        }
        
        if (state.isSyncing) {
          // 正在同步，跳过
          return;
        }
        
        set({ isSyncing: true });
        
        try {
          const res = await fetch(`${API_BASE_URL}/data/settings`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${userStore.token}`,
            },
            body: JSON.stringify({
              sortMode: state.sortMode,
              fontSize: state.fontSize,
              language: state.language,
              nightMode: state.nightMode,
            }),
          });
          
          if (!res.ok) {
            const error = await res.json().catch(() => ({ message: '同步设置失败' }));
            logger.error('[settingsStore] syncSettingsToServer error:', error);
            // 失败时不抛出错误，静默失败
          }
        } catch (e) {
          logger.error('[settingsStore] syncSettingsToServer network error:', e);
          // 网络错误时静默失败，不影响用户体验
        } finally {
          set({ isSyncing: false });
        }
      },
      
      // 从服务器加载设置
      loadSettingsFromServer: async () => {
        const userStore = useUserStore.getState();
        
        if (!userStore.currentUser || !userStore.token) {
          // 未登录，不加载
          return;
        }
        
        // 如果正在同步，跳过加载
        if (get().isSyncing) {
          return;
        }
        
        try {
          const res = await fetch(`${API_BASE_URL}/data/settings`, {
            headers: {
              'Authorization': `Bearer ${userStore.token}`,
            },
          });
          
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.settings) {
              // 一切以服务器为准：直接使用服务器设置，不比较本地设置
              set({
                sortMode: data.settings.sortMode || 'updatedAt',
                fontSize: data.settings.fontSize || 'medium',
                language: data.settings.language || 'zh',
                nightMode: data.settings.nightMode || 'auto',
              });
            }
          } else if (res.status === 401 || res.status === 403) {
            // Token过期，尝试刷新Token
            const refreshResult = await useUserStore.getState().refreshAccessToken();
            if (refreshResult.ok) {
              // 刷新成功，重试加载
              logger.log('[settingsStore] Token已刷新，重试加载设置');
              return get().loadSettingsFromServer();
            } else {
              // 刷新失败，清除登录状态
              logger.warn('[settingsStore] Token无效且刷新失败，清除登录状态');
              useUserStore.getState().logout();
            }
          } else {
            logger.error('[settingsStore] loadSettingsFromServer error:', res.status);
          }
        } catch (e) {
          logger.error('[settingsStore] loadSettingsFromServer network error:', e);
          // 网络错误时使用本地设置
        }
      },
    }),
    {
      name: 'piccco-settings-storage',
    }
  )
);


