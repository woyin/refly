import { memo, useMemo, useState, useCallback } from 'react';
import { Tag, Popover, Switch, Button, message, TimePicker } from 'antd';
import { ArrowRight } from 'lucide-react';
import { WorkflowSchedule } from '@refly/openapi-schema';
import { client } from '@refly/openapi-schema';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '@refly-packages/ai-workspace-common/utils/router';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

export interface ScheduleColumnProps {
  schedule?: WorkflowSchedule;
  canvasId: string;
  onScheduleChange?: () => void;
}

interface ScheduleConfig {
  type: 'daily' | 'weekly' | 'monthly';
  time: string;
  weekdays?: number[];
  monthDays?: number[];
}

type ScheduleFrequency = 'daily' | 'weekly' | 'monthly';

function parseScheduleConfig(configStr?: string): ScheduleConfig | null {
  if (!configStr) return null;
  try {
    return JSON.parse(configStr) as ScheduleConfig;
  } catch {
    return null;
  }
}

function generateCronExpression(config: ScheduleConfig): string {
  const [hour, minute] = config.time.split(':').map(Number);

  switch (config.type) {
    case 'daily':
      return `${minute} ${hour} * * *`;
    case 'weekly': {
      const weekdays = config.weekdays?.join(',') || '1';
      return `${minute} ${hour} * * ${weekdays}`;
    }
    case 'monthly': {
      const monthDays = config.monthDays?.join(',') || '1';
      return `${minute} ${hour} ${monthDays} * *`;
    }
    default:
      return `${minute} ${hour} * * *`;
  }
}

export const ScheduleColumn = memo(
  ({ schedule, canvasId, onScheduleChange }: ScheduleColumnProps) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    // Local state for popover form
    const existingConfig = parseScheduleConfig(schedule?.scheduleConfig);
    const [isEnabled, setIsEnabled] = useState(schedule?.isEnabled ?? false);
    const [frequency, setFrequency] = useState<ScheduleFrequency>(existingConfig?.type || 'daily');
    const [timeValue, setTimeValue] = useState<dayjs.Dayjs>(
      existingConfig?.time ? dayjs(existingConfig.time, 'HH:mm') : dayjs('08:00', 'HH:mm'),
    );

    // Reset state when popover opens
    const handleOpenChange = useCallback(
      (newOpen: boolean) => {
        if (newOpen) {
          const config = parseScheduleConfig(schedule?.scheduleConfig);
          setIsEnabled(schedule?.isEnabled ?? false);
          setFrequency(config?.type || 'daily');
          setTimeValue(config?.time ? dayjs(config.time, 'HH:mm') : dayjs('08:00', 'HH:mm'));
        }
        setOpen(newOpen);
      },
      [schedule],
    );

    // Calculate next run time
    const nextRunTime = useMemo(() => {
      if (!isEnabled || !timeValue) return null;

      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const hour = timeValue.hour();
      const minute = timeValue.minute();

      let nextRun = dayjs().tz(userTimezone).hour(hour).minute(minute).second(0);

      if (nextRun.isBefore(dayjs())) {
        nextRun = nextRun.add(1, 'day');
      }

      return nextRun.format('DD/MM/YYYY, hh:mm:ss A');
    }, [isEnabled, timeValue]);

    // Save schedule
    const handleSave = useCallback(async () => {
      if (!timeValue) return;

      setLoading(true);
      try {
        const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const timeStr = timeValue.format('HH:mm');
        const scheduleConfig: ScheduleConfig = {
          type: frequency,
          time: timeStr,
        };

        const cronExpression = generateCronExpression(scheduleConfig);

        const requestBody = {
          canvasId,
          cronExpression,
          scheduleConfig: JSON.stringify(scheduleConfig),
          timezone: userTimezone,
          isEnabled,
        };

        if (schedule?.scheduleId) {
          // Update existing schedule
          await client.post({
            url: '/schedule/update',
            body: {
              scheduleId: schedule.scheduleId,
              ...requestBody,
            },
          });
        } else {
          // Create new schedule
          await client.post({
            url: '/schedule/create',
            body: requestBody,
          });
        }

        message.success(t('schedule.saveSuccess') || 'Schedule saved');
        setOpen(false);
        onScheduleChange?.();
      } catch (error) {
        console.error('Failed to save schedule:', error);
        message.error(t('schedule.saveFailed') || 'Failed to save schedule');
      } finally {
        setLoading(false);
      }
    }, [canvasId, schedule, isEnabled, frequency, timeValue, onScheduleChange, t]);

    // Handle view history
    const handleViewHistory = useCallback(() => {
      setOpen(false);
      navigate('/run-history');
    }, [navigate]);

    // Schedule display for badge
    const scheduleDisplay = useMemo(() => {
      if (!schedule?.scheduleId) {
        return null;
      }

      const config = parseScheduleConfig(schedule.scheduleConfig);
      const typeLabel =
        config?.type === 'daily'
          ? 'Daily'
          : config?.type === 'weekly'
            ? 'Weekly'
            : config?.type === 'monthly'
              ? 'Monthly'
              : 'Schedule';
      const enabled = schedule.isEnabled ?? false;

      return {
        label: typeLabel,
        isEnabled: enabled,
      };
    }, [schedule]);

    // Render badge
    const renderBadge = () => {
      if (!scheduleDisplay) {
        return <span className="text-gray-400">-</span>;
      }

      const { label, isEnabled: enabled } = scheduleDisplay;

      return (
        <Tag
          color={enabled ? 'cyan' : 'default'}
          className={`text-xs m-0 ${enabled ? 'bg-teal-500 text-white border-teal-500' : 'bg-gray-100 text-gray-500'}`}
        >
          {label} {enabled ? 'ON' : 'OFF'}
        </Tag>
      );
    };

    // Popover content
    const popoverContent = (
      <div className="w-[340px] space-y-4" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <div className="text-base font-semibold mb-1">{t('schedule.title') || 'Schedule'}</div>
            {nextRunTime && (
              <div className="text-xs text-gray-500">
                {t('schedule.nextRun') || 'Next run'}: {nextRunTime}
              </div>
            )}
          </div>
          <Switch checked={isEnabled} onChange={setIsEnabled} />
        </div>

        {/* Frequency buttons */}
        <div className="flex gap-2">
          {(['daily', 'weekly', 'monthly'] as ScheduleFrequency[]).map((freq) => (
            <Button
              key={freq}
              type={frequency === freq ? 'primary' : 'default'}
              className={`flex-1 ${
                frequency === freq
                  ? '!bg-teal-500 hover:!bg-teal-600 !border-teal-500 !text-white'
                  : ''
              }`}
              onClick={() => setFrequency(freq)}
            >
              {freq === 'daily'
                ? t('schedule.daily') || 'Daily'
                : freq === 'weekly'
                  ? t('schedule.weekly') || 'Weekly'
                  : t('schedule.monthly') || 'Monthly'}
            </Button>
          ))}
        </div>

        {/* Time picker */}
        <div className="flex items-center gap-3 border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-gray-50 dark:bg-gray-800">
          <TimePicker
            value={timeValue}
            onChange={(val) => val && setTimeValue(val)}
            format="HH:mm"
            className="flex-1"
            size="large"
            allowClear={false}
          />
        </div>

        {/* Cost info */}
        <div className="text-sm text-gray-500 pt-2">
          {t('schedule.cost') || 'Cost'}: 50~ / {t('schedule.perRun') || 'run'}
        </div>

        {/* View History link */}
        <Button
          type="link"
          className="!p-0 !text-teal-600 hover:!text-teal-700 font-medium flex items-center gap-1"
          onClick={handleViewHistory}
        >
          {t('schedule.viewHistory') || 'View History'}
          <ArrowRight className="w-4 h-4" />
        </Button>

        {/* Save button */}
        <Button
          type="primary"
          block
          loading={loading}
          onClick={handleSave}
          className="!bg-teal-500 hover:!bg-teal-600 !border-teal-500"
        >
          {t('common.save') || 'Save'}
        </Button>
      </div>
    );

    return (
      <Popover
        content={popoverContent}
        trigger="click"
        open={open}
        onOpenChange={handleOpenChange}
        placement="bottomLeft"
        overlayClassName="schedule-popover"
      >
        <div
          className="flex items-center gap-1 cursor-pointer hover:opacity-70 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          {renderBadge()}
        </div>
      </Popover>
    );
  },
);

ScheduleColumn.displayName = 'ScheduleColumn';
