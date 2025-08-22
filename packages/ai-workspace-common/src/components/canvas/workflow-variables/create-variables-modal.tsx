import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { WorkflowVariable } from '@refly/openapi-schema';
import { useTranslation } from 'react-i18next';
import { Button, Modal, Form, Input, Switch, Upload, message, Radio, Select } from 'antd';
import { Close, Attachment, List } from 'refly-icons';
import { useMemo, useState, useCallback, useEffect } from 'react';
import { BiText } from 'react-icons/bi';
import cn from 'classnames';
import type { UploadFile } from 'antd/es/upload/interface';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';

interface CreateVariablesModalProps {
  variableType?: 'string' | 'option' | 'resource';
  defaultValue?: WorkflowVariable;
  visible: boolean;
  onCancel: (val: boolean) => void;
  onSave?: (variable: WorkflowVariable) => void;
}

interface VariableFormData {
  name: string;
  value: string[];
  description?: string;
  required: boolean;
  isSingle?: boolean;
  options?: string[];
}

// Separate form data interfaces for each variable type
interface StringTypeFormData {
  name: string;
  value: string[];
  description?: string;
  required: boolean;
}

interface ResourceTypeFormData {
  name: string;
  value: string[];
  description?: string;
  required: boolean;
  isSingle: boolean;
  options: string[];
}

interface OptionTypeFormData {
  name: string;
  value: string[];
  description?: string;
  required: boolean;
  isSingle: boolean;
  options: string[];
}

const defaultStringData = { name: '', value: [], description: '', required: true };
const defaultResourceData = {
  name: '',
  value: [],
  description: '',
  required: true,
  isSingle: true,
  options: [],
};
const defaultOptionData = {
  name: '',
  value: [],
  description: '',
  required: true,
  isSingle: true,
  options: [''],
};
export const CreateVariablesModal = ({
  visible,
  onCancel,
  defaultValue,
  variableType: initialVariableType,
}: CreateVariablesModalProps) => {
  const { t } = useTranslation();
  const [form] = Form.useForm<VariableFormData>();
  const [variableType, setVariableType] = useState<string>(
    defaultValue?.variableType || initialVariableType || 'string',
  );
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectMode, setSelectMode] = useState<'multiple' | undefined>('multiple');
  const { workflow, canvasId } = useCanvasContext();
  const { workflowVariables, refetchWorkflowVariables } = workflow;

  const [stringFormData, setStringFormData] = useState<StringTypeFormData>({
    ...defaultStringData,
  });

  const [resourceFormData, setResourceFormData] = useState<ResourceTypeFormData>({
    ...defaultResourceData,
  });

  const [optionFormData, setOptionFormData] = useState<OptionTypeFormData>({
    ...defaultOptionData,
  });
  const [options, setOptions] = useState<string[]>(defaultValue?.options || []);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');

  const variableTypeOptions = useMemo(() => {
    return [
      {
        label: t('canvas.workflow.variables.variableTypeOptions.string'),
        value: 'string',
        icon: <BiText size={16} />,
      },
      {
        label: t('canvas.workflow.variables.variableTypeOptions.resource'),
        value: 'resource',
        icon: <Attachment size={16} />,
      },
      {
        label: t('canvas.workflow.variables.variableTypeOptions.option'),
        value: 'option',
        icon: <List size={16} />,
      },
    ];
  }, [t]);

  const resetState = useCallback(() => {
    setStringFormData({
      ...defaultStringData,
    });
    setResourceFormData({
      ...defaultResourceData,
    });
    setFileList([]);

    setOptionFormData({
      ...defaultOptionData,
    });
    setOptions([]);
    setEditingIndex(null);
    setEditingValue('');
    form.resetFields();
  }, [
    form,
    setStringFormData,
    setResourceFormData,
    setFileList,
    setOptionFormData,
    setOptions,
    setEditingIndex,
    setEditingValue,
  ]);

  useEffect(() => {
    if (visible) {
      if (defaultValue) {
        setVariableType(defaultValue.variableType || 'string');

        // Initialize form data based on variable type
        if (defaultValue.variableType === 'string') {
          const stringData: StringTypeFormData = {
            name: defaultValue.name || '',
            value: defaultValue.value || [],
            description: defaultValue.description || '',
            required: defaultValue.required ?? true,
          };
          setStringFormData(stringData);
          form.setFieldsValue(stringData);
        } else if (defaultValue.variableType === 'resource') {
          const resourceData: ResourceTypeFormData = {
            name: defaultValue.name || '',
            value: defaultValue.value || [],
            description: defaultValue.description || '',
            required: defaultValue.required ?? true,
            isSingle: defaultValue.isSingle ?? true,
            options: defaultValue.options || [],
          };
          setResourceFormData(resourceData);
          form.setFieldsValue(resourceData);

          // Set file list for resource type
          if (defaultValue.value?.length) {
            const files: UploadFile[] = defaultValue.value.map((url, index) => ({
              uid: `file-${index}`,
              name: `File ${index + 1}`,
              status: 'done',
              url,
            }));
            setFileList(files);
          }
        } else if (defaultValue.variableType === 'option') {
          const optionData: OptionTypeFormData = {
            name: defaultValue.name || '',
            value: defaultValue.value || [],
            description: defaultValue.description || '',
            required: defaultValue.required ?? true,
            isSingle: defaultValue.isSingle ?? true,
            options: defaultValue.options || [''],
          };
          setOptionFormData(optionData);
          setOptions(defaultValue.options || ['']);
          form.setFieldsValue(optionData);
        }
      }
    } else {
      resetState();
    }
  }, [visible]);

  useEffect(() => {
    const isSingle = form.getFieldValue('isSingle');
    setSelectMode(isSingle ? undefined : 'multiple');
  }, [form]);

  useEffect(() => {
    if (variableType === 'option') {
      form.setFieldsValue(optionFormData);
    }
    if (variableType === 'resource') {
      form.setFieldsValue(resourceFormData);
    }
    if (variableType === 'string') {
      form.setFieldsValue(stringFormData);
    }
  }, [form, variableType, optionFormData]);

  // Handle form values change and store in corresponding form data
  const handleFormValuesChange = useCallback(
    (changedValues: Partial<VariableFormData>) => {
      console.log('Form values changed:', { variableType, changedValues });
      if ('isSingle' in changedValues) {
        setSelectMode(changedValues.isSingle ? undefined : 'multiple');
      }

      // Store form data based on current variable type
      const currentFormValues = form.getFieldsValue();
      console.log('Form values changed:', { variableType, changedValues, currentFormValues });

      if (variableType === 'string') {
        setStringFormData((prev) => {
          const newData = { ...prev, ...currentFormValues };
          console.log('Updated stringFormData:', newData);
          return newData;
        });
      } else if (variableType === 'resource') {
        setResourceFormData((prev) => {
          const newData = { ...prev, ...currentFormValues };
          console.log('Updated resourceFormData:', newData);
          return newData;
        });
      } else if (variableType === 'option') {
        setOptionFormData((prev) => {
          const newData = { ...prev, ...currentFormValues };
          console.log('Updated optionFormData:', newData);
          return newData;
        });
      }
    },
    [form, variableType],
  );

  const handleVariableTypeChange = (type: string) => {
    // Store current form data before switching
    const currentFormValues = form.getFieldsValue();
    console.log('Switching from', variableType, 'to', type, 'with values:', currentFormValues);

    if (variableType === 'string') {
      setStringFormData((prev) => {
        const newData = { ...prev, ...currentFormValues };
        console.log('Saving stringFormData:', newData);
        return newData;
      });
    } else if (variableType === 'resource') {
      setResourceFormData((prev) => {
        const newData = { ...prev, ...currentFormValues };
        console.log('Saving resourceFormData:', newData);
        return newData;
      });
    } else if (variableType === 'option') {
      setOptionFormData((prev) => {
        const newData = { ...prev, ...currentFormValues };
        console.log('Saving optionFormData:', newData);
        return newData;
      });
    }

    // Switch to new type
    setVariableType(type);

    // Reset editing states
    setEditingIndex(null);
    setEditingValue('');
  };

  // Update file list and sync with resource form data
  const handleFileListChange = useCallback(
    (newFileList: UploadFile[]) => {
      setFileList(newFileList);

      // Update resource form data with current file list
      if (variableType === 'resource') {
        setResourceFormData((prev) => ({
          ...prev,
          value: newFileList.map((file) => file.url || '').filter((url) => url),
        }));
      }
    },
    [variableType],
  );

  const handleFileUpload = useCallback(
    async (file: File) => {
      try {
        setUploading(true);
        const { data, error } = await getClient().upload({
          body: { file },
        });

        if (error || !data?.data?.url) {
          message.error(t('common.uploadFailed') || 'Upload failed');
          return false;
        }

        // Add file to list
        const newFile: UploadFile = {
          uid: `file-${Date.now()}`,
          name: file.name,
          status: 'done',
          url: data.data.url,
        };

        const newFileList = [...fileList, newFile];
        handleFileListChange(newFileList);
        message.success(t('common.uploadSuccess') || 'Upload successful');
        return false; // Prevent default upload behavior
      } catch (error) {
        console.error('Upload error:', error);
        message.error(t('common.uploadFailed') || 'Upload failed');
        return false;
      } finally {
        setUploading(false);
      }
    },
    [t, fileList, handleFileListChange],
  );

  const handleFileRemove = useCallback(
    (file: UploadFile) => {
      const newFileList = fileList.filter((f) => f.uid !== file.uid);
      handleFileListChange(newFileList);
    },
    [fileList, handleFileListChange],
  );

  // Option management handlers with form data sync
  const handleAddOption = useCallback(() => {
    if (options.length < 10) {
      const newOptions = [...options, ''];
      setOptions(newOptions);
      form.setFieldValue('options', newOptions);

      // Sync with option form data
      if (variableType === 'option') {
        setOptionFormData((prev) => ({
          ...prev,
          options: newOptions,
        }));
      }
    }
  }, [options, form, variableType]);

  const handleRemoveOption = useCallback(
    (index: number) => {
      const newOptions = options.filter((_, i) => i !== index);
      setOptions(newOptions);
      form.setFieldValue('options', newOptions);

      // Update value field if it contains the removed option
      const currentValue = form.getFieldValue('value') || [];
      const filteredValue = currentValue.filter((v: string) => v !== options[index]);
      form.setFieldValue('value', filteredValue);

      // Sync with option form data
      if (variableType === 'option') {
        setOptionFormData((prev) => ({
          ...prev,
          options: newOptions,
          value: filteredValue,
        }));
      }
    },
    [options, form, variableType],
  );

  const handleOptionChange = useCallback(
    (index: number, value: string) => {
      const newOptions = [...options];
      newOptions[index] = value;
      setOptions(newOptions);
      form.setFieldValue('options', newOptions);

      // Sync with option form data
      if (variableType === 'option') {
        setOptionFormData((prev) => ({
          ...prev,
          options: newOptions,
        }));
      }
    },
    [options, form, variableType],
  );

  const handleEditStart = useCallback((index: number, value: string) => {
    setEditingIndex(index);
    setEditingValue(value);
  }, []);

  const handleEditSave = useCallback(
    (index: number) => {
      if (editingValue.trim()) {
        handleOptionChange(index, editingValue.trim());
      }
      setEditingIndex(null);
      setEditingValue('');
    },
    [editingValue, handleOptionChange],
  );

  const handleEditCancel = useCallback(() => {
    setEditingIndex(null);
    setEditingValue('');
  }, []);

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      if (e.key === 'Enter') {
        handleEditSave(index);
      } else if (e.key === 'Escape') {
        handleEditCancel();
      }
    },
    [handleEditSave, handleEditCancel],
  );

  const saveVariable = useCallback(
    async (variable: WorkflowVariable) => {
      const { data, error } = await getClient().updateWorkflowVariables({
        body: {
          canvasId: canvasId,
          variables: [...workflowVariables, variable],
        },
      });

      if (error) {
        throw error;
      }

      message.success(t('canvas.workflow.variables.saveSuccess') || 'Variables saved successfully');
      console.log(data);
    },
    [t, canvasId, workflowVariables],
  );

  const handleSubmit = useCallback(async () => {
    try {
      const values = await form.validateFields();

      // Additional validation for resource type
      if (variableType === 'resource' && fileList.length === 0) {
        message.error(
          t('canvas.workflow.variables.filesRequired') || 'At least one file is required',
        );
        return;
      }

      let finalValue: string[] = values.value;

      // For resource type, get URLs from fileList
      if (variableType === 'resource') {
        finalValue = fileList.map((file) => file.url || '').filter((url) => url);
      }

      const variable: WorkflowVariable = {
        name: values.name,
        value: finalValue,
        description: values.description,
        variableType: variableType as 'string' | 'option' | 'resource',
        required: values.required,
        ...(variableType === 'resource' && {
          isSingle: values.isSingle,
          options: values.isSingle
            ? values.options?.[0]
              ? [values.options[0]]
              : []
            : values.options || [],
        }),
        ...(variableType === 'option' && {
          isSingle: values.isSingle,
          options: values.options || [],
        }),
      };

      await saveVariable(variable);
      refetchWorkflowVariables();
      onCancel(false);
    } catch (error) {
      console.error('Form validation failed:', error);
    }
  }, [form, variableType, fileList, onCancel, t, saveVariable, refetchWorkflowVariables]);

  const handleModalClose = useCallback(() => {
    onCancel(false);
  }, [onCancel]);

  const renderStringTypeForm = () => (
    <>
      <Form.Item
        label={t('canvas.workflow.variables.name') || 'Variable Name'}
        name="name"
        rules={[
          {
            required: true,
            message: t('canvas.workflow.variables.nameRequired') || 'Variable name is required',
          },
          {
            pattern: /^[a-zA-Z_][a-zA-Z0-9_]*$/,
            message: t('canvas.workflow.variables.nameInvalid') || 'Invalid variable name format',
          },
        ]}
      >
        <Input
          placeholder={t('canvas.workflow.variables.namePlaceholder') || 'Enter variable name'}
        />
      </Form.Item>

      <Form.Item
        label={t('canvas.workflow.variables.value') || 'Variable Value'}
        name="value"
        rules={[
          {
            required: true,
            message: t('canvas.workflow.variables.valueRequired') || 'Variable value is required',
          },
        ]}
      >
        <Input.TextArea
          placeholder={t('canvas.workflow.variables.valuePlaceholder') || 'Enter variable value'}
          rows={3}
          onChange={(e) => {
            // Convert text to array format
            const textValue = e.target.value;
            form.setFieldValue('value', textValue ? [textValue] : []);
          }}
        />
      </Form.Item>

      <Form.Item
        label={t('canvas.workflow.variables.required') || 'Required'}
        name="required"
        valuePropName="checked"
      >
        <Switch />
      </Form.Item>
    </>
  );

  const renderResourceTypeForm = () => (
    <>
      <Form.Item
        label={t('canvas.workflow.variables.name') || 'Variable Name'}
        name="name"
        rules={[
          {
            required: true,
            message: t('canvas.workflow.variables.nameRequired') || 'Variable name is required',
          },
          {
            pattern: /^[a-zA-Z_][a-zA-Z0-9_]*$/,
            message: t('canvas.workflow.variables.nameInvalid') || 'Invalid variable name format',
          },
        ]}
      >
        <Input
          placeholder={t('canvas.workflow.variables.namePlaceholder') || 'Enter variable name'}
        />
      </Form.Item>

      <Form.Item
        label={t('canvas.workflow.variables.multiple') || 'Select Settings'}
        name="isSingle"
      >
        <Radio.Group>
          <Radio value={true}>
            {t('canvas.workflow.variables.singleSelect') || 'Single Select'}
          </Radio>
          <Radio value={false}>
            {t('canvas.workflow.variables.multipleSelect') || 'Multiple Select'}
          </Radio>
        </Radio.Group>
      </Form.Item>

      <Form.Item
        label={t('canvas.workflow.variables.optionResource') || 'Option Resource'}
        required
        help={
          fileList.length === 0
            ? t('canvas.workflow.variables.optionResourceRequired') ||
              'At least one file is required'
            : ''
        }
        validateStatus={fileList.length === 0 ? 'error' : 'success'}
      >
        <Upload
          fileList={fileList}
          beforeUpload={handleFileUpload}
          onRemove={handleFileRemove}
          multiple={true}
          accept="*/*"
          listType="text"
          disabled={uploading}
        >
          <Button type="dashed" disabled={uploading} loading={uploading}>
            {t('common.upload') || 'Upload Files'}
          </Button>
        </Upload>
      </Form.Item>

      <Form.Item
        label={t('canvas.workflow.variables.value') || 'Value'}
        name="value"
        required
        help={
          fileList.length === 0
            ? t('canvas.workflow.variables.uploadFileFirst') || 'Please upload files first'
            : ''
        }
        validateStatus={fileList.length === 0 ? 'error' : 'success'}
      >
        <Select
          mode={selectMode}
          placeholder={t('canvas.workflow.variables.resourceValuePlaceholder') || 'Select files'}
          disabled={fileList.length === 0}
          options={fileList.map((file, index) => ({
            label: file.name || `File ${index + 1}`,
            value: file.url || `file-${index}`,
          }))}
        />
      </Form.Item>

      <Form.Item
        label={t('canvas.workflow.variables.required') || 'Required'}
        name="required"
        valuePropName="checked"
      >
        <Switch />
      </Form.Item>
    </>
  );

  const renderOptionTypeForm = () => {
    return (
      <>
        <Form.Item
          label={t('canvas.workflow.variables.name') || 'Variable Name'}
          name="name"
          rules={[
            {
              required: true,
              message: t('canvas.workflow.variables.nameRequired') || 'Variable name is required',
            },
            {
              pattern: /^[a-zA-Z_][a-zA-Z0-9_]*$/,
              message: t('canvas.workflow.variables.nameInvalid') || 'Invalid variable name format',
            },
          ]}
        >
          <Input
            placeholder={t('canvas.workflow.variables.namePlaceholder') || 'Enter variable name'}
          />
        </Form.Item>

        <Form.Item
          label={t('canvas.workflow.variables.selectMode') || 'Selection Mode'}
          name="isSingle"
        >
          <Radio.Group>
            <Radio value={true}>
              {t('canvas.workflow.variables.singleSelect') || 'Single Select'}
            </Radio>
            <Radio value={false}>
              {t('canvas.workflow.variables.multipleSelect') || 'Multiple Select'}
            </Radio>
          </Radio.Group>
        </Form.Item>

        <Form.Item
          label={t('canvas.workflow.variables.options') || 'Options'}
          name="options"
          rules={[
            {
              required: true,
              message:
                t('canvas.workflow.variables.optionsRequired') || 'At least one option is required',
            },
            {
              validator: (_, value) => {
                // Ensure value is an array
                if (!Array.isArray(value)) {
                  return Promise.reject(
                    new Error(
                      t('canvas.workflow.variables.optionsRequired') ||
                        'At least one option is required',
                    ),
                  );
                }

                if (value.length === 0) {
                  return Promise.reject(
                    new Error(
                      t('canvas.workflow.variables.optionsRequired') ||
                        'At least one option is required',
                    ),
                  );
                }

                if (value.some((opt: string) => !opt || !opt.trim())) {
                  return Promise.reject(
                    new Error(
                      t('canvas.workflow.variables.optionsEmpty') || 'Options cannot be empty',
                    ),
                  );
                }
                return Promise.resolve();
              },
            },
          ]}
        >
          <div className="space-y-2">
            {options.map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="flex items-center justify-center w-6 h-6 text-gray-400 cursor-move">
                  <div className="w-1.5 h-1.5 bg-gray-300 rounded-full mx-0.5" />
                  <div className="w-1.5 h-1.5 bg-gray-300 rounded-full mx-0.5" />
                  <div className="w-1.5 h-1.5 bg-gray-300 rounded-full mx-0.5" />
                </div>

                {editingIndex === index ? (
                  <Input
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    onPressEnter={() => handleEditSave(index)}
                    onKeyDown={(e) => handleKeyPress(e, index)}
                    onBlur={() => handleEditSave(index)}
                    autoFocus
                    className="flex-1"
                  />
                ) : (
                  <div
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-md cursor-text hover:border-gray-300"
                    onClick={() => handleEditStart(index, option)}
                  >
                    {option || t('canvas.workflow.variables.clickToEdit') || 'Click to edit'}
                  </div>
                )}

                <Button
                  type="text"
                  size="small"
                  icon={<Close size={16} />}
                  onClick={() => handleRemoveOption(index)}
                  className="text-gray-400 hover:text-red-500"
                  disabled={options.length === 1}
                />
              </div>
            ))}

            {options.length < 10 && (
              <Button
                type="dashed"
                onClick={handleAddOption}
                className="w-full"
                icon={<span className="text-lg">+</span>}
              >
                {t('canvas.workflow.variables.addOption') || 'Add Option'}
              </Button>
            )}

            <div className="text-xs text-gray-500">
              {t('canvas.workflow.variables.maxOptions') || 'Maximum 10 options allowed'}
            </div>
          </div>
        </Form.Item>

        <Form.Item
          label={t('canvas.workflow.variables.value') || 'Variable Value'}
          name="value"
          rules={[
            {
              required: form.getFieldValue('required'),
              message: t('canvas.workflow.variables.valueRequired') || 'Variable value is required',
            },
          ]}
        >
          <Select
            mode={form.getFieldValue('isSingle') ? undefined : 'multiple'}
            placeholder={t('canvas.workflow.variables.selectOptions') || 'Select options'}
            options={options
              .filter((opt) => opt.trim())
              .map((option) => ({
                label: option,
                value: option,
              }))}
            disabled={options.length === 0 || options.every((opt) => !opt.trim())}
          />
        </Form.Item>

        <Form.Item
          label={t('canvas.workflow.variables.required') || 'Required'}
          name="required"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
      </>
    );
  };

  const renderForm = () => {
    switch (variableType) {
      case 'string':
        return renderStringTypeForm();
      case 'resource':
        return renderResourceTypeForm();
      case 'option':
        return renderOptionTypeForm();
      default:
        return null;
    }
  };

  return (
    <Modal
      centered
      open={visible}
      onCancel={handleModalClose}
      closable={false}
      title={null}
      footer={null}
      width={600}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="text-refly-text-0 text-lg font-semibold leading-6">
            {t(`canvas.workflow.variables.${defaultValue ? 'editTitle' : 'addTitle'}`) ||
              (defaultValue ? 'Edit Variable' : 'Add Variable')}
          </div>
          <Button type="text" icon={<Close size={24} />} onClick={handleModalClose} />
        </div>

        <div className="flex-grow min-h-0 overflow-y-auto">
          <div className="text-xs text-refly-text-0 mb-2 font-semibold">
            {t('canvas.workflow.variables.variableType') || 'Variable Type'}
          </div>

          <div className="flex items-center justify-between gap-2 mb-4">
            {variableTypeOptions.map((option) => (
              <div
                key={option.value}
                className={cn(
                  'flex-1 px-2 py-1 text-sm leading-5 flex items-center justify-center gap-1 rounded-lg bg-refly-bg-control-z1 border-[1px] border-solid border-refly-Card-Border hover:!text-refly-primary-default hover:!border-refly-primary-default cursor-pointer',
                  variableType === option.value
                    ? 'text-refly-primary-default border-refly-primary-default font-semibold'
                    : '',
                )}
                onClick={() => handleVariableTypeChange(option.value)}
              >
                {option.icon}
                {option.label}
              </div>
            ))}
          </div>

          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            onValuesChange={handleFormValuesChange}
            initialValues={{
              required: true,
              isSingle: true,
              value: [],
              options: [],
            }}
          >
            {renderForm()}
          </Form>
        </div>

        <div className="flex items-center justify-end gap-3">
          <Button onClick={handleModalClose}>{t('common.cancel') || 'Cancel'}</Button>
          <Button type="primary" onClick={handleSubmit}>
            {t('common.save') || 'Save'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
