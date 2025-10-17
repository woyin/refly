import React, { memo, useCallback, useState } from 'react';
import { VariableInputProps } from './types';

const VariableInput: React.FC<VariableInputProps> = memo(
  ({ id, value, placeholder, onChange, disabled = false }) => {
    const [isFocused, setIsFocused] = useState(false);
    const isEmpty = !value || value.trim() === '';

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(e.target.value);
      },
      [onChange],
    );

    const handleFocus = useCallback(() => {
      setIsFocused(true);
    }, []);

    const handleBlur = useCallback(() => {
      setIsFocused(false);
    }, []);

    return (
      <input
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        disabled={disabled}
        size={Math.max(value.length || placeholder?.length || 8, 4)}
        className={`
        inline-block
        min-w-[60px]
        px-2
        py-1
        text-base
        leading-6
        bg-[#EBFFF9]
        border
        border-dashed
        border-[rgba(14,159,119,0.3)]
        rounded-lg
        outline-none
        transition-all
        duration-200
        ease-in-out
        ${isFocused ? 'border-[rgba(14,159,119,0.6)] bg-[#F0FFF8]' : ''}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-text'}
        focus:border-[rgba(14,159,119,0.6)]
        focus:bg-[#F0FFF8]
        hover:border-[rgba(14,159,119,0.4)]
      `}
        style={{
          borderWidth: '0.5px',
          borderStyle: 'dashed',
          borderColor: isFocused
            ? 'rgba(14,159,119,0.6)'
            : isEmpty
              ? 'rgba(14,159,119,0.2)'
              : 'rgba(14,159,119,0.3)',
          backgroundColor: isFocused ? '#F0FFF8' : isEmpty ? '#CDFFF1' : '#EBFFF9',
          borderRadius: '8px',
          padding: '4px 8px',
          height: '26px',
          width: 'auto',
          minWidth: '60px',
          fontFamily:
            'PingFang SC, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: '16px',
          lineHeight: '1.625em',
          color: '#0E9F77', // 绿色字体
        }}
      />
    );
  },
);

VariableInput.displayName = 'VariableInput';

export default VariableInput;
