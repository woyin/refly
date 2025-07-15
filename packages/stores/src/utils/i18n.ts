// I18n utilities
export type Locale = 'en' | 'zh' | 'ja' | 'ko' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'ru' | string;

export interface TranslationFunction {
  (key: string, params?: Record<string, any>): string;
}

export const t: TranslationFunction = (key: string, params?: Record<string, any>) => {
  // Placeholder implementation - return the key
  return key;
};

export const useTranslation = () => {
  return {
    t,
    i18n: {
      language: 'en',
      changeLanguage: (lang: Locale) => Promise.resolve(),
    },
  };
};