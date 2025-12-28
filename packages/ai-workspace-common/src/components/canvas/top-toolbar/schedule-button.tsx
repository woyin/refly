import { memo, useState, useCallback, useEffect, useMemo } from 'react';
import { Button, Tooltip, Popover, Switch, TimePicker, Select, message } from 'antd';
import { ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@refly/utils/cn';
import {
  useListSchedules,
  useCreateSchedule,
  useUpdateSchedule,
} from '@refly-packages/ai-workspace-common/queries';
import { useSkillResponseLoadingStatus } from '@refly-packages/ai-workspace-common/hooks/canvas/use-skill-response-loading-status';
import { useCanvasStoreShallow, useSubscriptionStoreShallow } from '@refly/stores';
import { logEvent } from '@refly/telemetry-web';
import { useNavigate } from '@refly-packages/ai-workspace-common/utils/router';
import type { WorkflowSchedule, ListSchedulesResponse } from '@refly/openapi-schema';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { LuAlarmClock } from 'react-icons/lu';

dayjs.extend(utc);
dayjs.extend(timezone);

interface ScheduleButtonProps {
  canvasId: string;
}

type ScheduleFrequency = 'daily' | 'weekly' | 'monthly';

interface ScheduleConfig {
  type: ScheduleFrequency;
  time: string;
  weekdays?: number[];
  monthDays?: number[];
}

const WEEKDAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
];

const MONTH_DAYS = Array.from({ length: 31 }, (_, i) => ({
  value: i + 1,
  label: `${i + 1}`,
}));

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

const ScheduleButton = memo(({ canvasId }: ScheduleButtonProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  // Local state for popover form
  const [schedule, setSchedule] = useState<WorkflowSchedule | null>(null);
  const [isEnabled, setIsEnabled] = useState(false);
  const [frequency, setFrequency] = useState<ScheduleFrequency>('daily');
  const [timeValue, setTimeValue] = useState<dayjs.Dayjs>(dayjs('08:00', 'HH:mm'));
  const [weekdays, setWeekdays] = useState<number[]>([1]);
  const [monthDays, setMonthDays] = useState<number[]>([1]);

  // Get subscription plan type
  const { planType } = useSubscriptionStoreShallow((state) => ({
    planType: state.planType,
  }));

  // API mutations
  const listSchedulesMutation = useListSchedules();
  const createScheduleMutation = useCreateSchedule();
  const updateScheduleMutation = useUpdateSchedule();

  // State for total enabled schedules count
  const [totalEnabledSchedules, setTotalEnabledSchedules] = useState(0);

  // Calculate schedule quota based on plan type
  const scheduleQuota = useMemo(() => {
    return planType === 'free' ? 1 : 20;
  }, [planType]);

  // Get execution status for validation
  const { nodeExecutions } = useCanvasStoreShallow((state) => ({
    nodeExecutions: state.canvasNodeExecutions[canvasId] ?? [],
  }));

  const executionStats = useMemo(() => {
    const total = nodeExecutions.length;
    const executing = nodeExecutions.filter((n) => n.status === 'executing').length;
    const waiting = nodeExecutions.filter((n) => n.status === 'waiting').length;
    return { total, executing, waiting };
  }, [nodeExecutions]);

  const { isLoading: skillResponseLoading, skillResponseNodes } =
    useSkillResponseLoadingStatus(canvasId);

  const toolbarLoading =
    executionStats.executing > 0 || executionStats.waiting > 0 || skillResponseLoading;

  const disabled = useMemo(() => {
    return toolbarLoading || !skillResponseNodes?.length;
  }, [toolbarLoading, skillResponseNodes]);

  // Fetch all enabled schedules count
  const fetchAllEnabledSchedulesCount = useCallback(async () => {
    try {
      const result = await listSchedulesMutation.mutateAsync({
        body: {
          // Don't pass canvasId to get all schedules for the user
          page: 1,
          pageSize: 1000, // Get a large number to count all
        },
      });

      const response = result as ListSchedulesResponse;
      let schedules: any[] = [];

      if (response.data && typeof response.data === 'object' && 'data' in response.data) {
        const nestedData = (response.data as any).data;
        schedules = nestedData?.items || [];
      } else if (Array.isArray(response.data)) {
        schedules = response.data;
      }

      // Count only enabled schedules
      const enabledCount = schedules.filter((schedule: any) => schedule.isEnabled === true).length;
      setTotalEnabledSchedules(enabledCount);
    } catch (error) {
      console.error('Failed to fetch all schedules count:', error);
      setTotalEnabledSchedules(0);
    }
  }, []); // Remove listSchedulesMutation from dependencies to prevent infinite loop

  // Fetch schedule data
  const fetchSchedule = useCallback(async () => {
    if (!canvasId) return;

    try {
      const result = await listSchedulesMutation.mutateAsync({
        body: {
          canvasId: canvasId,
          page: 1,
          pageSize: 1,
        },
      });

      // Get the first schedule for this canvas if it exists
      const response = result as ListSchedulesResponse;

      // fix data parsing: the data is in a nested structure
      // response.data.data.items is the actual schedule tasks array
      let schedules: any[] = [];

      if (response.data && typeof response.data === 'object' && 'data' in response.data) {
        // nested structure: response.data.data.items
        const nestedData = (response.data as any).data;
        schedules = nestedData?.items || [];
      } else if (Array.isArray(response.data)) {
        // direct array structure: response.data (backup compatibility)
        schedules = response.data;
      }

      const currentSchedule = schedules.length > 0 ? schedules[0] : null;
      setSchedule(currentSchedule);

      if (currentSchedule) {
        const config = parseScheduleConfig(currentSchedule.scheduleConfig);
        setIsEnabled(currentSchedule.isEnabled ?? false);
        setFrequency(config?.type || 'daily');
        setTimeValue(config?.time ? dayjs(config.time, 'HH:mm') : dayjs('08:00', 'HH:mm'));
        setWeekdays(config?.weekdays || [1]);
        setMonthDays(config?.monthDays || [1]);
      }
    } catch (error) {
      console.error('Failed to fetch schedule:', error);
      setSchedule(null);
    }
  }, [canvasId]); // Remove listSchedulesMutation from dependencies to prevent infinite loop

  // Fetch schedule data on mount and when canvasId changes
  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  // Fetch all enabled schedules count on mount only
  useEffect(() => {
    fetchAllEnabledSchedulesCount();
  }, []); // Run only once on mount

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

    // Validate weekdays/monthDays selection
    if (frequency === 'weekly' && (!weekdays || weekdays.length === 0)) {
      message.error(t('schedule.weekdaysRequired') || 'Please select at least one weekday');
      return;
    }
    if (frequency === 'monthly' && (!monthDays || monthDays.length === 0)) {
      message.error(t('schedule.monthDaysRequired') || 'Please select at least one day of month');
      return;
    }

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

      const requestData = {
        canvasId,
        name: `Schedule for ${canvasId}`, // Simple name, could be made configurable
        cronExpression,
        scheduleConfig: JSON.stringify(scheduleConfig),
        timezone: userTimezone,
        isEnabled,
      };

      console.log('requestData', requestData);

      if (schedule?.scheduleId) {
        console.log('update schedule');
        // Update existing schedule
        await updateScheduleMutation.mutateAsync({
          body: {
            scheduleId: schedule.scheduleId,
            ...requestData,
          },
        });
      } else {
        // Create new schedule
        console.log('create schedule');
        await createScheduleMutation.mutateAsync({
          body: requestData,
        });
      }

      message.success(t('schedule.saveSuccess') || 'Schedule saved');
      setOpen(false);
      await fetchSchedule(); // Refresh schedule data
      await fetchAllEnabledSchedulesCount(); // Refresh enabled schedules count
    } catch (error) {
      console.error('Failed to save schedule:', error);
      message.error(t('schedule.saveFailed') || 'Failed to save schedule');
    }
  }, [
    canvasId,
    schedule,
    isEnabled,
    frequency,
    timeValue,
    weekdays,
    monthDays,
    createScheduleMutation,
    updateScheduleMutation,
    fetchSchedule,
    t,
  ]); // Remove fetchAllEnabledSchedulesCount from dependencies

  // Handle view history
  const handleViewHistory = useCallback(() => {
    setOpen(false);
    navigate('/run-history');
  }, [navigate]);

  const handleButtonClick = useCallback(() => {
    if (disabled) return;

    logEvent('canvas::schedule_button_click', Date.now(), {
      canvas_id: canvasId,
    });

    setOpen(true);
  }, [disabled, canvasId]);

  // Determine style based on schedule status
  const isScheduled = schedule?.isEnabled;

  // Popover content
  const popoverContent = (
    <div className="w-[400px] space-y-4" onClick={(e) => e.stopPropagation()}>
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
            onClick={() => {
              setFrequency(freq);
              if (freq === 'weekly' && weekdays.length === 0) {
                setWeekdays([1]); // 默认选择周一
              }
              if (freq === 'monthly' && monthDays.length === 0) {
                setMonthDays([1]); // 默认选择1号
              }
            }}
          >
            {freq === 'daily'
              ? t('schedule.daily') || 'Daily'
              : freq === 'weekly'
                ? t('schedule.weekly') || 'Weekly'
                : t('schedule.monthly') || 'Monthly'}
          </Button>
        ))}
      </div>

      {/* Time picker and selection container */}
      <div className="flex items-center gap-3 border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-gray-50 dark:bg-gray-800">
        {/* Weekly selection */}
        {frequency === 'weekly' && (
          <div className="flex-1">
            <Select
              mode="multiple"
              value={weekdays}
              onChange={setWeekdays}
              options={WEEKDAYS.map((d) => ({
                ...d,
                label: t(`schedule.weekday.${d.label.toLowerCase()}`) || d.label,
              }))}
              placeholder={`Select ${weekdays.length} day${weekdays.length !== 1 ? 's' : ''}`}
              className="w-full"
              maxTagCount={0}
              maxTagPlaceholder={() =>
                `Select ${weekdays.length} day${weekdays.length !== 1 ? 's' : ''}`
              }
            />
          </div>
        )}

        {/* Monthly selection */}
        {frequency === 'monthly' && (
          <div className="flex-1">
            <Select
              mode="multiple"
              value={monthDays}
              onChange={setMonthDays}
              options={MONTH_DAYS}
              placeholder={`Select ${monthDays.length} day${monthDays.length !== 1 ? 's' : ''}`}
              className="w-full"
              maxTagCount={0}
              maxTagPlaceholder={() =>
                `Select ${monthDays.length} day${monthDays.length !== 1 ? 's' : ''}`
              }
            />
          </div>
        )}

        {/* Daily selection placeholder */}
        {frequency === 'daily' && (
          <div className="flex-1">
            <div className="h-8 flex items-center text-gray-500 text-sm">
              {t('schedule.daily') || 'Daily'}
            </div>
          </div>
        )}

        <TimePicker
          value={timeValue}
          onChange={(val) => val && setTimeValue(val)}
          format="HH:mm"
          className="flex-1"
          size="large"
          allowClear={false}
          popupClassName="schedule-timepicker-popup"
          popupStyle={{ width: '200px !important', minWidth: '200px !important' }}
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
        loading={createScheduleMutation.isPending || updateScheduleMutation.isPending}
        onClick={handleSave}
        className="!bg-teal-500 hover:!bg-teal-600 !border-teal-500"
      >
        {t('common.save') || 'Save'}
      </Button>
    </div>
  );

  return (
    <>
      <style>
        {`
          .schedule-timepicker-popup .ant-picker-time-panel {
            width: 200px !important;
            min-width: 200px !important;
          }
          .schedule-timepicker-popup .ant-picker-dropdown {
            width: 200px !important;
            min-width: 200px !important;
          }
        `}
      </style>
      <Popover
        content={popoverContent}
        trigger="click"
        open={open}
        onOpenChange={handleOpenChange}
        placement="bottomLeft"
        overlayClassName="schedule-popover"
      >
        <Tooltip
          title={
            toolbarLoading
              ? t('shareContent.waitForAgentsToFinish')
              : !skillResponseNodes?.length
                ? t('shareContent.noSkillResponseNodes')
                : isScheduled
                  ? t('schedule.editSchedule') || 'Edit Schedule'
                  : t('schedule.title') || 'Schedule'
          }
          placement="top"
        >
          <div className="flex items-center gap-2">
            <LuAlarmClock
              className={cn(
                'text-lg cursor-pointer hover:text-teal-600 transition-colors',
                disabled ? 'opacity-50 cursor-not-allowed' : '',
                isScheduled ? 'text-teal-600' : 'text-gray-600 dark:text-gray-400',
              )}
              onClick={handleButtonClick}
            />
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              {totalEnabledSchedules}/{scheduleQuota}
            </span>
          </div>
        </Tooltip>
      </Popover>
    </>
  );
});

ScheduleButton.displayName = 'ScheduleButton';

export default ScheduleButton;
