import React from 'react';
import { Form, Input } from 'antd';
import { useTranslation } from 'react-i18next';

export const StringTypeForm: React.FC = React.memo(() => {
  const { t } = useTranslation();

  return (
    <Form.Item
      required
      label={t('canvas.workflow.variables.value') || 'Variable Value'}
      name={['value', 0, 'text']}
      rules={[
        {
          required: true,
          message: t('canvas.workflow.variables.valueRequired') || 'Variable value is required',
        },
        {
          validator: (_, value) => {
            if (value && value.trim() === '') {
              return Promise.reject(new Error(t('canvas.workflow.variables.valueNotMeaningful')));
            }
            return Promise.resolve();
          },
        },
      ]}
    >
      <Input placeholder={t('canvas.workflow.variables.inputPlaceholder') || 'Please enter'} />
    </Form.Item>
  );
});

StringTypeForm.displayName = 'StringTypeForm';
