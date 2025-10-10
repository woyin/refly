import { memo } from 'react';

import { AppManager } from '@refly-packages/ai-workspace-common/components/app-manager';
const AppManagerPage = memo(() => {
  return <AppManager />;
});

AppManagerPage.displayName = 'AppManagerPage';

export default AppManagerPage;
