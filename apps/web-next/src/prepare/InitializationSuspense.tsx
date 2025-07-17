import { setupI18n, setupSentry } from '@refly/web-core';
import { useEffect, useState } from 'react';
import { LightLoading, ReflyConfigProvider, useConfigProviderStore } from '@refly/ui-kit';
import { theme } from 'antd';
import { useThemeStoreShallow } from '@refly/stores';

export interface InitializationSuspenseProps {
  children: React.ReactNode;
}

export function InitializationSuspense({ children }: InitializationSuspenseProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const updateConfig = useConfigProviderStore((state) => state.updateConfig);

  const { isDarkMode, initTheme } = useThemeStoreShallow((state) => ({
    isDarkMode: state.isDarkMode,
    initTheme: state.initTheme,
  }));

  const init = async () => {
    initTheme();

    // support multiple initialization
    await Promise.all([setupI18n(), setupSentry()]);
    setIsInitialized(true);
  };

  useEffect(() => {
    init();
  }, []);

  useEffect(() => {
    updateConfig({
      algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
    });
  }, [isDarkMode]);

  return <ReflyConfigProvider>{isInitialized ? children : <LightLoading />}</ReflyConfigProvider>;
}
