import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

interface GreetingProps {
  onQueryClick: (query: string) => void;
}

export const Greeting = memo(({ onQueryClick }: GreetingProps) => {
  const { t } = useTranslation();

  const icons = ['📚', '📮', '🖼'];
  const queries = useMemo(() => {
    return [
      { icon: icons[0], query: t('copilot.greeting.query1') },
      { icon: icons[1], query: t('copilot.greeting.query2') },
      { icon: icons[2], query: t('copilot.greeting.query3') },
    ];
  }, [t]);

  return (
    <div className="w-full px-4 flex flex-col gap-8 items-center justify-center">
      <div className="text-refly-text-0 text-lg font-semibold leading-7">
        {t('copilot.greeting.title')}
      </div>
      <div className="w-full flex flex-col gap-2">
        <div className="text-refly-text-placeholder text-xs font-semibold leading-4">
          {t('copilot.greeting.youCanTry')}
        </div>
        {queries.map(({ icon, query }: { icon: string; query: string }, index: number) => (
          <div
            key={index}
            className="px-3 py-1.5 rounded-lg text-xs leading-[22px] border-solid border-[1px] border-refly-Card-Border cursor-pointer hover:bg-refly-tertiary-hover"
            onClick={() => onQueryClick(query)}
          >
            {icon} {query}
          </div>
        ))}
      </div>
    </div>
  );
});

Greeting.displayName = 'Greeting';
