import { useCallback, useMemo, memo, useEffect } from 'react';
import { time } from '@refly-packages/ai-workspace-common/utils/time';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '@refly-packages/ai-workspace-common/utils/router';

import { Empty, Typography, Table, Button, message } from 'antd';
import { EndMessage } from '@refly-packages/ai-workspace-common/components/workspace/scroll-loading';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';
import { LOCALE } from '@refly/common-types';
import EmptyImage from '@refly-packages/ai-workspace-common/assets/noResource.svg';
import { RunHistoryFilters, RunStatusFilter, RunTypeFilter } from './run-history-filters';
import { UsedTools } from './used-tools';
import { client } from '@refly/openapi-schema';
import { useFetchDataList } from '@refly-packages/ai-workspace-common/hooks/use-fetch-data-list';
import { useDebouncedCallback } from 'use-debounce';
import { useState } from 'react';
import './index.scss';

type ScheduleRecordStatus = 'pending' | 'running' | 'success' | 'failed';

interface ScheduleRecordItem {
  scheduleRecordId: string;
  scheduleId?: string;
  scheduleName: string;
  workflowTitle?: string;
  status: ScheduleRecordStatus;
  scheduledAt: string;
  triggeredAt?: string;
  completedAt?: string;
  creditUsed: number;
  failureReason?: string;
  usedTools?: string;
}

interface AvailableTool {
  id: string;
  name: string;
}

const RunHistoryList = memo(() => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const language = i18n.languages?.[0];

  // Filter states
  const [searchValue, setSearchValue] = useState('');
  const [debouncedSearchValue, setDebouncedSearchValue] = useState('');
  const [typeFilter, setTypeFilter] = useState<RunTypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<RunStatusFilter>('all');
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [availableTools, setAvailableTools] = useState<AvailableTool[]>([]);

  // Fetch available tools
  useEffect(() => {
    const fetchTools = async () => {
      try {
        const response = await client.post({
          url: '/schedule/records/tools',
          body: {},
        });
        const data = (response.data as any)?.data;
        if (Array.isArray(data)) {
          setAvailableTools(data as AvailableTool[]);
        }
      } catch (error) {
        console.error('Failed to fetch available tools:', error);
      }
    };
    fetchTools();
  }, []);

  // Debounced search
  const debouncedSearch = useDebouncedCallback((value: string) => {
    setDebouncedSearchValue(value);
  }, 300);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchValue(value);
      debouncedSearch(value);
    },
    [debouncedSearch],
  );

  // Fetch data using useFetchDataList hook
  const fetchScheduleRecords = useCallback(
    async ({ page, pageSize }: { page: number; pageSize: number }) => {
      try {
        const response = await client.post({
          url: '/schedule/records/list',
          body: {
            page,
            pageSize,
            status: statusFilter !== 'all' ? statusFilter : undefined,
            keyword: debouncedSearchValue || undefined,
            tools: selectedTools.length > 0 ? selectedTools : undefined,
          },
        });

        const responseData = (response.data as any)?.data;
        if (responseData) {
          return {
            success: true,
            data: responseData.items || [],
          };
        }
        return { success: false, data: [] };
      } catch (error) {
        console.error('Failed to fetch schedule records:', error);
        return { success: false, data: [] };
      }
    },
    [statusFilter, debouncedSearchValue, selectedTools],
  );

  const { dataList, isRequesting, reload } = useFetchDataList<ScheduleRecordItem>({
    fetchData: fetchScheduleRecords,
    pageSize: 20,
    dependencies: [statusFilter, debouncedSearchValue, selectedTools],
  });

  // Initial load
  useEffect(() => {
    reload();
  }, []);

  const handleViewDetail = useCallback(
    (record: ScheduleRecordItem) => {
      navigate(`/run-history/${record.scheduleRecordId}`);
    },
    [navigate],
  );

  const [triggeringScheduleId, setTriggeringScheduleId] = useState<string | null>(null);

  const handleTriggerSchedule = useCallback(
    async (record: ScheduleRecordItem) => {
      if (!record.scheduleId) {
        message.error(t('runHistory.triggerError.noScheduleId'));
        return;
      }

      setTriggeringScheduleId(record.scheduleId);
      try {
        await client.post({
          url: '/schedule/trigger',
          body: {
            scheduleId: record.scheduleId,
          },
        });
        message.success(t('runHistory.triggerSuccess'));
        // Reload data after a short delay to show the new record
        setTimeout(() => {
          reload();
        }, 1000);
      } catch (error) {
        console.error('Failed to trigger schedule:', error);
        message.error(t('runHistory.triggerError.failed'));
      } finally {
        setTriggeringScheduleId(null);
      }
    },
    [t, reload],
  );

  // Get status display config
  const getStatusConfig = useCallback(
    (status: ScheduleRecordStatus) => {
      const configs = {
        pending: {
          label: t('runHistory.status.init'),
          color: 'default' as const,
          textClass: 'text-gray-500',
        },
        running: {
          label: t('runHistory.status.executing'),
          color: 'processing' as const,
          textClass: 'text-blue-500',
        },
        success: {
          label: t('runHistory.status.succeeded'),
          color: 'success' as const,
          textClass: 'text-green-600',
        },
        failed: {
          label: t('runHistory.status.failed'),
          color: 'error' as const,
          textClass: 'text-red-600',
        },
      };
      return configs[status] || configs.pending;
    },
    [t],
  );

  // Table columns configuration
  const columns = useMemo(
    () => [
      {
        title: t('runHistory.tableTitle.title'),
        dataIndex: 'scheduleName',
        key: 'scheduleName',
        width: 300,
        fixed: 'left' as const,
        render: (text: string, record: ScheduleRecordItem) => (
          <Typography.Text
            className="text-sm text-refly-text-0 cursor-pointer hover:text-refly-text-1"
            ellipsis={{ tooltip: true }}
          >
            {text || record.workflowTitle || t('common.untitled')}
          </Typography.Text>
        ),
      },
      {
        title: t('runHistory.tableTitle.time'),
        dataIndex: 'scheduledAt',
        key: 'scheduledAt',
        width: 180,
        render: (scheduledAt: string) => (
          <span className="text-sm text-gray-500">
            {time(scheduledAt, language as LOCALE).format('YYYY/MM/DD, hh:mm:ss A')}
          </span>
        ),
      },
      {
        title: t('runHistory.tableTitle.tools'),
        dataIndex: 'usedTools',
        key: 'usedTools',
        width: 160,
        render: (usedTools: string) => <UsedTools usedTools={usedTools} />,
      },
      {
        title: t('runHistory.tableTitle.status'),
        dataIndex: 'status',
        key: 'status',
        width: 120,
        render: (status: ScheduleRecordStatus) => {
          const config = getStatusConfig(status);
          return <span className={`text-sm font-medium ${config.textClass}`}>{config.label}</span>;
        },
      },
      {
        title: t('runHistory.tableTitle.cost'),
        dataIndex: 'creditUsed',
        key: 'creditUsed',
        width: 100,
        render: (creditUsed: number) => (
          <span className="text-sm text-gray-500">{creditUsed ?? 0} Credit</span>
        ),
      },
      {
        title: t('runHistory.tableTitle.actions'),
        key: 'actions',
        width: 180,
        align: 'left' as const,
        fixed: 'right' as const,
        render: (_: unknown, record: ScheduleRecordItem) => (
          <div className="flex items-center gap-2">
            {record.scheduleId && (
              <Button
                type="link"
                size="small"
                loading={triggeringScheduleId === record.scheduleId}
                disabled={!!triggeringScheduleId}
                onClick={(e) => {
                  e.stopPropagation();
                  handleTriggerSchedule(record);
                }}
                className="!text-blue-600 hover:!text-blue-700 text-sm p-0"
              >
                {t('runHistory.triggerNow')}
              </Button>
            )}
            <Typography.Link
              className="!text-teal-600 hover:!text-teal-700 text-sm"
              onClick={(e) => {
                e.stopPropagation();
                handleViewDetail(record);
              }}
            >
              {t('runHistory.viewDetail')}
            </Typography.Link>
          </div>
        ),
      },
    ],
    [t, language, getStatusConfig, handleViewDetail, triggeringScheduleId, handleTriggerSchedule],
  );

  // Check if any filters are active
  const hasActiveFilters =
    searchValue || typeFilter !== 'all' || statusFilter !== 'all' || selectedTools.length > 0;

  const emptyState = (
    <div className="h-full flex items-center justify-center">
      <Empty
        description={
          <div className="text-gray-400 leading-5 text-sm">
            {hasActiveFilters ? t('runHistory.noSearchResults') : t('runHistory.noRuns')}
          </div>
        }
        image={EmptyImage}
        imageStyle={{ width: 180, height: 180 }}
      />
    </div>
  );

  return (
    <div className="run-history-list w-full h-full flex flex-col overflow-hidden bg-white dark:bg-gray-900">
      {/* Main content area */}
      <main className="flex-1 overflow-auto p-6">
        {/* Search and filters section */}
        <div className="mb-6">
          <RunHistoryFilters
            searchValue={searchValue}
            onSearchChange={handleSearchChange}
            typeFilter={typeFilter}
            onTypeChange={setTypeFilter}
            statusFilter={statusFilter}
            onStatusChange={setStatusFilter}
            selectedTools={selectedTools}
            onToolsChange={setSelectedTools}
            availableTools={availableTools}
          />
        </div>

        {/* Data table */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          {isRequesting && dataList.length === 0 ? (
            <div className="h-[400px] w-full flex items-center justify-center">
              <Spin />
            </div>
          ) : dataList.length > 0 ? (
            <div className="flex flex-col">
              <Table
                columns={columns}
                dataSource={dataList}
                rowKey="scheduleRecordId"
                pagination={false}
                scroll={{ y: 'calc(var(--screen-height) - 280px)' }}
                className="run-history-table"
                size="middle"
                loading={isRequesting}
                onRow={(record: ScheduleRecordItem) => ({
                  className: 'cursor-pointer hover:!bg-gray-50 dark:hover:!bg-gray-800',
                  onClick: () => {
                    handleViewDetail(record);
                  },
                })}
              />
              <EndMessage />
            </div>
          ) : (
            emptyState
          )}
        </div>
      </main>
    </div>
  );
});

RunHistoryList.displayName = 'RunHistoryList';

export default RunHistoryList;
