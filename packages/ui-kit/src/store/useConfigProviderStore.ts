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
    algorithm: theme.defaultAlgorithm,
  },
  updateConfig: (config) => set((state) => ({ theme: { ...state.theme, ...config } })),
}));
