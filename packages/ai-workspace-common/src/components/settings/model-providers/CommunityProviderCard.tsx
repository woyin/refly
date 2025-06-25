import React, { useState } from 'react';
import { Card, Button, Typography, Badge, Space, Tooltip, message, Avatar } from 'antd';
import {
  DownloadOutlined,
  CheckOutlined,
  LinkOutlined,
  BookOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useCreateProvider } from '@refly-packages/ai-workspace-common/queries';
import { CommunityProviderCardProps } from './provider-store-types';
import {
  convertCommunityConfigToProviderRequest,
  getCategoryBadgeColor,
  requiresApiKey,
} from './provider-store-utils';
import { CommunityProviderApiKeyModal } from './CommunityProviderApiKeyModal';

const { Title, Text } = Typography;

// Minimal CSS styles for smooth interactions
const cardStyles = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  .animate-fade-in {
    animation: fadeIn 0.4s ease-out forwards;
  }
  
  .community-provider-card:hover {
    box-shadow: 0 4px 12px 0 rgba(0, 0, 0, 0.08) !important;
  }
  
  .doc-link {
    color: #1677ff;
    text-decoration: none;
    transition: color 0.2s ease;
  }
  
  .doc-link:hover {
    color: #0958d9;
    text-decoration: underline;
  }
`;

// Inject minimal styles
if (typeof document !== 'undefined') {
  const styleElement = document.getElementById('community-provider-card-styles');
  if (!styleElement) {
    const style = document.createElement('style');
    style.id = 'community-provider-card-styles';
    style.textContent = cardStyles;
    document.head.appendChild(style);
  }
}

export const CommunityProviderCard: React.FC<CommunityProviderCardProps> = ({
  config,
  isInstalled,
  isInstalling = false,
  onInstall,
  onInstallStart,
  onInstallError,
}) => {
  const [localInstalling, setLocalInstalling] = useState(false);
  const [apiKeyModalVisible, setApiKeyModalVisible] = useState(false);
  const createProviderMutation = useCreateProvider();

  // Use external installing state if provided, otherwise use local state
  const isCurrentlyInstalling = isInstalling || localInstalling;

  const handleInstall = async () => {
    if (isInstalled || isCurrentlyInstalling) return;

    // Check if API key is required
    if (requiresApiKey(config)) {
      // Show API key configuration modal
      setApiKeyModalVisible(true);
      return;
    }

    // Direct installation for configs that don't require API key
    await performInstallation();
  };

  // Perform the actual installation
  const performInstallation = async (userConfig?: { apiKey?: string; baseUrl?: string }) => {
    try {
      // Notify parent component that installation started
      onInstallStart?.(config);
      setLocalInstalling(true);

      message.loading({ content: '正在安装提供商...', key: `install-${config.providerId}` });

      const providerRequest = convertCommunityConfigToProviderRequest(config, userConfig);
      await createProviderMutation.mutateAsync({ body: providerRequest });

      message.success({
        content: '提供商安装成功！',
        key: `install-${config.providerId}`,
      });
      onInstall?.(config);
      setApiKeyModalVisible(false);
    } catch (error) {
      console.error('Failed to install provider:', error);
      message.error({
        content: '安装失败，请重试',
        key: `install-${config.providerId}`,
      });
      onInstallError?.(config, error);
    } finally {
      setLocalInstalling(false);
    }
  };

  // Handle API key modal success
  const handleApiKeyModalSuccess = (userConfig: { apiKey: string; baseUrl?: string }) => {
    performInstallation(userConfig);
  };

  // Handle documentation link click
  const handleDocumentationClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (config.documentation) {
      window.open(config.documentation, '_blank', 'noopener,noreferrer');
    }
  };

  const getButtonProps = () => {
    if (isInstalled) {
      return {
        type: 'default' as const,
        icon: <CheckOutlined />,
        children: '已安装',
        disabled: true,
      };
    }

    if (isCurrentlyInstalling) {
      return {
        type: 'primary' as const,
        loading: true,
        children: '安装中...',
        disabled: true,
      };
    }

    return {
      type: 'primary' as const,
      icon: <DownloadOutlined />,
      children: '安装',
      onClick: handleInstall,
    };
  };

  const buttonProps = getButtonProps();

  // Get localized description
  const description =
    typeof config.description === 'object'
      ? config.description?.['zh-CN'] || config.description?.en || ''
      : config.description || '';

  return (
    <>
      <Card
        hoverable={!isInstalled && !isCurrentlyInstalling}
        className="community-provider-card"
        style={{
          borderRadius: '12px',
          border: isInstalled ? '1px solid #52c41a' : '1px solid #e5e7eb',
          backgroundColor: '#ffffff',
          transition: 'all 0.2s ease',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
          overflow: 'hidden',
          position: 'relative',
          // height: '156px',
        }}
        styles={{
          body: {
            padding: '18px',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
          },
        }}
      >
        {/* Header: Name and Install Button */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0 pr-3">
            <div className="flex items-center gap-3 mb-2">
              {/* Provider Icon */}
              <div className="flex-shrink-0">
                {config.icon ? (
                  <Avatar
                    src={config.icon}
                    alt={`${config.name} icon`}
                    size={32}
                    shape="square"
                    className="border border-gray-200"
                    icon={<UserOutlined />}
                  />
                ) : (
                  <Avatar
                    size={32}
                    shape="square"
                    className="bg-blue-100 text-blue-600 border border-gray-200"
                    style={{
                      backgroundColor: '#f0f7ff',
                      color: '#1677ff',
                      fontWeight: 600,
                      fontSize: '14px',
                    }}
                  >
                    {config.name.charAt(0).toUpperCase()}
                  </Avatar>
                )}
              </div>

              {/* Provider Name */}
              <Title
                level={5}
                className="!mb-0 !text-base !font-semibold text-gray-900 !leading-tight"
                style={{
                  lineHeight: '1.3',
                  fontSize: '16px',
                  fontWeight: 600,
                  margin: 0,
                }}
              >
                {config.name}
              </Title>
            </div>

            <div className="flex items-center gap-2">
              <Text
                className="inline-flex items-center px-2 py-1 rounded text-xs font-mono bg-gray-50 text-gray-600 border border-gray-200"
                style={{
                  fontSize: '11px',
                  lineHeight: '1.2',
                  fontFamily:
                    'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
                }}
              >
                {config.providerKey}
              </Text>

              {config.baseUrl && (
                <Tooltip title={config.baseUrl} placement="top">
                  <LinkOutlined
                    className="text-gray-400 hover:text-blue-500 transition-colors cursor-pointer"
                    style={{ fontSize: '11px' }}
                  />
                </Tooltip>
              )}
            </div>
          </div>

          {/* Install Button */}
          <Button
            size="small"
            {...buttonProps}
            style={{
              height: '30px',
              fontSize: '12px',
              fontWeight: 500,
              borderRadius: '6px',
              minWidth: '72px',
              padding: '0 12px',
            }}
          />
        </div>

        {/* Categories and Documentation */}
        <div className="mb-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <Space size={4} wrap>
                {config.categories?.slice(0, 4).map((category, index) => (
                  <Badge
                    key={category}
                    color={getCategoryBadgeColor(category)}
                    text={category.toUpperCase()}
                    className="animate-fade-in"
                    style={{
                      fontSize: '9px',
                      fontWeight: 500,
                      height: '18px',
                      lineHeight: '16px',
                      borderRadius: '4px',
                      letterSpacing: '0.3px',
                      animationDelay: `${index * 50}ms`,
                    }}
                  />
                ))}
                {config.categories && config.categories.length > 4 && (
                  <Text type="secondary" style={{ fontSize: '11px', fontWeight: 500 }}>
                    +{config.categories.length - 4}
                  </Text>
                )}
              </Space>
            </div>

            {/* Documentation Link */}
            {config.documentation && (
              <a
                href={config.documentation}
                target="_blank"
                rel="noopener noreferrer"
                className="doc-link inline-flex items-center gap-1 hover:text-blue-600 transition-all duration-200 rounded px-2 py-1 hover:bg-blue-50"
                onClick={handleDocumentationClick}
                style={{
                  fontSize: '11px',
                  fontWeight: 500,
                  color: '#6b7280',
                }}
              >
                <BookOutlined
                  style={{
                    fontSize: '12px',
                    color: '#1677ff',
                  }}
                />
                文档
              </a>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="flex-1 overflow-hidden">
          <div
            className="text-sm text-gray-600"
            style={{
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 2,
              overflow: 'hidden',
              lineHeight: '1.4',
              fontSize: '13px',
              color: '#6b7280',
              maxHeight: '36px', // 13px * 1.4 * 2 lines ≈ 36px
              wordBreak: 'break-word',
              hyphens: 'auto',
            }}
          >
            {description}
          </div>
        </div>

        {/* Simple status indicator for installed providers */}
        {isInstalled && (
          <div
            className="absolute top-3 right-3 w-2 h-2 bg-green-500 rounded-full"
            style={{ opacity: 0.8 }}
          />
        )}
      </Card>

      {/* API Key Configuration Modal */}
      <CommunityProviderApiKeyModal
        visible={apiKeyModalVisible}
        config={config}
        onClose={() => setApiKeyModalVisible(false)}
        onSuccess={handleApiKeyModalSuccess}
        loading={isCurrentlyInstalling}
      />
    </>
  );
};

CommunityProviderCard.displayName = 'CommunityProviderCard';
