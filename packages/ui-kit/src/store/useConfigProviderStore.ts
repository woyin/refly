import { type ThemeConfig, theme } from 'antd';
import { create } from 'zustand';
import merge from 'deepmerge';

export interface ConfigProviderState {
  theme: ThemeConfig;
  updateTheme: (config: Partial<ThemeConfig>) => void;
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
  updateTheme: (config) =>
    set((state) => ({
      theme: merge(state.theme, config, {
        arrayMerge: (_target, source) => source,
      }),
    })),
}));
