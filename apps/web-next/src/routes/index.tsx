import { HomePage, LazyDebugPage } from '@refly/web-core';
import type { RouteObject } from 'react-router-dom';

export const RoutesList: RouteObject[] = [
  {
    path: '/',
    element: <HomePage />,
  },
  {
    path: '/debug',
    element: <LazyDebugPage />,
  },
];
