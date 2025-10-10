import { memo, useState } from 'react';
import cn from 'classnames';

interface HoverCardContainerProps {
  children: React.ReactNode;
  actionContent: React.ReactNode;
  className?: string;
}

export const HoverCardContainer = memo(
  ({ children, actionContent, className }: HoverCardContainerProps) => {
    const [isHovered, setIsHovered] = useState(false);

    return (
      <div
        className={cn('relative group overflow-hidden hover:shadow-refly-m', className)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {children}

        <div
          className={cn(
            'absolute bottom-[1px] left-[1px] right-[1px] flex items-center gap-2 py-3 px-4 rounded-xl transition-all duration-300 ease-in-out bg-refly-bg-glass-content backdrop-blur-[20px]',
            isHovered ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0',
          )}
          style={{
            boxShadow: '0px 0px 60px 0px rgba(0, 0, 0, 0.08)',
          }}
        >
          {actionContent}
        </div>
      </div>
    );
  },
);

HoverCardContainer.displayName = 'HoverCardContainer';
