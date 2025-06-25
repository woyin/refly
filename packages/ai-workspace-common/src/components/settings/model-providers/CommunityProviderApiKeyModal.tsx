import React, { memo } from 'react';
import { Modal, Form, Input, Button, Alert, Space, Typography } from 'antd';
import { KeyOutlined, ExclamationCircleOutlined, LinkOutlined } from '@ant-design/icons';

import { CommunityProviderConfig } from './provider-store-types';

const { Text, Link } = Typography;

interface ApiKeyConfiguration {
  apiKey: string;
  baseUrl?: string;
  [key: string]: any;
}

interface CommunityProviderApiKeyModalProps {
  visible: boolean;
  config: CommunityProviderConfig;
  onClose: () => void;
  onSuccess?: (userConfig: { apiKey: string; baseUrl?: string }) => void;
  loading?: boolean;
}

export const CommunityProviderApiKeyModal: React.FC<CommunityProviderApiKeyModalProps> = memo(
  ({ visible, config, onClose, onSuccess, loading: externalLoading }) => {
    const [form] = Form.useForm<ApiKeyConfiguration>();

    // Handle installation with API key
    const handleInstall = async (values: ApiKeyConfiguration) => {
      try {
        // Call the parent's onSuccess handler with the user configuration
        onSuccess?.({
          apiKey: values.apiKey,
          baseUrl: values.baseUrl || config.baseUrl,
        });
      } catch (error) {
        console.error('Install error:', error);
      }
    };

    // Handle modal close
    const handleClose = () => {
      form.resetFields();
      onClose();
    };

    // Get localized description
    const description =
      typeof config.description === 'object'
        ? config.description?.['zh-CN'] || config.description?.en || ''
        : config.description || '';

    const isLoading = externalLoading;

    return (
      <Modal
        title={
          <Space>
            <KeyOutlined />
            配置 API Key
          </Space>
        }
        open={visible}
        onCancel={handleClose}
        width={520}
        footer={null}
        destroyOnClose
        maskClosable={!isLoading}
      >
        <div className="space-y-4">
          {/* Provider information */}
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <div className="flex items-center mb-2">
              <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center mr-3">
                {config.icon ? (
                  <img src={config.icon} alt={config.name} className="w-5 h-5 object-contain" />
                ) : (
                  <div className="w-4 h-4 rounded bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-semibold">
                    {config.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <Text strong className="text-gray-900">
                    {config.name}
                  </Text>
                  {config.documentation && (
                    <Link
                      href={config.documentation}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:text-blue-600"
                    >
                      <Space size={4}>
                        <LinkOutlined />
                        <span className="text-xs">文档</span>
                      </Space>
                    </Link>
                  )}
                </div>
                <div className="text-xs text-gray-500">{description}</div>
              </div>
            </div>
          </div>

          {/* API key requirement notice */}
          <Alert
            type="info"
            icon={<ExclamationCircleOutlined />}
            message="需要 API Key"
            description="此提供商需要您提供 API Key 才能使用。请从提供商官网获取 API Key 并填写在下方。"
            showIcon
          />

          {/* API key configuration form */}
          <Form form={form} layout="vertical" onFinish={handleInstall} disabled={isLoading}>
            <Form.Item
              name="apiKey"
              label="API Key"
              rules={[
                {
                  required: true,
                  message: '请输入 API Key',
                },
                {
                  min: 1,
                  message: '请输入有效的 API Key',
                },
              ]}
            >
              <Input.Password
                placeholder="请输入您的 API Key"
                prefix={<KeyOutlined />}
                size="large"
              />
            </Form.Item>

            {/* Optional base URL field */}
            <Form.Item
              name="baseUrl"
              label="Base URL (可选)"
              extra="如需使用自定义服务地址，请填写此项"
            >
              <Input placeholder={config.baseUrl || '使用默认地址'} size="large" />
            </Form.Item>

            {/* Footer buttons */}
            <div className="flex justify-end space-x-2 pt-4">
              <Button onClick={handleClose} disabled={isLoading}>
                取消
              </Button>
              <Button type="primary" htmlType="submit" loading={isLoading} disabled={isLoading}>
                {isLoading ? '安装中...' : '安装'}
              </Button>
            </div>
          </Form>
        </div>
      </Modal>
    );
  },
);

CommunityProviderApiKeyModal.displayName = 'CommunityProviderApiKeyModal';
