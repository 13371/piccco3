import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * 首页大白框内容的存储
 * 支持同步到服务器，确保多设备数据一致
 */
interface HomeContentState {
  content: string;
  isTyping: boolean; // 标记用户是否正在输入
  setContent: (content: string) => void;
  setContentWithoutSync: (content: string) => void; // 直接设置内容，不触发同步（用于服务器同步）
  clearContent: () => void;
  setIsTyping: (isTyping: boolean) => void;
  syncFromServer: () => Promise<void>;
  syncToServer: () => Promise<void>;
}

export const useHomeContentStore = create<HomeContentState>()(
  persist(
    (set, get) => ({
      content: '',
      isTyping: false,
      setIsTyping: (isTyping: boolean) => {
        set({ isTyping });
      },
      setContent: (content: string) => {
        const oldContent = get().content;
        set({ content });
        // 不再自动同步，由 dataStore 统一管理同步
        // 这样可以避免重复同步请求和死锁
        // 使用 setTimeout 延迟触发，避免在同步过程中触发新的同步
        if (content !== oldContent) {
          setTimeout(() => {
            import('./dataStore').then(({ useDataStore }) => {
              const dataStore = useDataStore.getState();
              // 只有在不在上传时才触发同步，避免死锁
              if (!dataStore.isUploading && !dataStore.isDownloading) {
                dataStore.syncDataToServer();
              } else {
                // 如果正在同步，标记为有待同步的变更
                useDataStore.setState({ pendingChanges: true });
              }
            });
          }, 100); // 延迟100ms，避免立即触发
        }
      },
      setContentWithoutSync: (content: string) => {
        // 直接设置内容，不触发同步（用于服务器同步，避免循环）
        set({ content });
      },
      clearContent: () => {
        set({ content: '' });
        // 不再自动同步，由 dataStore 统一管理同步
        setTimeout(() => {
          import('./dataStore').then(({ useDataStore }) => {
            const dataStore = useDataStore.getState();
            // 只有在不在上传时才触发同步，避免死锁
            if (!dataStore.isUploading && !dataStore.isDownloading) {
              dataStore.syncDataToServer();
            } else {
              // 如果正在同步，标记为有待同步的变更
              useDataStore.setState({ pendingChanges: true });
            }
          });
        }, 100);
      },
      syncFromServer: async () => {
        // 已废弃：不再单独同步，由 dataStore 统一管理
        // 保留此方法以保持向后兼容，但不执行任何操作
        console.log('[homeContentStore] syncFromServer 已废弃，由 dataStore 统一管理同步');
      },
      syncToServer: async () => {
        // 已废弃：不再单独同步，由 dataStore 统一管理
        // 保留此方法以保持向后兼容，但不执行任何操作
        // 实际同步由 dataStore.syncDataToServer() 统一处理
        console.log('[homeContentStore] syncToServer 已废弃，由 dataStore 统一管理同步');
        // 触发 dataStore 同步（延迟执行，避免死锁）
        setTimeout(() => {
          import('./dataStore').then(({ useDataStore }) => {
            const dataStore = useDataStore.getState();
            // 只有在不在上传时才触发同步，避免死锁
            if (!dataStore.isUploading && !dataStore.isDownloading) {
              dataStore.syncDataToServer();
            } else {
              // 如果正在同步，标记为有待同步的变更
              useDataStore.setState({ pendingChanges: true });
            }
          });
        }, 100);
      },
    }),
    {
      name: 'piccco-home-content-storage', // 独立的 localStorage key
    }
  )
);















