import React, { memo, useState } from 'react';
import { Card, Button, Badge, Typography, Tooltip, Space, message } from 'antd';
import { DownloadOutlined, CheckOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useCreateMcpServer } from '@refly-packages/ai-workspace-common/queries';

import { CommunityMcpCardProps } from './types';
import { convertCommunityConfigToServerRequest } from './utils';

const { Text, Title, Paragraph } = Typography;

export const CommunityMcpCard: React.FC<CommunityMcpCardProps> = memo(
  ({ config, isInstalled, isInstalling, onInstall }) => {
    const [installing, setInstalling] = useState(false);
    const { t } = useTranslation();

    // Initialize the create MCP server mutation
    const createMcpServer = useCreateMcpServer(undefined, {
      onSuccess: () => {
        message.success(t('settings.mcpServer.community.installSuccess', { name: config.name }));
        setInstalling(false);
        onInstall?.(config); // Trigger refresh of installed servers
      },
      onError: (error) => {
        console.error('Installation error:', error);
        message.error(t('settings.mcpServer.community.installError', { name: config.name }));
        setInstalling(false);
      },
    });

    // Get localized description
    const getDescription = () => {
      if (typeof config.description === 'string') {
        return config.description;
      }
      const currentLanguage = t('language');
      if (currentLanguage === 'Chinese' && config.description?.['zh-CN']) {
        return config.description['zh-CN'];
      }
      if (config.description?.en) {
        return config.description.en;
      }
      return t('settings.mcpServer.community.noDescription');
    };

    // Get type color and style
    const getTypeColor = (type: string) => {
      switch (type) {
        case 'stdio':
          return '#52c41a'; // Green
        case 'sse':
          return '#1677ff'; // Blue
        case 'websocket':
          return '#fa8c16'; // Orange
        default:
          return '#8c8c8c'; // Gray
      }
    };

    // Handle installation
    const handleInstall = async () => {
      try {
        setInstalling(true);

        // Convert community config to server request format
        const serverRequest = convertCommunityConfigToServerRequest(config);

        // Create the MCP server
        await createMcpServer.mutateAsync({
          body: serverRequest,
        });
      } catch (error) {
        console.error('Installation error:', error);
        setInstalling(false);
      }
    };

    // Get install button props
    const getInstallButtonProps = () => {
      if (isInstalled) {
        return {
          type: 'default' as const,
          icon: <CheckOutlined />,
          disabled: true,
          children: t('settings.mcpServer.community.installed'),
          style: {
            color: '#52c41a',
            borderColor: '#52c41a',
            backgroundColor: '#f6ffed',
          },
        };
      }

      if (isInstalling || installing) {
        return {
          type: 'primary' as const,
          loading: true,
          disabled: true,
          children: t('settings.mcpServer.community.installing'),
        };
      }

      return {
        type: 'primary' as const,
        icon: <DownloadOutlined />,
        onClick: handleInstall,
        children: t('settings.mcpServer.community.install'),
      };
    };

    const buttonProps = getInstallButtonProps();

    return (
      <Card
        hoverable={!isInstalled && !isInstalling}
        className="community-mcp-card bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
        style={{
          height: '100px',
          display: 'flex',
          flexDirection: 'column',
          transition: 'all 0.3s ease',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
        styles={{
          body: {
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
          },
        }}
      >
        {/* Main content layout */}
        <div className="flex items-center justify-between h-full">
          {/* Left side - Logo, title and description */}
          <div className="flex items-center flex-1 min-w-0">
            {/* Logo placeholder */}
            <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center mr-3 flex-shrink-0">
              <div className="w-5 h-5 rounded bg-gray-400 dark:bg-gray-500" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Title and badge row */}
              <div className="flex items-center mb-1">
                <Title
                  level={5}
                  className="truncate text-gray-900 dark:text-gray-100"
                  style={{
                    margin: 0,
                    fontSize: '14px',
                    fontWeight: 600,
                    marginRight: '8px',
                  }}
                  title={config.name}
                >
                  {config.name}
                </Title>
                <Badge
                  color={getTypeColor(config.type)}
                  text={config.type?.toUpperCase()}
                  style={{
                    fontSize: '10px',
                    fontWeight: 500,
                    flexShrink: 0,
                  }}
                />
              </div>

              {/* Description */}
              <Paragraph
                className="text-gray-600 dark:text-gray-400"
                style={{
                  margin: 0,
                  fontSize: '12px',
                  lineHeight: '1.3',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  height: '32px',
                }}
                title={getDescription()}
              >
                {getDescription()}
              </Paragraph>

              {/* Metadata */}
              {(config.author || config.version) && (
                <div className="flex items-center mt-1">
                  <Space size={6}>
                    {config.author && (
                      <Text type="secondary" style={{ fontSize: '11px' }}>
                        # {config.author}
                      </Text>
                    )}
                    {config.version && (
                      <Text type="secondary" style={{ fontSize: '11px' }}>
                        v{config.version}
                      </Text>
                    )}
                  </Space>
                </div>
              )}
            </div>
          </div>

          {/* Right side - Actions */}
          <div className="flex items-center ml-3 flex-shrink-0">
            {/* Documentation button */}
            {config.documentation && (
              <Tooltip title={t('settings.mcpServer.community.viewDocumentation')}>
                <Button
                  type="text"
                  size="small"
                  icon={<ExclamationCircleOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (config.documentation) {
                      window.open(config.documentation, '_blank');
                    }
                  }}
                  className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 mr-2"
                  style={{
                    padding: '2px',
                    fontSize: '12px',
                  }}
                />
              </Tooltip>
            )}

            {/* Install button */}
            <Button
              size="small"
              {...buttonProps}
              style={{
                minWidth: '70px',
                height: '28px',
                fontWeight: 500,
                fontSize: '12px',
                ...buttonProps.style,
              }}
            />
          </div>
        </div>
      </Card>
    );
  },
);

CommunityMcpCard.displayName = 'CommunityMcpCard';
