import { lazy } from 'react';

// use case: lazy load page
export const LazyDebugPage = lazy(() =>
  import('./pages/debug').then((module) => ({
    default: module.DebugPage,
  })),
);

export { HomePage } from './pages/home';

export { setupI18n } from './effect/i18n';
export { setupSentry } from './effect/monitor';
