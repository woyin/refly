import { Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { LightLoading } from '@refly/ui-kit';
import { ErrorBoundary } from '@sentry/react';
import { AppLayout } from '@refly/web-core';

import { RoutesList } from './routes';
import { InitializationSuspense } from './prepare/InitializationSuspense';
import TestPanelTrigger from './components/TestPanelTrigger';

export const App = () => {
  return (
    <ErrorBoundary>
      <InitializationSuspense>
        <AppLayout>
          <Suspense fallback={<LightLoading />}>
            <Routes>
              {RoutesList.map((route) => (
                <Route key={route.path} path={route.path} element={route.element} />
              ))}
            </Routes>
          </Suspense>
          {/* 测试面板触发器 - 通过环境变量控制显示 */}
          <TestPanelTrigger />
        </AppLayout>
      </InitializationSuspense>
    </ErrorBoundary>
  );
};
