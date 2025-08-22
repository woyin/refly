import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { WorkflowVariable } from '@refly/openapi-schema';
import { useTranslation } from 'react-i18next';
import { Button, Modal, Form, Input, Checkbox, Upload, message, Radio } from 'antd';
import { Close, Attachment, List, Add, Delete } from 'refly-icons';
import { MdOutlineDragIndicator } from 'react-icons/md';
import { useMemo, useState, useCallback, useEffect } from 'react';
import { BiText } from 'react-icons/bi';
import cn from 'classnames';
import type { UploadFile } from 'antd/es/upload/interface';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import './index.scss';
import { genVariableID } from '@refly/utils';

const MAX_OPTIONS = 20;

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
  currentOption?: string;
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
}

interface OptionTypeFormData {
  name: string;
  value: string[];
  description?: string;
  required: boolean;
  isSingle: boolean;
  options: string[];
}

const defaultStringData = {
  name: '',
  value: [],
  description: '',
  required: true,
  isSingle: true,
  options: [],
};
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
  options: [],
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
  const [currentOption, setCurrentOption] = useState<string>('');

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
    setCurrentOption('');
    form.resetFields();
  }, [
    form,
    setStringFormData,
    setResourceFormData,
    setFileList,
    setOptionFormData,
    setOptions,
    setEditingIndex,
    setCurrentOption,
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
            options: defaultValue.options || [],
          };
          setOptionFormData(optionData);
          setOptions(defaultValue.options || []);
          form.setFieldsValue(optionData);
          setCurrentOption('');
        }
      }
    } else {
      resetState();
    }
  }, [visible]);

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

  const setOptionsValue = useCallback(
    (options: string[]) => {
      setOptions(options);
      if (variableType === 'option') {
        setOptionFormData((prev) => ({ ...prev, options, value: options[0] ? [options[0]] : [] }));
      }
    },
    [variableType],
  );

  // Option management handlers with form data sync
  const handleAddOption = useCallback(() => {
    if (options.length < MAX_OPTIONS) {
      const filteredOptions = options.filter((option) => option && option.trim().length > 0);
      const newOptions = [...filteredOptions, ''];
      setOptionsValue(newOptions);

      // Auto focus the new input field
      const newIndex = newOptions.length - 1;
      setEditingIndex(newIndex);
      setCurrentOption('');
      form.setFieldValue('currentOption', '');
    }
  }, [options, setOptionsValue, form]);

  const handleRemoveOption = useCallback(
    (index: number) => {
      const newOptions = options.filter((_, i) => i !== index);
      setOptionsValue(newOptions);
    },
    [options, setOptionsValue],
  );

  const handleOptionChange = useCallback(
    (index: number, value: string) => {
      const newOptions = [...options];
      newOptions[index] = value;

      const cleanedOptions = newOptions.filter((option) => option && option.trim().length > 0);
      setOptionsValue(cleanedOptions);
    },
    [options, setOptionsValue],
  );

  const handleEditStart = useCallback(
    (index: number) => {
      setEditingIndex(index);
      const value = options?.[index] ?? '';
      setCurrentOption(value);
      form.setFieldValue('currentOption', value);
    },
    [setEditingIndex, options, form],
  );

  const handleEditSave = useCallback(
    (value: string, index: number) => {
      const trimmedValue = value.trim();

      if (trimmedValue) {
        handleOptionChange(index, trimmedValue);
      } else {
        handleRemoveOption(index);
      }
    },
    [handleOptionChange, handleRemoveOption],
  );

  const saveVariable = useCallback(
    async (variable: WorkflowVariable) => {
      const existingIndex = workflowVariables.findIndex(
        (v) => v.variableId === variable.variableId,
      );

      let newWorkflowVariables: WorkflowVariable[];
      if (existingIndex !== -1) {
        newWorkflowVariables = [...workflowVariables];
        newWorkflowVariables[existingIndex] = variable;
      } else {
        newWorkflowVariables = [...workflowVariables, variable];
      }

      const { data, error } = await getClient().updateWorkflowVariables({
        body: {
          canvasId: canvasId,
          variables: newWorkflowVariables,
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
      console.log('values', values, options);

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

      // For option type, set default value to first option if no value is selected
      if (variableType === 'option') {
        const firstOption = values.options?.[0];
        finalValue = [firstOption];
      }

      const variable: WorkflowVariable = {
        variableId: defaultValue?.variableId || genVariableID(),
        name: values.name,
        value: finalValue,
        description: values.description,
        variableType: variableType as 'string' | 'option' | 'resource',
        required: values.required,
        ...(variableType === 'resource' && {
          isSingle: values.isSingle,
          options: [],
        }),
        ...(variableType === 'option' && {
          isSingle: values.isSingle,
          options: options || [],
        }),
      };

      console.log('variable', variable);
      await saveVariable(variable);
      refetchWorkflowVariables();
      onCancel(false);
    } catch (error) {
      console.error('Form validation failed:', error);
    }
  }, [form, variableType, fileList, onCancel, t, saveVariable, refetchWorkflowVariables, options]);

  const handleModalClose = useCallback(() => {
    onCancel(false);
  }, [onCancel]);

  const renderStringTypeForm = () => (
    <Form.Item label={t('canvas.workflow.variables.value') || 'Variable Value'} name="value">
      <Input
        placeholder={t('canvas.workflow.variables.inputPlaceholder') || 'Please enter'}
        maxLength={200}
        showCount
      />
    </Form.Item>
  );

  const renderResourceTypeForm = () => (
    <>
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
    </>
  );

  const renderOptionTypeForm = () => {
    return (
      <>
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
          name="currentOption"
          rules={[
            {
              validator: async (_, _value) => {
                if (options.length < 1) {
                  throw new Error(
                    t('canvas.workflow.variables.optionsRequired') ||
                      'At least one option is required',
                  );
                }
                const uniqueOptions = new Set(options);
                if (uniqueOptions.size !== options.length) {
                  throw new Error(
                    t('canvas.workflow.variables.duplicateOption') ||
                      'Duplicate option value is not allowed',
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
                {editingIndex === index ? (
                  <Input
                    value={currentOption}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCurrentOption(val);
                      handleOptionChange(index, val);
                      form.setFieldValue('currentOption', val ?? '');
                    }}
                    onBlur={() => {
                      handleEditSave(currentOption ?? '', index);
                      setEditingIndex(null);
                    }}
                    autoFocus
                    className="flex-1"
                    data-option-index={index}
                  />
                ) : (
                  <div
                    className="group w-full h-8 p-2 flex items-center gap-2 box-border border-[1px] border-solid border-refly-Card-Border rounded-lg hover:bg-refly-tertiary-hover cursor-pointer"
                    onClick={() => handleEditStart(index)}
                  >
                    <MdOutlineDragIndicator className="text-refly-text-3 cursor-move" size={16} />
                    <div
                      className={cn('flex-1 text-sm leading-5 truncate', {
                        'text-refly-text-3': !option,
                      })}
                    >
                      {option || t('canvas.workflow.variables.clickToEdit') || 'Click to edit'}
                    </div>
                    <Button
                      className="hidden group-hover:block"
                      type="text"
                      size="small"
                      icon={<Delete size={16} color="var(--refly-text-1)" />}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        handleRemoveOption(index);
                      }}
                    />
                  </div>
                )}
              </div>
            ))}

            {options.length < MAX_OPTIONS && (
              <Button
                type="default"
                onClick={handleAddOption}
                className="w-full border-none bg-refly-bg-control-z0"
                icon={<Add size={16} />}
              >
                {t('canvas.workflow.variables.addOption') || 'Add Option'}
              </Button>
            )}
          </div>
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
      <div className="create-variables-modal flex flex-col gap-4">
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
              currentOption: '',
            }}
          >
            <Form.Item
              label={t('canvas.workflow.variables.name') || 'Variable Name'}
              name="name"
              rules={[
                {
                  required: true,
                  message:
                    t('canvas.workflow.variables.nameRequired') || 'Variable name is required',
                },
              ]}
            >
              <Input
                placeholder={t('canvas.workflow.variables.inputPlaceholder') || 'Please enter'}
                maxLength={50}
                showCount
              />
            </Form.Item>
            {renderForm()}
            <Form.Item name="required" valuePropName="checked">
              <Checkbox className="required-checkbox">
                <span className="text-refly-text-0 text-sm font-semibold">
                  {t('canvas.workflow.variables.required')}
                </span>
              </Checkbox>
            </Form.Item>
          </Form>
        </div>

        <div className="flex items-center justify-end gap-3">
          <Button className="w-[80px]" onClick={handleModalClose}>
            {t('common.cancel') || 'Cancel'}
          </Button>
          <Button className="w-[80px]" type="primary" onClick={handleSubmit}>
            {t('common.save') || 'Save'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
