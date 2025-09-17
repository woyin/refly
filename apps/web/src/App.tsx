import { useState } from 'react';
import { ErrorBoundary } from '@sentry/react';
import { AppLayout } from '@refly/web-core';

import { InitializationSuspense } from './prepare/InitializationSuspense';
import { Markdown } from '@refly/ai-workspace-common/components';
import { Input } from 'antd';

export const App = () => {
  const [content, setContent] = useState('');
  return (
    <ErrorBoundary>
      <InitializationSuspense>
        <AppLayout>
          <Input.TextArea onChange={(e) => setContent(e.target.value)} />
          <div className="w-[800px] h-[800px] overflow-auto">
            <Markdown content={content} />
          </div>
          {/* <Suspense fallback={<LightLoading />}>
            <Routes>
              {RoutesList.map((route) => (
                <Route key={route.path} path={route.path} element={route.element} />
              ))}
            </Routes>
          </Suspense> */}
        </AppLayout>
      </InitializationSuspense>
    </ErrorBoundary>
  );
};
