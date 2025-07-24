import { type ThemeConfig, theme } from 'antd';
import { create } from 'zustand';

export interface ConfigProviderState {
  theme: ThemeConfig;
  updateConfig: (config: Partial<ThemeConfig>) => void;
}

export const useConfigProviderStore = create<ConfigProviderState>((set) => ({
  theme: {
    cssVar: {
      key: 'refly',
    },
    token: {
      colorPrimary: '#0E9F77',
      borderRadius: 8,
      controlItemBgActive: 'var(--refly-tertiary-hover)',
      controlItemBgActiveHover: 'var(--refly-tertiary-hover)',
    },
    algorithm: theme.defaultAlgorithm,
  },
  updateConfig: (config) => set((state) => ({ theme: { ...state.theme, ...config } })),
}));
