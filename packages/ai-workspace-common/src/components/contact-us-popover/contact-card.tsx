import React from 'react';
import { Button } from 'antd';

interface ContactCardProps {
  icon: React.ReactNode;
  title: string;
  buttonText: string;
  onButtonClick: () => void;
  iconContainerClassName?: string;
}

export const ContactCard: React.FC<ContactCardProps> = ({
  icon,
  title,
  buttonText,
  onButtonClick,
  iconContainerClassName = '',
}) => {
  return (
    <div className="w-[156px] h-[176px] flex flex-col items-center justify-between px-3 py-4 rounded-xl border-solid border-[1px] border-refly-Card-Border">
      <div className="flex flex-col items-center gap-2">
        <div className={iconContainerClassName}>{icon}</div>
        <div className="text-xs text-refly-text-2">{title}</div>
      </div>
      <Button
        type="text"
        size="middle"
        className="text-sm text-refly-text-0 font-semibold bg-refly-tertiary-default hover:bg-refly-tertiary-hover"
        onClick={onButtonClick}
      >
        {buttonText}
      </Button>
    </div>
  );
};
