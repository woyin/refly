import type { WorkflowVariable } from '@refly/openapi-schema';
import { useTranslation } from 'react-i18next';
import { Button, Input, Select, Form, Upload } from 'antd';
import { Play, Refresh, Delete, Attachment } from 'refly-icons';
import { useInitializeWorkflow } from '@refly-packages/ai-workspace-common/hooks/use-initialize-workflow';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useState, useEffect, useCallback, useMemo } from 'react';
import type { UploadFile } from 'antd/es/upload/interface';
import { useFileUpload } from '../workflow-variables';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';
import {
  FileIcon,
  defaultStyles,
} from '@refly-packages/ai-workspace-common/components/common/resource-icon';
import { getFileExtension } from '../workflow-variables/utils';
import {
  FILE_SIZE_LIMITS,
  IMAGE_FILE_EXTENSIONS,
  DOCUMENT_FILE_EXTENSIONS,
  AUDIO_FILE_EXTENSIONS,
  VIDEO_FILE_EXTENSIONS,
} from '../workflow-variables/constants';
import cn from 'classnames';

const RequiredTagText = () => {
  const { t } = useTranslation();
  return (
    <div className="text-[10px] text-refly-text-2 leading-[16px] px-1 border-[1px] border-solid border-refly-Card-Border rounded-[4px]">
      {t('canvas.workflow.variables.required') || 'Required'}
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
      refreshFile(currentFileList, (newFileList: UploadFile[]) => {
        handleValueChange(variableName, newFileList);
      });
    },
    [refreshFile, variableValues, handleValueChange],
  );

  // Get file icon type for display
  const getFileIconType = useCallback((name: string) => {
    const extension = getFileExtension(name);
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension)) {
      return 'image';
    }
    return extension;
  }, []);

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
          label={
            <div className="flex items-center gap-2">
              <span>{name}</span>
              {required && <RequiredTagText />}
            </div>
          }
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
          label={
            <div className="flex items-center gap-2">
              <span>{name}</span>
              {required && <RequiredTagText />}
            </div>
          }
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
          label={
            <div className="flex items-center gap-1">
              <span>{name}</span>
              {required && <RequiredTagText />}
            </div>
          }
          name={name}
          rules={
            required
              ? [{ required: true, message: t('canvas.workflow.variables.uploadPlaceholder') }]
              : []
          }
        >
          <div className="space-y-2" data-field-name={name}>
            <Upload
              className="workflow-run-resource-upload"
              fileList={value || []}
              beforeUpload={(file) => handleFileUpload(file, name)}
              onRemove={(file) => handleFileRemove(file, name)}
              onChange={() => {}} // Handle change is managed by our custom handlers
              multiple={false}
              accept={resourceTypes
                ?.map((type) => {
                  switch (type) {
                    case 'document':
                      return DOCUMENT_FILE_EXTENSIONS.map((ext) => `.${ext}`).join(',');
                    case 'image':
                      return IMAGE_FILE_EXTENSIONS.map((ext) => `.${ext}`).join(',');
                    case 'audio':
                      return AUDIO_FILE_EXTENSIONS.map((ext) => `.${ext}`).join(',');
                    case 'video':
                      return VIDEO_FILE_EXTENSIONS.map((ext) => `.${ext}`).join(',');
                    default:
                      return '';
                  }
                })
                .join(',')}
              listType="text"
              disabled={uploading}
              maxCount={1}
              itemRender={(_originNode, file) => (
                <Spin className="w-full" spinning={uploading}>
                  <div className="w-full h-9 flex items-center justify-between gap-2 box-border px-2 bg-refly-bg-control-z0 rounded-lg hover:bg-refly-tertiary-hover">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <FileIcon
                        extension={getFileIconType(file.name || '')}
                        width={20}
                        height={20}
                        type="icon"
                        {...defaultStyles[getFileIconType(file.name || '')]}
                      />
                      <div className="min-w-0 flex-1 text-sm text-refly-text-0 leading-5 truncate">
                        {file.name}
                      </div>
                    </div>

                    <div className="flex gap-1">
                      <Button
                        size="small"
                        type="text"
                        icon={<Refresh size={16} color="var(--refly-text-1)" />}
                        onClick={() => handleRefreshFile(name)}
                      />
                      <Button
                        size="small"
                        type="text"
                        icon={<Delete size={16} color="var(--refly-text-1)" />}
                        onClick={() => handleFileRemove(file, name)}
                      />
                    </div>
                  </div>
                </Spin>
              )}
            >
              {(!value || value.length === 0) && (
                <Button
                  className="w-full bg-refly-bg-control-z0 border-none"
                  type="default"
                  disabled={uploading}
                  loading={uploading}
                  icon={<Attachment size={18} color="var(--refly-text-0)" />}
                >
                  {t('canvas.workflow.variables.upload') || 'Upload Files'}
                </Button>
              )}
            </Upload>

            <div className=" text-xs text-refly-text-2">
              {t('canvas.workflow.variables.acceptResourceTypes') || 'Accept Resource Types: '}
              {resourceTypes?.map((type, index) => (
                <span key={type}>
                  {index > 0 && '、'}
                  {t('canvas.workflow.variables.fileSizeLimit', {
                    type: t(`canvas.workflow.variables.resourceType.${type}`),
                    size: FILE_SIZE_LIMITS[type],
                  })}
                </span>
              ))}
            </div>
          </div>
        </Form.Item>
      );
    }

    return null;
  };

  return (
    <div className="w-full h-full flex flex-col gap-2">
      <div className="p-4 flex-1 overflow-y-auto">
        <Form form={form} layout="vertical" className="space-y-4" initialValues={variableValues}>
          {workflowVariables.map((variable) => renderFormField(variable))}
        </Form>
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
