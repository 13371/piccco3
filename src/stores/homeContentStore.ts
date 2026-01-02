import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * 首页大白框内容的独立存储
 * 完全独立于其他文件夹和笔记，不参与同步
 */
interface HomeContentState {
  content: string;
  setContent: (content: string) => void;
  clearContent: () => void;
}

export const useHomeContentStore = create<HomeContentState>()(
  persist(
    (set) => ({
      content: '',
      setContent: (content: string) => {
        set({ content });
      },
      clearContent: () => {
        set({ content: '' });
      },
    }),
    {
      name: 'piccco-home-content-storage', // 独立的 localStorage key
      // 不参与任何同步，只存储在本地
    }
  )
);















