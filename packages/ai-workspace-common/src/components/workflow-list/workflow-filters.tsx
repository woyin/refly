import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Dropdown } from 'antd';
import { Filter } from 'lucide-react';
import type { MenuProps } from 'antd';

export type ScheduleStatusFilter = 'all' | 'active' | 'inactive';

export interface WorkflowFiltersProps {
  scheduleStatus: ScheduleStatusFilter;
  onScheduleStatusChange: (status: ScheduleStatusFilter) => void;
}

export const WorkflowFilters = memo(
  ({ scheduleStatus, onScheduleStatusChange }: WorkflowFiltersProps) => {
    const { t } = useTranslation();

    // Schedule filter dropdown items
    const scheduleMenuItems: MenuProps['items'] = [
      {
        key: 'all',
        label: (
          <div className="flex items-center justify-between min-w-[120px]">
            <span>{t('workflowList.filters.scheduleAll')}</span>
            {scheduleStatus === 'all' && <span className="text-teal-500">✓</span>}
          </div>
        ),
        onClick: () => onScheduleStatusChange('all'),
      },
      {
        key: 'active',
        label: (
          <div className="flex items-center justify-between min-w-[120px]">
            <span>{t('workflowList.filters.scheduleActive')}</span>
            {scheduleStatus === 'active' && <span className="text-teal-500">✓</span>}
          </div>
        ),
        onClick: () => onScheduleStatusChange('active'),
      },
      {
        key: 'inactive',
        label: (
          <div className="flex items-center justify-between min-w-[120px]">
            <span>{t('workflowList.filters.scheduleInactive')}</span>
            {scheduleStatus === 'inactive' && <span className="text-teal-500">✓</span>}
          </div>
        ),
        onClick: () => onScheduleStatusChange('inactive'),
      },
    ];

    // Get button label based on current selection
    const getScheduleButtonLabel = () => {
      if (scheduleStatus === 'all') {
        return t('workflowList.tableTitle.schedule');
      }
      if (scheduleStatus === 'active') {
        return t('workflowList.filters.scheduleActive');
      }
      return t('workflowList.filters.scheduleInactive');
    };

    return (
      <Dropdown menu={{ items: scheduleMenuItems }} trigger={['click']}>
        <Button
          className={`flex items-center gap-2 bg-transparent ${scheduleStatus !== 'all' ? '!border-teal-500 !text-teal-600' : ''}`}
        >
          <Filter size={16} />
          <span>{getScheduleButtonLabel()}</span>
        </Button>
      </Dropdown>
    );
  },
);

WorkflowFilters.displayName = 'WorkflowFilters';
