import React, { memo, useCallback, useState } from 'react';
import { Upload } from 'antd';
import { Attachment } from 'refly-icons';

interface FileInputProps {
  id: string;
  value?: any;
  placeholder?: string;
  onChange: (value: any) => void;
  disabled?: boolean;
  accept?: string;
}

const FileInput: React.FC<FileInputProps> = memo(
  ({ value, placeholder, onChange, disabled = false, accept = '*' }) => {
    const [isHovered, setIsHovered] = useState(false);
    const fileName = value?.name || '';

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
            inline-flex items-center min-w-[60px] cursor-pointer
            border border-dashed rounded-lg
            transition-all duration-200 ease-in-out
            ${
              isHovered
                ? 'border-[rgba(14,159,119,0.4)] bg-[#F0FFF8]'
                : 'border-[rgba(14,159,119,0.3)] bg-[#EBFFF9]'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            hover:border-[rgba(14,159,119,0.4)]
            hover:bg-[#F0FFF8]
          `}
          style={{
            borderWidth: '0.5px',
            borderStyle: 'dashed',
            borderColor: isHovered ? 'rgba(14,159,119,0.4)' : 'rgba(14,159,119,0.3)',
            borderRadius: '8px',
            padding: '4px 8px',
            height: '26px',
            fontFamily:
              'PingFang SC, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: '16px',
            lineHeight: '1.625em',
            color: '#1C1F23',
          }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <Attachment size={16} color="#0E9F77" />
          <span className="flex-1">{fileName || placeholder || '选择文件'}</span>
        </div>
      </Upload>
    );
  },
);

FileInput.displayName = 'FileInput';

export default FileInput;
