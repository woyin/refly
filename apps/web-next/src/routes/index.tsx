import { Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { useEffect } from 'react';
import { safeParseJSON } from '@refly-packages/ai-workspace-common/utils/parse';
import { useUserStoreShallow } from '@refly-packages/ai-workspace-common/stores/user';
import { useTranslation } from 'react-i18next';
import { LOCALE } from '@refly/common-types';
import { LightLoading } from '@refly-packages/ai-workspace-common/components/common/loading';
import { HomeRedirect } from '@refly-packages/ai-workspace-common/components/home-redirect';
import { Layout } from '../components/Layout';

//TODO: Only handle necessary global information
export const AppRouter = () => {
  // TODO:  may just dependency login state, not need to get user profile
  const userStore = useUserStoreShallow((state) => ({
    isLogin: state.isLogin,
    userProfile: state.userProfile,
    localSettings: state.localSettings,
    isCheckingLoginStatus: state.isCheckingLoginStatus,
  }));

  const storageLocalSettings = safeParseJSON(localStorage.getItem('refly-local-settings'));
  const locale = storageLocalSettings?.uiLocale || userStore?.localSettings?.uiLocale || LOCALE.EN;

  const { i18n } = useTranslation();
  useEffect(() => {
    if (locale && i18n.languages?.[0] !== locale) {
      i18n.changeLanguage(locale);
    }
  }, [i18n, locale]);

  return (
    <Layout>
      <Suspense fallback={<LightLoading />}>
        <Routes>
          <Route path="/" element={<HomeRedirect defaultNode={<div>refly</div>} />} />
        </Routes>
      </Suspense>
    </Layout>
  );
};
