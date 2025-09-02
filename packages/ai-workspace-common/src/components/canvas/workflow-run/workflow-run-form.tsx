import type { WorkflowVariable } from '@refly/openapi-schema';
import { useTranslation } from 'react-i18next';
import { Button, Input, Select, Form, Typography } from 'antd';
import { Play } from 'refly-icons';
import { useInitializeWorkflow } from '@refly-packages/ai-workspace-common/hooks/use-initialize-workflow';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useState, useEffect, useCallback, useMemo } from 'react';
import type { UploadFile } from 'antd/es/upload/interface';
import { useFileUpload } from '../workflow-variables';
import { ResourceUpload } from './resource-upload';
import { getFileExtension } from '../workflow-variables/utils';
import cn from 'classnames';

const RequiredTagText = () => {
  const { t } = useTranslation();
  return (
    <div className="flex-shrink-0 text-[10px] text-refly-text-2 leading-[16px] px-1 border-[1px] border-solid border-refly-Card-Border rounded-[4px]">
      {t('canvas.workflow.variables.required') || 'Required'}
    </div>
  );
};

const FormItemLabel = ({ name, required }: { name: string; required: boolean }) => {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <Typography.Paragraph
        ellipsis={{ rows: 1, tooltip: true }}
        className="!m-0 text-xs font-semibold text-refly-text-0 leading-4"
      >
        {name}
      </Typography.Paragraph>

      {required && <RequiredTagText />}
    </div>
  );
};

interface WorkflowRunFormProps {
  workflowVariables: WorkflowVariable[];
  refetchWorkflowVariables: () => void;
}

export const WorkflowRunForm = ({
  workflowVariables,
  refetchWorkflowVariables,
}: WorkflowRunFormProps) => {
  const { t } = useTranslation();
  const { canvasId } = useCanvasContext();
  const { initializeWorkflow, loading } = useInitializeWorkflow();
  const [isRunning, setIsRunning] = useState(false);
  const [form] = Form.useForm();
  const [variableValues, setVariableValues] = useState<Record<string, any>>({});

  // File upload hook
  const {
    uploading,
    handleFileUpload: uploadFile,
    handleRefreshFile: refreshFile,
  } = useFileUpload();

  // Check if all required fields are filled
  const isFormValid = useMemo(() => {
    return workflowVariables.every((variable) => {
      if (!variable.required) {
        return true;
      }

      const value = variableValues[variable.name];

      if (variable.variableType === 'string') {
        return value && value.trim() !== '';
      }

      if (variable.variableType === 'option') {
        return value && (Array.isArray(value) ? value.length > 0 : value);
      }

      if (variable.variableType === 'resource') {
        return value && Array.isArray(value) && value.length > 0;
      }

      return false;
    });
  }, [workflowVariables, variableValues]);

  const convertVariableToFormValue = useCallback(() => {
    const formValues: Record<string, any> = {};

    for (const variable of workflowVariables) {
      if (variable.variableType === 'string') {
        formValues[variable.name] = variable.value?.[0]?.text ?? '';
      } else if (variable.variableType === 'option') {
        formValues[variable.name] = variable.value.map((v) => v.text);
      } else if (variable.variableType === 'resource') {
        // Convert resource values to UploadFile format
        const fileList: UploadFile[] =
          variable.value?.map((v, index) => ({
            uid: `file-${index}`,
            name: v.resource?.name || '',
            status: 'done',
            url: v.resource?.storageKey || '',
          })) || [];
        formValues[variable.name] = fileList;
      }
    }

    return formValues;
  }, [workflowVariables]);

  const convertFormValueToVariable = useCallback(() => {
    const newVariables: WorkflowVariable[] = [];
    for (const variable of workflowVariables) {
      const value = variableValues[variable.name];
      if (variable.variableType === 'string') {
        newVariables.push({
          ...variable,
          value: [{ type: 'text', text: value }],
        });
      } else if (variable.variableType === 'option') {
        newVariables.push({
          ...variable,
          value: value.map((v) => ({ type: 'text', text: v })),
        });
      } else if (variable.variableType === 'resource') {
        newVariables.push({
          ...variable,
          value: value.map((v) => ({
            type: 'resource',
            resource: {
              name: v.name,
              storageKey: v.url,
              fileType: getFileExtension(v.name),
            },
          })),
        });
      }
    }
    return newVariables;
  }, [workflowVariables, variableValues]);

  // Handle form value changes
  const handleValueChange = (variableName: string, value: any) => {
    setVariableValues((prev) => ({
      ...prev,
      [variableName]: value,
    }));
  };

  // Handle file upload for resource type variables
  const handleFileUpload = useCallback(
    async (file: File, variableName: string) => {
      const currentFileList = variableValues[variableName] || [];
      const result = await uploadFile(file, currentFileList);

      if (result && typeof result === 'object' && 'storageKey' in result) {
        // Create new file with storageKey
        const newFile: UploadFile = {
          uid: result.uid,
          name: file.name,
          status: 'done',
          url: result.storageKey, // Store storageKey in url field
        };

        // Replace the file list with the new file (single file limit)
        const newFileList = [newFile];
        handleValueChange(variableName, newFileList);
        form.setFieldsValue({
          [variableName]: newFileList,
        });
        return false; // Prevent default upload behavior
      }
      return false;
    },
    [uploadFile, variableValues],
  );

  // Handle file removal for resource type variables
  const handleFileRemove = useCallback(
    (file: UploadFile, variableName: string) => {
      const currentFileList = variableValues[variableName] || [];
      const newFileList = currentFileList.filter((f: UploadFile) => f.uid !== file.uid);
      handleValueChange(variableName, newFileList);
      form.setFieldsValue({
        [variableName]: newFileList,
      });
    },
    [variableValues, handleValueChange],
  );

  // Handle file refresh for resource type variables
  const handleRefreshFile = useCallback(
    (variableName: string) => {
      const currentFileList = variableValues[variableName] || [];
      // Find the variable to get its resourceTypes
      const variable = workflowVariables.find((v) => v.name === variableName);
      const resourceTypes = variable?.resourceTypes;

      refreshFile(
        currentFileList,
        (newFileList: UploadFile[]) => {
          handleValueChange(variableName, newFileList);
          form.setFieldsValue({
            [variableName]: newFileList,
          });
        },
        resourceTypes,
      );
    },
    [refreshFile, variableValues, handleValueChange, form, workflowVariables],
  );

  // Update form values when workflowVariables change
  useEffect(() => {
    const newValues = convertVariableToFormValue();
    setVariableValues(newValues);
    form.setFieldsValue(newValues);
  }, [workflowVariables, form]);

  const saveWorkflowVariables = async () => {
    const newVariables = convertFormValueToVariable();
    setIsRunning(true);
    try {
      const { data } = await getClient().updateWorkflowVariables({
        body: {
          canvasId,
          variables: newVariables,
        },
      });
      if (data.success) {
        refetchWorkflowVariables();
        setTimeout(() => {
          setIsRunning(false);
        }, 500);

        return true;
      }
      setIsRunning(false);
      return false;
    } catch (error) {
      console.error('Failed to save workflow variables:', error);
      setIsRunning(false);
      return false;
    }
  };

  const handleRun = async () => {
    if (!canvasId || loading || isRunning) {
      return;
    }

    try {
      // Validate form before running
      await form.validateFields();

      // If validation passes, proceed with running
      const success = await saveWorkflowVariables();
      if (!success) {
        return;
      }
      initializeWorkflow(canvasId);
    } catch (error) {
      // Form validation failed, scroll to first error
      if (error?.errorFields && error.errorFields.length > 0) {
        const firstErrorField = error.errorFields[0];
        const fieldName = firstErrorField.name;
        if (Array.isArray(fieldName) && fieldName.length > 0) {
          const fieldNameStr = fieldName[0];

          // Try to find the form item container first
          let element = document.querySelector(`[name="${fieldNameStr}"]`) as HTMLElement;

          if (!element) {
            // If direct input not found, try to find the form item container
            element = document.querySelector(`[data-field-name="${fieldNameStr}"]`) as HTMLElement;
          }

          if (element) {
            // Find the scrollable container
            const scrollContainer = document.querySelector(
              '.p-4.flex-1.overflow-y-auto',
            ) as HTMLElement;

            if (scrollContainer) {
              // Calculate the scroll position
              const containerRect = scrollContainer.getBoundingClientRect();
              const elementRect = element.getBoundingClientRect();
              const currentScrollTop = scrollContainer.scrollTop;
              const targetScrollTop = currentScrollTop + elementRect.top - containerRect.top - 40;

              // Smooth scroll to the target position
              scrollContainer.scrollTo({
                top: targetScrollTop,
                behavior: 'smooth',
              });
            } else {
              // Fallback to default scrollIntoView
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }

            // Focus on the first error field with delay
            setTimeout(() => {
              // Try to focus on the input element if it exists
              const inputElement = element.querySelector('input, select') as HTMLElement;
              if (inputElement?.focus) {
                inputElement.focus();
              } else if (element?.focus) {
                element.focus();
              }
            }, 400);
          }
        }
      }
    }
  };

  // Render form field based on variable type
  const renderFormField = (variable: WorkflowVariable) => {
    if (!variable) {
      return null;
    }
    const { name, required, variableType, options, isSingle, resourceTypes } = variable;
    const value = variableValues[name];

    if (variableType === 'string') {
      return (
        <Form.Item
          key={name}
          label={<FormItemLabel name={name} required={required} />}
          name={name}
          rules={
            required
              ? [{ required: true, message: t('canvas.workflow.variables.inputPlaceholder') }]
              : []
          }
          data-field-name={name}
        >
          <Input
            variant="filled"
            placeholder="请输入"
            value={value}
            onChange={(e) => handleValueChange(name, e.target.value)}
            data-field-name={name}
          />
        </Form.Item>
      );
    }

    if (variableType === 'option') {
      return (
        <Form.Item
          key={name}
          label={<FormItemLabel name={name} required={required} />}
          name={name}
          rules={
            required
              ? [{ required: true, message: t('canvas.workflow.variables.selectPlaceholder') }]
              : []
          }
        >
          <Select
            variant="filled"
            placeholder="请选择"
            mode={isSingle ? undefined : 'multiple'}
            value={value}
            onChange={(val) => handleValueChange(name, val)}
            options={options?.map((opt) => ({ label: opt, value: opt })) ?? []}
            data-field-name={name}
          />
        </Form.Item>
      );
    }

    if (variableType === 'resource') {
      return (
        <Form.Item
          key={name}
          label={<FormItemLabel name={name} required={required} />}
          name={name}
          rules={
            required
              ? [{ required: true, message: t('canvas.workflow.variables.uploadPlaceholder') }]
              : []
          }
        >
          <ResourceUpload
            value={value || []}
            onUpload={(file) => handleFileUpload(file, name)}
            onRemove={(file) => handleFileRemove(file, name)}
            onRefresh={() => handleRefreshFile(name)}
            resourceTypes={resourceTypes}
            disabled={uploading}
            maxCount={1}
            data-field-name={name}
          />
        </Form.Item>
      );
    }

    return null;
  };

  return (
    <div className="w-full h-full flex flex-col gap-2">
      <div className="p-4 flex-1 overflow-y-auto">
        {workflowVariables.length > 0 ? (
          <Form form={form} layout="vertical" className="space-y-4" initialValues={variableValues}>
            {workflowVariables.map((variable) => renderFormField(variable))}
          </Form>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-full px-3 py-6 gap-0.5 flex items-center justify-center bg-refly-bg-control-z0 rounded-lg text-xs text-refly-text-1 leading-4">
              {t('canvas.workflow.run.empty') ||
                'No variables defined, the workflow will be executed once if continued.'}
            </div>
          </div>
        )}
      </div>

      <div className="p-3 border-solid border-[1px] border-x-0 border-b-0 border-refly-Card-Border rounded-b-lg">
        <Button
          className={cn(
            'w-full',
            !isFormValid &&
              'bg-refly-bg-control-z0 hover:!bg-refly-tertiary-hover !text-refly-text-3 font-semibold',
          )}
          type="primary"
          icon={<Play size={16} color={!isFormValid ? 'var(--refly-text-3)' : 'white'} />}
          onClick={handleRun}
          loading={loading || isRunning}
          disabled={loading || isRunning}
        >
          {t('canvas.workflow.run.run') || 'Run'}
        </Button>
      </div>
    </div>
  );
};
