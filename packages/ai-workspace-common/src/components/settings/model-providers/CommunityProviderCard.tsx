import React, { useState } from 'react';
import { Card, Button, Typography, Badge, Space, Tooltip } from 'antd';
import { DownloadOutlined, CheckOutlined, LinkOutlined } from '@ant-design/icons';

import { useCreateProvider } from '@refly-packages/ai-workspace-common/queries';
import { CommunityProviderCardProps } from './provider-store-types';
import {
  convertCommunityConfigToProviderRequest,
  getCategoryBadgeColor,
} from './provider-store-utils';

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
  onInstall,
}) => {
  const [isInstalling, setIsInstalling] = useState(false);
  const createProviderMutation = useCreateProvider();

  const handleInstall = async () => {
    if (isInstalled || isInstalling) return;

    try {
      setIsInstalling(true);
      const providerRequest = convertCommunityConfigToProviderRequest(config, {});
      await createProviderMutation.mutateAsync({ body: providerRequest });
      onInstall?.(config);
    } catch (error) {
      console.error('Failed to install provider:', error);
    } finally {
      setIsInstalling(false);
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

    if (isInstalling) {
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
    <Card
      hoverable={!isInstalled && !isInstalling}
      className="community-provider-card"
      style={{
        height: '156px',
        borderRadius: '12px',
        border: isInstalled ? '1px solid #52c41a' : '1px solid #e5e7eb',
        backgroundColor: isInstalled ? '#f6ffed' : '#ffffff',
        transition: 'all 0.2s ease',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
        overflow: 'hidden',
        position: 'relative',
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
          <Title
            level={5}
            className="!mb-2 !text-base !font-semibold text-gray-900 !leading-tight"
            style={{
              lineHeight: '1.3',
              fontSize: '16px',
              fontWeight: 600,
              margin: 0,
              marginBottom: '8px',
            }}
          >
            {config.name}
          </Title>

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

      {/* Categories */}
      <div className="mb-3">
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

      {/* Description */}
      <div className="flex-1 min-h-0">
        <Text
          className="text-sm text-gray-600"
          style={{
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            lineHeight: '1.4',
            fontSize: '13px',
            color: '#6b7280',
          }}
        >
          {description}
        </Text>
      </div>

      {/* Simple status indicator for installed providers */}
      {isInstalled && (
        <div
          className="absolute top-3 right-3 w-2 h-2 bg-green-500 rounded-full"
          style={{ opacity: 0.8 }}
        />
      )}
    </Card>
  );
};

CommunityProviderCard.displayName = 'CommunityProviderCard';
