import { Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { LightLoading } from '@refly/ui-kit';
import { ErrorBoundary } from '@sentry/react';
import { Layout } from './components/Layout';
import { RoutesList } from './routes';
import { InitializationSuspense } from './prepare/InitializationSuspense';

export const App = () => {
  return (
    <ErrorBoundary>
      <InitializationSuspense>
        <Layout>
          <Suspense fallback={<LightLoading />}>
            <Routes>
              {RoutesList.map((route) => (
                <Route key={route.path} path={route.path} element={route.element} />
              ))}
            </Routes>
          </Suspense>
        </Layout>
      </InitializationSuspense>
    </ErrorBoundary>
  );
};
