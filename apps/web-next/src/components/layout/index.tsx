import { ConfigProvider, theme } from 'antd';
import { Outlet } from 'react-router-dom';
import { useThemeStoreShallow } from '@refly-packages/ai-workspace-common/stores/theme';

export interface LayoutProps {
  children: React.ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const { isDarkMode, isForcedLightMode } = useThemeStoreShallow((state) => ({
    isDarkMode: state.isDarkMode,
    initTheme: state.initTheme,
    isForcedLightMode: state.isForcedLightMode,
  }));

  const shouldUseDarkTheme = isDarkMode || !isForcedLightMode;

  return (
    <div className="w-full h-full refly">
      <ConfigProvider
        theme={{
          cssVar: {
            key: 'refly',
          },
          algorithm: shouldUseDarkTheme ? theme.darkAlgorithm : theme.defaultAlgorithm,
        }}
      >
        {children}
        <Outlet />
      </ConfigProvider>
    </div>
  );
};
