import React, { memo, useCallback, useState } from 'react';
import { Upload } from 'antd';
import { Attachment } from 'refly-icons';
import { useTranslation } from 'react-i18next';

interface FileInputProps {
  id: string;
  value?: any;
  placeholder?: string;
  onChange: (value: any) => void;
  disabled?: boolean;
  accept?: string;
  isDefaultValue?: boolean; // Whether this is a default value
  isModified?: boolean; // Whether the value has been modified by user
}

const FileInput: React.FC<FileInputProps> = memo(
  ({
    value,
    placeholder,
    onChange,
    disabled = false,
    accept = '*',
    isDefaultValue = false,
    isModified = false,
  }) => {
    const { t } = useTranslation();
    const [isHovered, setIsHovered] = useState(false);
    const fileName = value?.name || '';
    const isEmpty = !fileName || fileName.trim() === '';

    const handleFileChange = useCallback(
      (file: File) => {
        // Create resource object
        const resource = {
          name: file.name,
          storageKey: '', // This would be set after upload
          fileType: file.type.split('/')[0] as any, // Extract file type
          entityId: '', // This would be set after upload
        };
        onChange(resource);
      },
      [onChange],
    );

    const handleMouseEnter = useCallback(() => {
      setIsHovered(true);
    }, []);

    const handleMouseLeave = useCallback(() => {
      setIsHovered(false);
    }, []);

    return (
      <Upload
        accept={accept}
        showUploadList={false}
        beforeUpload={(file) => {
          handleFileChange(file);
          return false; // Prevent default upload
        }}
        disabled={disabled}
      >
        <div
          className={`
            inline-flex items-center justify-between min-w-[60px] cursor-pointer
            border-b border-dashed border-[rgba(14,159,119,0.3)] rounded-none
            transition-all duration-200 ease-in-out
            ${isHovered ? 'border-[rgba(14,159,119,0.4)]' : 'border-[rgba(14,159,119,0.3)]'}
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            hover:border-[rgba(14,159,119,0.4)]
            text-[#0E9F77]
          `}
          style={{
            borderWidth: '0 0 1.5px 0',
            borderStyle: 'dashed',
            borderColor: '#0E9F77',
            backgroundColor: 'transparent',
            borderRadius: '0',
            padding: '4px 8px',
            height: '26px',
            fontFamily: 'PingFang SC',
            fontSize: '16px',
            fontStyle: 'normal',
            fontWeight: isEmpty ? '400' : '500',
            lineHeight: '26px',
            color: isEmpty
              ? '#7FB3A3' // Empty value: light green font
              : isDefaultValue
                ? '#0E9F77' // Default value: normal green font
                : isModified
                  ? '#0E9F77' // Modified value: normal green font
                  : '#0E9F77', // Green font
          }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <Attachment size={16} color="#0E9F77" />
          <span className="flex-1 ml-1">
            {fileName || placeholder || t('canvas.workflow.variables.uploadPlaceholder')}
          </span>
        </div>
      </Upload>
    );
  },
);

FileInput.displayName = 'FileInput';

export default FileInput;
