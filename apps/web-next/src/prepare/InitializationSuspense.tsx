import { setupI18n, setupSentry } from '@refly/web-core';
import { useEffect, useState } from 'react';
import { LightLoading, ReflyConfigProvider, useConfigProviderStore } from '@refly/ui-kit';
import { theme } from 'antd';
import { useThemeStoreShallow } from '@refly-packages/ai-workspace-common/stores/theme';

export interface InitializationSuspenseProps {
  children: React.ReactNode;
}

export function InitializationSuspense({ children }: InitializationSuspenseProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const updateConfig = useConfigProviderStore((state) => state.updateConfig);

  const { isDarkMode, isForcedLightMode } = useThemeStoreShallow((state) => ({
    isDarkMode: state.isDarkMode,
    initTheme: state.initTheme,
    isForcedLightMode: state.isForcedLightMode,
  }));

  const shouldUseDarkTheme = isDarkMode || !isForcedLightMode;

  const init = async () => {
    // support multiple initialization
    await Promise.all([setupI18n(), setupSentry()]);
    setIsInitialized(true);
  };

  useEffect(() => {
    init();
  }, []);

  useEffect(() => {
    updateConfig({
      algorithm: shouldUseDarkTheme ? theme.darkAlgorithm : theme.defaultAlgorithm,
    });
  }, [shouldUseDarkTheme]);

  return <ReflyConfigProvider>{isInitialized ? children : <LightLoading />}</ReflyConfigProvider>;
}
