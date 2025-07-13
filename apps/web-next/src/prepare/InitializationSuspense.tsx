import { setupI18n } from '@refly/web-core';
import { useEffect, useState } from 'react';
import { LightLoading } from '@refly/ui-kit';

export interface InitializationSuspenseProps {
  children: React.ReactNode;
}

export function InitializationSuspense({ children }: InitializationSuspenseProps) {
  const [isInitialized, setIsInitialized] = useState(false);

  const init = async () => {
    // support multiple initialization
    await Promise.all([setupI18n()]);
    setIsInitialized(true);
  };

  useEffect(() => {
    init();
  }, []);

  return <>{isInitialized ? children : <LightLoading />}</>;
}
