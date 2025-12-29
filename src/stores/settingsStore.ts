import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Language } from '../i18n/translations';

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
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // 默认按照最后编辑时间排序
      sortMode: 'updatedAt',
      setSortMode: (mode: SortMode) => set({ sortMode: mode }),
      // 默认字体大小：中
      fontSize: 'medium',
      setFontSize: (level: FontSizeLevel) => set({ fontSize: level }),
      // 默认语言：中文
      language: 'zh',
      setLanguage: (lang: Language) => set({ language: lang }),
      // 默认夜间模式：自动
      nightMode: 'auto',
      setNightMode: (mode: NightMode) => set({ nightMode: mode }),
    }),
    {
      name: 'piccco-settings-storage',
    }
  )
);


