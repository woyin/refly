// Some injects
import './process-polyfill';
import './utils/dom-patch';
import '@refly-packages/ai-workspace-common/i18n/config';
import './index.css';
import './tokens.css';

import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@refly-packages/ai-workspace-common/utils/request';
import { AppRouter } from './routes';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  </QueryClientProvider>,
);
