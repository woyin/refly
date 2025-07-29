import { Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import { useSiderStoreShallow, SettingsModalActiveTab } from '@refly/stores';

// components
import { AccountSetting } from '@refly-packages/ai-workspace-common/components/settings/account-setting';
import { LanguageSetting } from '@refly-packages/ai-workspace-common/components/settings/language-setting';
import { AppearanceSetting } from '@refly-packages/ai-workspace-common/components/settings/appearance-setting';
import { Subscription } from '@refly-packages/ai-workspace-common/components/settings/subscription';
import { ModelProviders } from '@refly-packages/ai-workspace-common/components/settings/model-providers';
import { ModelConfig } from '@refly-packages/ai-workspace-common/components/settings/model-config';
import { ParserConfig } from '@refly-packages/ai-workspace-common/components/settings/parser-config';

import { RiAccountBoxLine } from 'react-icons/ri';
import { HiOutlineLanguage } from 'react-icons/hi2';
import { LuPalette } from 'react-icons/lu';

import './index.scss';
import {
  IconSubscription,
  IconModel,
  IconWorldConfig,
  IconCloud,
} from '@refly-packages/ai-workspace-common/components/common/icon';

import { subscriptionEnabled } from '@refly/ui-kit';
import { useEffect, useState } from 'react';
import { ToolOutlined } from '@ant-design/icons';
import { McpServerTab } from '@refly-packages/ai-workspace-common/components/settings/mcp-server';
import React from 'react';

const iconStyle = { fontSize: 16 };

interface SettingModalProps {
  visible: boolean;
  setVisible: (visible: boolean) => void;
}

// Custom Tab Item Component
const CustomTabItem = React.memo<{
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}>(({ icon, label, isActive, onClick }) => (
  <div
    onClick={onClick}
    className={`
      relative transition-all duration-200 ease-in-out cursor-pointer font-normal h-[42px] p-2 border-box flex items-center gap-1 rounded-lg hover:bg-refly-tertiary-hover
      ${isActive ? 'bg-refly-tertiary-hover font-semibold' : ''}
    `}
  >
    <div className="tab-icon">{icon}</div>
    <span className="text-sm font-medium">{label}</span>
  </div>
));

// Custom Tabbar Component
const CustomTabbar = React.memo<{
  t: any;
  tabs: Array<{
    key: string;
    label: string;
    icon: React.ReactNode;
  }>;
  activeTab: string;
  onTabChange: (key: string) => void;
}>(({ t, tabs, activeTab, onTabChange }) => (
  <div className="h-full overflow-hidden flex flex-col gap-6 box-border w-52 px-4 py-5 border-solid border-[1px] border-y-0 border-l-0 border-refly-Card-Border">
    <div className="text-lg font-semibold text-refly-text-0 leading-7">
      {t('tabMeta.settings.title')}
    </div>

    <div className="flex-grow flex flex-col gap-2 overflow-y-auto">
      {tabs.map((tab) => (
        <CustomTabItem
          key={tab.key}
          icon={tab.icon}
          label={tab.label}
          isActive={activeTab === tab.key}
          onClick={() => onTabChange(tab.key)}
        />
      ))}
    </div>
  </div>
));

const Settings: React.FC<SettingModalProps> = ({ visible, setVisible }) => {
  const { t } = useTranslation();
  const { settingsModalActiveTab, setSettingsModalActiveTab } = useSiderStoreShallow((state) => ({
    settingsModalActiveTab: state.settingsModalActiveTab,
    setSettingsModalActiveTab: state.setSettingsModalActiveTab,
  }));

  const [localActiveTab, setLocalActiveTab] = useState<SettingsModalActiveTab>(
    settingsModalActiveTab || SettingsModalActiveTab.ModelConfig,
  );

  // Update local active tab when prop changes
  useEffect(() => {
    if (visible) {
      setLocalActiveTab(settingsModalActiveTab || SettingsModalActiveTab.ModelProviders);
    }
  }, [visible, settingsModalActiveTab]);

  // Handle tab change
  const handleTabChange = (key: string) => {
    setLocalActiveTab(key as SettingsModalActiveTab);
  };

  const tabs = [
    {
      key: 'modelConfig',
      label: t('settings.tabs.modelConfig'),
      icon: <IconModel style={iconStyle} />,
      children: <ModelConfig visible={localActiveTab === SettingsModalActiveTab.ModelConfig} />,
    },
    {
      key: 'modelProviders',
      label: t('settings.tabs.providers'),
      icon: <IconCloud style={iconStyle} />,
      children: (
        <ModelProviders visible={localActiveTab === SettingsModalActiveTab.ModelProviders} />
      ),
    },
    {
      key: 'parserConfig',
      label: t('settings.tabs.parserConfig'),
      icon: <IconWorldConfig style={iconStyle} />,
      children: <ParserConfig visible={localActiveTab === SettingsModalActiveTab.ParserConfig} />,
    },
    {
      key: 'mcpServer',
      label: t('settings.tabs.mcpServer'),
      icon: <ToolOutlined style={iconStyle} />,
      children: <McpServerTab visible={localActiveTab === SettingsModalActiveTab.McpServer} />,
    },
    ...(subscriptionEnabled
      ? [
          {
            key: 'subscription',
            label: t('settings.tabs.subscription'),
            icon: <IconSubscription style={iconStyle} />,
            children: <Subscription />,
          },
        ]
      : []),
    {
      key: 'account',
      label: t('settings.tabs.account'),
      icon: <RiAccountBoxLine style={iconStyle} />,
      children: <AccountSetting />,
    },
    {
      key: 'language',
      label: t('settings.tabs.language'),
      icon: <HiOutlineLanguage style={iconStyle} />,
      children: <LanguageSetting />,
    },
    {
      key: 'appearance',
      label: t('settings.tabs.appearance'),
      icon: <LuPalette style={iconStyle} />,
      children: <AppearanceSetting />,
    },
  ];

  useEffect(() => {
    if (!settingsModalActiveTab) {
      setSettingsModalActiveTab(tabs[0].key as SettingsModalActiveTab);
    }
  }, [subscriptionEnabled]);

  // Find the active tab content
  const activeTabContent = tabs.find((tab) => tab.key === localActiveTab)?.children;

  return (
    <Modal
      className="settings-modal"
      centered
      width={'90vw'}
      height={'85vh'}
      style={{
        maxWidth: '1400px',
        maxHeight: '800px',
      }}
      title={null}
      footer={null}
      open={visible}
      closable={false}
      onCancel={() => setVisible(false)}
      maskClosable={false}
    >
      <div className="flex h-full overflow-hidden">
        <CustomTabbar t={t} tabs={tabs} activeTab={localActiveTab} onTabChange={handleTabChange} />
        <div className="flex-1 h-full overflow-hidden">{activeTabContent}</div>
      </div>
    </Modal>
  );
};

export default Settings;

// Export with both names for compatibility
export { Settings as SettingModal };
