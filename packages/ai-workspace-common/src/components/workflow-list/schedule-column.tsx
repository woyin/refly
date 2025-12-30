import { memo, useMemo, useState, useCallback } from 'react';
import { Popover, message } from 'antd';
import { WorkflowSchedule } from '@refly/openapi-schema';
import {
  useUpdateSchedule,
  useGetCreditUsageByCanvasId,
} from '@refly-packages/ai-workspace-common/queries';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import {
  SchedulePopoverContent,
  parseScheduleConfig,
  generateCronExpression,
  type ScheduleFrequency,
  type ScheduleConfig,
} from '@refly-packages/ai-workspace-common/components/common/schedule-popover-content';

dayjs.extend(utc);
dayjs.extend(timezone);

export interface ScheduleColumnProps {
  schedule?: WorkflowSchedule;
  canvasId: string;
  onScheduleChange?: () => void;
}

export const ScheduleColumn = memo(
  ({ schedule, canvasId, onScheduleChange }: ScheduleColumnProps) => {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);

    // Local state for popover form
    const existingConfig = parseScheduleConfig(schedule?.scheduleConfig);
    const [isEnabled, setIsEnabled] = useState(schedule?.isEnabled ?? false);
    const [frequency, setFrequency] = useState<ScheduleFrequency>(existingConfig?.type || 'daily');
    const [timeValue, setTimeValue] = useState<dayjs.Dayjs>(
      existingConfig?.time ? dayjs(existingConfig.time, 'HH:mm') : dayjs('08:00', 'HH:mm'),
    );
    const [weekdays, setWeekdays] = useState<number[]>(existingConfig?.weekdays || [1]);
    const [monthDays, setMonthDays] = useState<number[]>(existingConfig?.monthDays || [1]);

    // API mutation
    const updateScheduleMutation = useUpdateSchedule();

    // Credit usage query
    const { data: creditUsageData, isLoading: isCreditUsageLoading } = useGetCreditUsageByCanvasId(
      {
        query: { canvasId },
      },
      undefined,
      {
        enabled: !!canvasId && open,
      },
    );

    // Reset state when popover opens
    const handleOpenChange = useCallback(
      (newOpen: boolean) => {
        if (newOpen) {
          const config = parseScheduleConfig(schedule?.scheduleConfig);
          setIsEnabled(schedule?.isEnabled ?? false);
          setFrequency(config?.type || 'daily');
          setTimeValue(config?.time ? dayjs(config.time, 'HH:mm') : dayjs('08:00', 'HH:mm'));
          setWeekdays(config?.weekdays || [1]);
          setMonthDays(config?.monthDays || [1]);
        }
        setOpen(newOpen);
      },
      [schedule],
    );

    // Handle enabled change - auto save
    const handleEnabledChange = useCallback(
      async (enabled: boolean) => {
        if (!schedule?.scheduleId || !timeValue) return;

        setIsEnabled(enabled);

        try {
          const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
          const timeStr = timeValue.format('HH:mm');
          const scheduleConfig: ScheduleConfig = {
            type: frequency,
            time: timeStr,
            ...(frequency === 'weekly' && { weekdays }),
            ...(frequency === 'monthly' && { monthDays }),
          };

          const cronExpression = generateCronExpression(scheduleConfig);

          await updateScheduleMutation.mutateAsync({
            body: {
              scheduleId: schedule.scheduleId,
              cronExpression,
              scheduleConfig: JSON.stringify(scheduleConfig),
              timezone: userTimezone,
              isEnabled: enabled,
            },
          });

          message.success(
            enabled
              ? t('schedule.saveSuccess') || 'Schedule enabled'
              : t('schedule.deactivateSuccess') || 'Schedule disabled',
          );
          onScheduleChange?.();
        } catch (error) {
          console.error('Failed to update schedule:', error);
          message.error(t('schedule.saveFailed') || 'Failed to update schedule');
          // Revert on error
          setIsEnabled(!enabled);
        }
      },
      [
        schedule,
        canvasId,
        frequency,
        timeValue,
        weekdays,
        monthDays,
        updateScheduleMutation,
        onScheduleChange,
        t,
      ],
    );

    // Handle close
    const handleClose = useCallback(() => {
      setOpen(false);
    }, []);

    // Schedule display for badge
    const scheduleDisplay = useMemo(() => {
      if (!schedule?.scheduleId) {
        return null;
      }

      const config = parseScheduleConfig(schedule.scheduleConfig);
      const typeLabel =
        config?.type === 'daily'
          ? t('schedule.daily')
          : config?.type === 'weekly'
            ? t('schedule.weekly')
            : config?.type === 'monthly'
              ? t('schedule.monthly')
              : t('schedule.title');
      const enabled = schedule.isEnabled ?? false;

      return {
        label: typeLabel,
        isEnabled: enabled,
      };
    }, [schedule, t]);

    // Render badge
    const renderBadge = () => {
      if (!scheduleDisplay) {
        return null;
      }

      const { label, isEnabled: enabled } = scheduleDisplay;

      return (
        <div className="flex items-center gap-1 bg-[#F6F6F6] rounded-[6px] px-2 h-[26px]">
          <span className="text-xs font-normal leading-[18px] text-refly-text-0">{label}</span>
          <span
            className={`px-1 py-0.5 flex items-center text-[9px] font-bold leading-[11px] rounded-sm ${
              enabled
                ? 'bg-refly-primary-default text-refly-bg-body-z0'
                : 'bg-[#E6E8EA] text-refly-text-3'
            }`}
          >
            {enabled ? t('schedule.status.on') : t('schedule.status.off')}
          </span>
        </div>
      );
    };

    // If no schedule, show "-" without popover
    if (!schedule?.scheduleId) {
      return <span className="text-gray-400 select-none">-</span>;
    }

    return (
      <Popover
        content={
          <SchedulePopoverContent
            canvasId={canvasId}
            schedule={schedule}
            isEnabled={isEnabled}
            frequency={frequency}
            timeValue={timeValue}
            weekdays={weekdays}
            monthDays={monthDays}
            onEnabledChange={handleEnabledChange}
            onFrequencyChange={setFrequency}
            onTimeChange={setTimeValue}
            onWeekdaysChange={setWeekdays}
            onMonthDaysChange={setMonthDays}
            onClose={handleClose}
            creditCost={creditUsageData?.data?.total}
            isCreditLoading={isCreditUsageLoading}
          />
        }
        trigger="click"
        open={open}
        onOpenChange={handleOpenChange}
        placement="bottomLeft"
        overlayClassName="schedule-popover"
      >
        <div
          className="flex items-center gap-1 cursor-pointer hover:opacity-70 transition-opacity select-none"
          onClick={(e) => e.stopPropagation()}
        >
          {renderBadge()}
        </div>
      </Popover>
    );
  },
);

ScheduleColumn.displayName = 'ScheduleColumn';
