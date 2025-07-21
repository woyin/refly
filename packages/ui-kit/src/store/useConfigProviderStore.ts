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
      colorPrimary: '#00968F',
      borderRadius: 6,
      controlItemBgActive: '#f1f1f0',
      controlItemBgActiveHover: '#e0e0e0',
    },
    algorithm: theme.defaultAlgorithm,
  },
  updateConfig: (config) => set((state) => ({ theme: { ...state.theme, ...config } })),
}));
