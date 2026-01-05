import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useUserStore } from './userStore';
import { API_BASE_URL } from '../config/api';

/**
 * 首页大白框内容的存储
 * 支持同步到服务器，确保多设备数据一致
 */
interface HomeContentState {
  content: string;
  setContent: (content: string) => void;
  clearContent: () => void;
  syncFromServer: () => Promise<void>;
  syncToServer: () => Promise<void>;
}

export const useHomeContentStore = create<HomeContentState>()(
  persist(
    (set, get) => ({
      content: '',
      setContent: (content: string) => {
        const oldContent = get().content;
        set({ content });
        // 自动同步到服务器（防抖1秒，只在有变化时同步）
        if (content !== oldContent) {
          setTimeout(() => {
            get().syncToServer();
          }, 1000);
        }
      },
      clearContent: () => {
        set({ content: '' });
        get().syncToServer();
      },
      syncFromServer: async () => {
        const { currentUser, token } = useUserStore.getState();
        if (!currentUser || !token) {
          return;
        }
        
        try {
          const res = await fetch(`${API_BASE_URL}/v1/data/sync`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          
          if (res.ok) {
            const result = await res.json();
            if (result.success && result.data && result.data.homeContent !== undefined) {
              set({ content: result.data.homeContent || '' });
            }
          }
        } catch (e) {
          console.error('[homeContentStore] 从服务器同步失败:', e);
        }
      },
      syncToServer: async () => {
        const { currentUser, token } = useUserStore.getState();
        if (!currentUser || !token) {
          return;
        }
        
        const content = get().content;
        
        try {
          // 获取当前数据
          const getRes = await fetch(`${API_BASE_URL}/v1/data/sync`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          
          if (!getRes.ok) {
            return;
          }
          
          const getResult = await getRes.json();
          if (!getResult.success || !getResult.data) {
            return;
          }
          
          // 合并数据并同步
          const syncData = {
            folders: getResult.data.folders || [],
            notes: getResult.data.notes || [],
            urls: getResult.data.urls || [],
            homeContent: content, // 使用最新的首页内容
            settings: getResult.data.settings,
            permanentlyDeletedFolderIds: getResult.data.permanentlyDeletedFolderIds || [],
          };
          
          const postRes = await fetch(`${API_BASE_URL}/v1/data/sync`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(syncData),
          });
          
          if (!postRes.ok) {
            console.error('[homeContentStore] 同步到服务器失败:', postRes.status);
          }
        } catch (e) {
          console.error('[homeContentStore] 同步到服务器失败:', e);
        }
      },
    }),
    {
      name: 'piccco-home-content-storage', // 独立的 localStorage key
    }
  )
);















