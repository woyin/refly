import React, { memo, useCallback, useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface SelectInputProps {
  id: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  options: Array<{ label: string; value: string }>;
  isDefaultValue?: boolean; // Whether this is a default value
  isModified?: boolean; // Whether the value has been modified by user
}

const SelectInput: React.FC<SelectInputProps> = memo(
  ({
    value,
    placeholder,
    onChange,
    disabled = false,
    options = [],
    isDefaultValue = false,
    isModified = false,
  }) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const selectRef = useRef<HTMLDivElement>(null);
    const isEmpty = !value || value.trim() === '';

    const handleClick = useCallback(() => {
      if (!disabled) {
        setIsOpen(!isOpen);
      }
    }, [disabled, isOpen]);

    const handleOptionClick = useCallback(
      (optionValue: string) => {
        onChange(optionValue);
        setIsOpen(false);
      },
      [onChange],
    );

    const handleFocus = useCallback(() => {
      setIsFocused(true);
    }, []);

    const handleBlur = useCallback(() => {
      setIsFocused(false);
      // Delay closing to allow option clicks
      setTimeout(() => setIsOpen(false), 150);
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };

      if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
      }
    }, [isOpen]);

    const selectedOption = options.find((option) => option.value === value);

    return (
      <div ref={selectRef} className="relative inline-block">
        <div
          className={`
              inline-flex items-center justify-between min-w-[60px] cursor-pointer
              bg-transparent border-b border-dashed border-[rgba(14,159,119,0.3)] rounded-none
              transition-all duration-200 ease-in-out
              ${isFocused || isOpen ? 'border-[rgba(14,159,119,0.6)]' : 'border-[rgba(14,159,119,0.3)]'}
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
            fontFamily:
              'PingFang SC, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: '16px',
            lineHeight: '1.625em',
            color: isEmpty
              ? '#7FB3A3' // Empty value: light green font
              : isDefaultValue
                ? '#0E9F77' // Default value: normal green font
                : isModified
                  ? '#0E9F77' // Modified value: normal green font
                  : '#0E9F77', // Green font
          }}
          onClick={handleClick}
          onFocus={handleFocus}
          onBlur={handleBlur}
          tabIndex={disabled ? -1 : 0}
        >
          <span className="flex-1">
            {selectedOption?.label ||
              placeholder ||
              t('canvas.workflow.variables.selectPlaceholder')}
          </span>
          <svg
            className={`w-3 h-3 ml-1 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            style={{ color: '#0E9F77' }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {isOpen && !disabled && (
          <div
            className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto"
            style={{
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: '#e5e7eb',
              borderRadius: '8px',
            }}
          >
            {options.map((option) => (
              <div
                key={option.value}
                className={`
                  px-3 py-2 cursor-pointer transition-colors duration-150
                  ${
                    value === option.value
                      ? 'bg-[#EBFFF9] text-[#0E9F77]'
                      : 'hover:bg-gray-50 text-gray-700'
                  }
                `}
                onClick={() => handleOptionClick(option.value)}
                style={{
                  fontFamily:
                    'PingFang SC, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  fontSize: '16px',
                  lineHeight: '1.625em',
                }}
              >
                {option.label}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  },
);

SelectInput.displayName = 'SelectInput';

export default SelectInput;
