import { Button } from 'antd';
import React from 'react';
import { Github } from 'refly-icons';
import Google from '../../assets/google.svg';

interface OAuthButtonProps {
  provider: 'github' | 'google';
  onClick: () => void;
  loading: boolean;
  disabled: boolean;
  loadingText: string;
  buttonText: string;
}

const OAuthButton: React.FC<OAuthButtonProps> = ({
  provider,
  onClick,
  loading,
  disabled,
  loadingText,
  buttonText,
}) => {
  const renderIcon = () => {
    if (provider === 'github') {
      return <Github size={20} />;
    }
    if (provider === 'google') {
      return <img src={Google} alt="google" className="mr-1 h-4 w-4" />;
    }
    return null;
  };

  const getDataCy = () => {
    return `${provider}-login-button`;
  };

  return (
    <Button
      onClick={onClick}
      type="default"
      variant="filled"
      className="h-[52px] w-full font-semibold text-refly-text-0 border-refly-Card-Border !bg-refly-bg-control-z1"
      style={{ boxShadow: '0px 2px 4px 0px rgba(16, 24, 40, 0.05)' }}
      data-cy={getDataCy()}
      loading={loading}
      disabled={disabled}
    >
      {renderIcon()}
      {loading ? loadingText : buttonText}
    </Button>
  );
};

// Optimize with memo to prevent unnecessary re-renders
export const MemoizedOAuthButton = React.memo(OAuthButton);
export { MemoizedOAuthButton as OAuthButton };
