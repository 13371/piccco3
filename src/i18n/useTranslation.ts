import { useSettingsStore } from '../stores/settingsStore';
import { getTranslation } from './translations';

export const useTranslation = () => {
  const language = useSettingsStore((state) => state.language);
  
  const t = (key: keyof typeof import('./translations').translations.zh): string => {
    return getTranslation(key, language);
  };
  
  return { t, language };
};




