import { useEffect } from 'react';
import { Layout } from 'antd';
import { useMatch } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ErrorBoundary } from '@sentry/react';
import { SiderLayout } from '@refly-packages/ai-workspace-common/components/sider/layout';
import { useBindCommands } from '@refly-packages/ai-workspace-common/hooks/use-bind-commands';
import { useUserStoreShallow } from '@refly-packages/ai-workspace-common/stores/user';
import { LOCALE } from '@refly/common-types';

import { LoginModal } from '../../components/login-modal';
import { SubscribeModal } from '@refly-packages/ai-workspace-common/components/settings/subscribe-modal';
import { VerificationModal } from '../../components/verification-modal';
import { ResetPasswordModal } from '../../components/reset-password-modal';
import { usePublicAccessPage } from '@refly-packages/ai-workspace-common/hooks/use-is-share-page';
import { CanvasListModal } from '@refly-packages/ai-workspace-common/components/workspace/canvas-list-modal';
import { LibraryModal } from '@refly-packages/ai-workspace-common/components/workspace/library-modal';
import { ImportResourceModal } from '@refly-packages/ai-workspace-common/components/import-resource';
import './index.scss';
import { useSiderStoreShallow } from '@refly-packages/ai-workspace-common/stores/sider';
import { BigSearchModal } from '@refly-packages/ai-workspace-common/components/search/modal';
import { CanvasRenameModal } from '@refly-packages/ai-workspace-common/components/canvas/modals/canvas-rename';
import { CanvasDeleteModal } from '@refly-packages/ai-workspace-common/components/canvas/modals/canvas-delete';
import { DuplicateCanvasModal } from '@refly-packages/ai-workspace-common/components/canvas/modals/duplicate-canvas-modal';
import { safeParseJSON } from '@refly-packages/ai-workspace-common/utils/parse';

import { LightLoading } from '@refly/ui-kit';
import { isDesktop } from '@refly-packages/ai-workspace-common/utils/env';
import { useGetUserSettings } from '@refly-packages/ai-workspace-common/hooks/use-get-user-settings';
import { useGetMediaModel } from '@refly-packages/ai-workspace-common/hooks/use-get-media-model';
import { useHandleUrlParamsCallback } from '@refly-packages/ai-workspace-common/hooks/use-handle-url-params-callback';

const Content = Layout.Content;

interface AppLayoutProps {
  children?: any;
}

export const AppLayout = (props: AppLayoutProps) => {
  const { showCanvasListModal, setShowCanvasListModal, showLibraryModal, setShowLibraryModal } =
    useSiderStoreShallow((state) => ({
      showCanvasListModal: state.showCanvasListModal,
      showLibraryModal: state.showLibraryModal,
      setShowCanvasListModal: state.setShowCanvasListModal,
      setShowLibraryModal: state.setShowLibraryModal,
    }));

  const isPublicAccessPage = usePublicAccessPage();
  const matchPricing = useMatch('/pricing');
  const matchLogin = useMatch('/login');

  useBindCommands();

  const userStore = useUserStoreShallow((state) => ({
    isLogin: state.isLogin,
    userProfile: state.userProfile,
    localSettings: state.localSettings,
    isCheckingLoginStatus: state.isCheckingLoginStatus,
  }));

  const showSider = isPublicAccessPage || (!!userStore.userProfile && !matchPricing && !matchLogin);

  // Get storage user profile
  const storageUserProfile = safeParseJSON(localStorage.getItem('refly-user-profile'));
  const notShowLoginBtn = storageUserProfile?.uid || userStore?.userProfile?.uid;

  // Get locale settings
  const storageLocalSettings = safeParseJSON(localStorage.getItem('refly-local-settings'));

  const locale = storageLocalSettings?.uiLocale || userStore?.localSettings?.uiLocale || LOCALE.EN;

  // Check user login status
  useGetUserSettings();

  useGetMediaModel();

  // Change locale if not matched
  const { i18n } = useTranslation();
  useEffect(() => {
    if (locale && i18n.languages?.[0] !== locale) {
      i18n.changeLanguage(locale);
    }
  }, [i18n, locale]);

  // Handle payment callback
  useHandleUrlParamsCallback();

  const routeLogin = useMatch('/');
  const isPricing = useMatch('/pricing');

  if (!isPublicAccessPage && !isPricing && !isDesktop()) {
    if (!userStore.isCheckingLoginStatus === undefined || userStore.isCheckingLoginStatus) {
      return <LightLoading />;
    }

    if (!notShowLoginBtn && !routeLogin) {
      return <LightLoading />;
    }
  }

  return (
    <ErrorBoundary>
      <Layout className="app-layout main">
        {showSider ? <SiderLayout source="sider" /> : null}
        <Layout
          className="content-layout dark:bg-green-900"
          style={{
            height: 'calc(100vh)',
            flexGrow: 1,
            overflowY: 'auto',
            width: showSider ? 'calc(100% - 200px - 16px)' : 'calc(100% - 16px)',
          }}
        >
          <Content>{props.children}</Content>
        </Layout>
        <BigSearchModal />
        <LoginModal />
        <VerificationModal />
        <ResetPasswordModal />
        <SubscribeModal />
        <CanvasListModal visible={showCanvasListModal} setVisible={setShowCanvasListModal} />
        <LibraryModal visible={showLibraryModal} setVisible={setShowLibraryModal} />
        <ImportResourceModal />
        <CanvasRenameModal />
        <CanvasDeleteModal />
        <DuplicateCanvasModal />
      </Layout>
    </ErrorBoundary>
  );
};
