import React, { useMemo, useState, useCallback } from 'react';
import { Modal, Form, Input, Radio, Switch, Button, message } from 'antd';
import {
  ToolsetDefinition,
  ToolsetInstance,
  UpsertToolsetRequest,
  ToolsetAuthType,
} from '@refly-packages/ai-workspace-common/requests';
import { useTranslation } from 'react-i18next';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';

interface ToolInstallModalProps {
  mode: 'install' | 'update';
  toolInstance?: ToolsetInstance;
  toolDefinition?: ToolsetDefinition;
  visible: boolean;
  onCancel: () => void;
  onSuccess?: () => void;
}

export const ToolInstallModal = React.memo(
  ({ mode, toolInstance, toolDefinition, visible, onCancel, onSuccess }: ToolInstallModalProps) => {
    const { i18n } = useTranslation();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

    // Get current UI language
    const currentLocale = i18n.language || 'en';

    // Get the source data based on mode
    const sourceData = useMemo(() => {
      if (mode === 'install') {
        return toolDefinition;
      }
      return toolInstance;
    }, [mode, toolDefinition, toolInstance]);

    // Get name value based on mode
    const defaultName = useMemo(() => {
      if (mode === 'install' && toolDefinition?.labelDict) {
        return (
          toolDefinition.labelDict[currentLocale] ||
          toolDefinition.labelDict.en ||
          toolDefinition.key
        );
      }
      if (mode === 'update' && toolInstance?.name) {
        return toolInstance.name;
      }
      return '';
    }, [mode, toolDefinition, toolInstance, currentLocale]);

    // Get auth patterns
    const authPatterns = useMemo(() => {
      return sourceData?.authPatterns || [];
    }, [sourceData]);

    // Get credential schema for selected auth type
    const [selectedAuthType, setSelectedAuthType] = useState<ToolsetAuthType | ''>('');

    const credentialSchema = useMemo(() => {
      if (!selectedAuthType || !authPatterns.length) return null;

      const authPattern = authPatterns.find((pattern) => pattern.type === selectedAuthType);
      if (!authPattern) return null;

      // For now, we'll use a simple schema structure
      // In a real implementation, this would come from the authPattern
      return {
        type: 'object',
        properties: {
          reflyService: {
            type: 'object',
            description: 'ReflyService instance for calling internal services',
          },
          user: {
            type: 'object',
            description: 'User object for authentication and authorization',
          },
        },
        required: ['reflyService', 'user'],
      };
    }, [selectedAuthType, authPatterns]);

    // Get config schema
    const configSchema = useMemo(() => {
      return sourceData?.configSchema;
    }, [sourceData]);

    // Initialize form values
    React.useEffect(() => {
      if (visible && sourceData) {
        const initialValues: Record<string, unknown> = {
          name: defaultName,
          enabled: mode === 'update' ? (toolInstance?.enabled ?? true) : true,
        };

        if (mode === 'update' && toolInstance) {
          initialValues.authType = toolInstance.authType;
          initialValues.authData = toolInstance.authData || {};
          initialValues.config = toolInstance.config || {};
        }

        form.setFieldsValue(initialValues);

        // Set initial auth type if available
        if (mode === 'update' && toolInstance?.authType) {
          setSelectedAuthType(toolInstance.authType);
        }
      }
    }, [visible, sourceData, mode, toolInstance, defaultName, form]);

    // Handle auth type change
    const handleAuthTypeChange = useCallback(
      (value: ToolsetAuthType) => {
        setSelectedAuthType(value);
        // Clear auth data when auth type changes
        form.setFieldValue('authData', {});
      },
      [form],
    );

    // Render auth form fields based on credential schema
    const renderAuthFields = useCallback(() => {
      if (!credentialSchema || !credentialSchema.properties) return null;

      const fields: React.ReactNode[] = [];
      const requiredFields = credentialSchema.required || [];

      for (const [key, schema] of Object.entries(credentialSchema.properties)) {
        const isRequired = Array.isArray(requiredFields) && requiredFields.includes(key);

        fields.push(
          <Form.Item
            key={key}
            label={schema.description || key}
            name={['authData', key]}
            rules={[
              {
                required: isRequired,
                message: `${schema.description || key} is required`,
              },
            ]}
          >
            <Input.TextArea placeholder={`Enter ${schema.description || key}`} rows={3} />
          </Form.Item>,
        );
      }

      return fields;
    }, [credentialSchema]);

    // Render config form fields based on config schema
    const renderConfigFields = useCallback(() => {
      if (!configSchema || !configSchema.properties) return null;

      const fields: React.ReactNode[] = [];
      const requiredFields = configSchema.required || [];

      for (const [key, schema] of Object.entries(configSchema.properties)) {
        const isRequired = Array.isArray(requiredFields) && requiredFields.includes(key);

        fields.push(
          <Form.Item
            key={key}
            label={schema.description || key}
            name={['config', key]}
            rules={[
              {
                required: isRequired,
                message: `${schema.description || key} is required`,
              },
            ]}
          >
            <Input.TextArea placeholder={`Enter ${schema.description || key}`} rows={3} />
          </Form.Item>,
        );
      }

      return fields;
    }, [configSchema]);

    // Handle form submission
    const handleSubmit = useCallback(async () => {
      try {
        const values = await form.validateFields();
        setLoading(true);

        const requestData: UpsertToolsetRequest = {
          name: values.name,
          key: sourceData?.key,
          enabled: values.enabled,
        };

        if (selectedAuthType) {
          requestData.authType = selectedAuthType;
          requestData.authData = values.authData || {};
        }

        if (values.config) {
          requestData.config = values.config;
        }

        let response: any;
        if (mode === 'install') {
          response = await getClient().createToolset({ body: requestData });
        } else {
          requestData.toolsetId = toolInstance?.toolsetId;
          response = await getClient().updateToolset({ body: requestData });
        }

        if (response.error) {
          message.error('Operation failed');
          return;
        }

        message.success(`${mode === 'install' ? 'Installation' : 'Update'} successful`);
        onSuccess?.();
        onCancel();
      } catch (error) {
        console.error('Form validation failed:', error);
      } finally {
        setLoading(false);
      }
    }, [form, mode, sourceData, selectedAuthType, toolInstance, onSuccess, onCancel]);

    const title = mode === 'install' ? 'Install Tool' : 'Update Tool';
    const submitText = mode === 'install' ? 'Install' : 'Update';

    return (
      <Modal
        title={title}
        open={visible}
        onCancel={onCancel}
        footer={[
          <Button key="cancel" onClick={onCancel}>
            Cancel
          </Button>,
          <Button key="submit" type="primary" loading={loading} onClick={handleSubmit}>
            {submitText}
          </Button>,
        ]}
        width={600}
      >
        <Form form={form} layout="vertical" className="space-y-4">
          {/* Name field */}
          <Form.Item
            label="Name"
            name="name"
            rules={[{ required: true, message: 'Please enter a name' }]}
          >
            <Input placeholder="Enter tool name" />
          </Form.Item>

          {/* Auth type selection */}
          {authPatterns.length > 0 && (
            <Form.Item
              label="Authentication Type"
              name="authType"
              rules={[{ required: true, message: 'Please select an authentication type' }]}
            >
              <Radio.Group onChange={(e) => handleAuthTypeChange(e.target.value)}>
                {authPatterns.map((pattern) => (
                  <Radio key={pattern.type} value={pattern.type}>
                    {pattern.type}
                  </Radio>
                ))}
              </Radio.Group>
            </Form.Item>
          )}

          {/* Auth fields */}
          {selectedAuthType && credentialSchema && (
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <h4 className="text-sm font-medium text-gray-700 mb-3">
                Authentication Configuration
              </h4>
              {renderAuthFields()}
            </div>
          )}

          {/* Config fields */}
          {configSchema && (
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Configuration</h4>
              {renderConfigFields()}
            </div>
          )}

          {/* Enabled switch */}
          <Form.Item label="Enabled" name="enabled" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    );
  },
);

ToolInstallModal.displayName = 'ToolInstallModal';
