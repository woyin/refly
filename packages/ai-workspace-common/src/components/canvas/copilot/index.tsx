import { memo } from 'react';
export const Copilot = memo(() => {
  return (
    <div className="w-full h-full bg-refly-bg-content-z2 p-2 border-solid border-r-[1px] border-y-0 border-l-0 border-refly-Card-Border shadow-lg">
      Copilot
    </div>
  );
});

Copilot.displayName = 'Copilot';
