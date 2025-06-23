import React, { useState } from 'react';
import { Card, Button, Typography, Badge } from 'antd';
import { DownloadOutlined, CheckOutlined } from '@ant-design/icons';

import { useCreateProvider } from '@refly-packages/ai-workspace-common/queries';
import { CommunityProviderCardProps } from './provider-store-types';
import {
  convertCommunityConfigToProviderRequest,
  getPricingBadgeColor,
  getCategoryBadgeColor,
} from './provider-store-utils';

const { Title, Text } = Typography;

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
      children: 'Install',
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
        height: '130px',
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
        backgroundColor: '#ffffff',
        transition: 'all 0.2s',
      }}
      styles={{
        body: {
          padding: '12px',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        },
      }}
    >
      {/* Top section - Name and Pricing */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Title
            level={5}
            className="!mb-0 !text-sm !font-semibold text-gray-900 truncate"
            style={{ lineHeight: '1.2', maxWidth: '150px' }}
          >
            {config.name}
          </Title>
          <Badge
            color={getPricingBadgeColor(config.pricing)}
            text={config.pricing?.toUpperCase()}
            style={{
              fontSize: '10px',
              fontWeight: 600,
              textTransform: 'uppercase',
              flexShrink: 0,
            }}
          />
        </div>

        {/* Categories and Special Tags */}
        <div className="flex items-center gap-1 flex-wrap">
          {/* Only show first category */}
          {config.categories?.[0] && (
            <Badge
              color={getCategoryBadgeColor(config.categories[0])}
              text={config.categories[0].toUpperCase()}
              style={{
                fontSize: '9px',
                fontWeight: 500,
                height: '16px',
                lineHeight: '14px',
              }}
            />
          )}

          {/* Special tags */}
          {config.tags?.includes('official') && (
            <Badge
              color="blue"
              text="OFFICIAL"
              style={{
                fontSize: '8px',
                fontWeight: 600,
                height: '16px',
                lineHeight: '14px',
              }}
            />
          )}
          {config.tags?.includes('popular') && (
            <Badge
              color="orange"
              text="POPULAR"
              style={{
                fontSize: '8px',
                fontWeight: 600,
                height: '16px',
                lineHeight: '14px',
              }}
            />
          )}
        </div>
      </div>

      {/* Middle section - Description */}
      <div className="flex-1 min-h-0 my-2">
        <Text
          className="text-xs text-gray-600"
          style={{
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            lineHeight: '1.3',
          }}
        >
          {description}
        </Text>
      </div>

      {/* Bottom section - Author and Install button */}
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          {config.author && (
            <Text type="secondary" className="text-xs truncate" style={{ lineHeight: '1.2' }}>
              by {config.author}
            </Text>
          )}
        </div>
        <Button
          size="small"
          {...buttonProps}
          style={{
            height: '24px',
            fontSize: '11px',
            fontWeight: 500,
            borderRadius: '4px',
            minWidth: '60px',
            marginLeft: '8px',
            flexShrink: 0,
          }}
        />
      </div>
    </Card>
  );
};

CommunityProviderCard.displayName = 'CommunityProviderCard';
