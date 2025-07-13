import { theme } from 'antd';
import { Outlet } from 'react-router-dom';
import { useThemeStoreShallow } from '@refly-packages/ai-workspace-common/stores/theme';
import { ReflyConfigProvider, useConfigProviderStore } from '@refly/ui-kit';
import { useEffect } from 'react';
import { setupSentry } from '@refly/web-core';

export interface LayoutProps {
  children: React.ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const updateConfig = useConfigProviderStore((state) => state.updateConfig);

  const { isDarkMode, isForcedLightMode } = useThemeStoreShallow((state) => ({
    isDarkMode: state.isDarkMode,
    initTheme: state.initTheme,
    isForcedLightMode: state.isForcedLightMode,
  }));

  const shouldUseDarkTheme = isDarkMode || !isForcedLightMode;

  useEffect(() => {
    setupSentry();
  }, []);

  useEffect(() => {
    updateConfig({
      algorithm: shouldUseDarkTheme ? theme.darkAlgorithm : theme.defaultAlgorithm,
    });
  }, [shouldUseDarkTheme]);

  return (
    <div className="w-full h-full refly">
      <ReflyConfigProvider>
        {children}
        <Outlet />
      </ReflyConfigProvider>
    </div>
  );
};
