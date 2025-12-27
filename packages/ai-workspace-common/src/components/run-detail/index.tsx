import { memo, useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from '@refly-packages/ai-workspace-common/utils/router';
import { useTranslation } from 'react-i18next';
import { Button, Tag, Spin, Empty, Typography, message } from 'antd';
import { ArrowLeft, Copy } from 'lucide-react';
import { LuShuffle } from 'react-icons/lu';
import { client } from '@refly/openapi-schema';
import { ReactFlow, ReactFlowProvider, Background } from '@xyflow/react';
import { nodeTypes } from '@refly-packages/ai-workspace-common/components/canvas/nodes';
import { time } from '@refly-packages/ai-workspace-common/utils/time';
import { LOCALE } from '@refly/common-types';
import { useDuplicateCanvas } from '@refly-packages/ai-workspace-common/hooks/use-duplicate-canvas';
import EmptyImage from '@refly-packages/ai-workspace-common/assets/noResource.svg';
import '@xyflow/react/dist/style.css';
import './index.scss';

interface ScheduleRecordDetail {
  scheduleRecordId: string;
  scheduleId: string;
  workflowExecutionId?: string;
  uid: string;
  canvasId: string;
  workflowTitle: string;
  usedTools?: string;
  status: string;
  creditUsed: number;
  scheduledAt: string;
  triggeredAt: string;
  completedAt?: string;
  failureReason?: string;
  snapshotStorageKey?: string;
  scheduleName: string;
}

interface SnapshotData {
  nodes: any[];
  edges: any[];
}

interface RunDetailProps {
  recordId: string;
}

const StatusTag = memo(({ status }: { status: string }) => {
  const { t } = useTranslation();

  const statusConfig: Record<string, { color: string; text: string }> = {
    pending: { color: 'default', text: t('runHistory.status.init') },
    running: { color: 'processing', text: t('runHistory.status.executing') },
    success: { color: 'success', text: t('runHistory.status.succeeded') },
    failed: { color: 'error', text: t('runHistory.status.failed') },
  };

  const config = statusConfig[status] || { color: 'default', text: status };

  return <Tag color={config.color}>{config.text}</Tag>;
});

StatusTag.displayName = 'StatusTag';

const RunDetail = memo(({ recordId }: RunDetailProps) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const language = i18n.languages?.[0];

  const [loading, setLoading] = useState(true);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [record, setRecord] = useState<ScheduleRecordDetail | null>(null);
  const [snapshot, setSnapshot] = useState<SnapshotData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { duplicateCanvas, loading: duplicateLoading } = useDuplicateCanvas();

  // Fetch record detail
  useEffect(() => {
    const fetchRecordDetail = async () => {
      if (!recordId) return;

      setLoading(true);
      setError(null);

      try {
        const response = await client.post({
          url: '/schedule/record/detail',
          body: { scheduleRecordId: recordId },
        });

        if (response.data) {
          setRecord(response.data as ScheduleRecordDetail);
        } else {
          setError(t('runDetail.notFound'));
        }
      } catch (err) {
        console.error('Failed to fetch record detail:', err);
        setError(t('runDetail.notFound'));
      } finally {
        setLoading(false);
      }
    };

    fetchRecordDetail();
  }, [recordId, t]);

  // Fetch snapshot data after record is loaded
  useEffect(() => {
    const fetchSnapshot = async () => {
      if (!record?.snapshotStorageKey) return;

      setSnapshotLoading(true);

      try {
        const response = await client.post({
          url: '/schedule/record/snapshot',
          body: { scheduleRecordId: recordId },
        });

        if (response.data) {
          setSnapshot(response.data as SnapshotData);
        }
      } catch (err) {
        console.error('Failed to fetch snapshot:', err);
        // Snapshot error is not critical, we can still show record info
      } finally {
        setSnapshotLoading(false);
      }
    };

    fetchSnapshot();
  }, [record, recordId]);

  const handleBack = useCallback(() => {
    navigate('/run-history');
  }, [navigate]);

  const handleCopy = useCallback(() => {
    if (!record?.canvasId) {
      message.error(t('runDetail.copyFailed'));
      return;
    }

    duplicateCanvas({
      canvasId: record.canvasId,
      title: record.workflowTitle || t('common.untitled'),
      isCopy: true,
      onSuccess: () => {
        message.success(t('runDetail.copySuccess'));
      },
    });
  }, [record, duplicateCanvas, t]);

  const handleRemix = useCallback(() => {
    if (!record?.canvasId) {
      message.error(t('runDetail.remixFailed'));
      return;
    }

    duplicateCanvas({
      canvasId: record.canvasId,
      title: `${record.workflowTitle || t('common.untitled')} - Remix`,
      isCopy: false,
      onSuccess: () => {
        message.success(t('runDetail.remixSuccess'));
      },
    });
  }, [record, duplicateCanvas, t]);

  // Memoize nodes and edges for ReactFlow
  const flowNodes = useMemo(() => {
    if (!snapshot?.nodes) return [];
    return snapshot.nodes.map((node: any) => ({
      ...node,
      draggable: false,
      selectable: false,
      connectable: false,
    }));
  }, [snapshot]);

  const flowEdges = useMemo(() => {
    return snapshot?.edges || [];
  }, [snapshot]);

  if (loading) {
    return (
      <div className="run-detail w-full h-full flex items-center justify-center bg-refly-bg-main-z1">
        <Spin size="large" tip={t('runDetail.loading')} />
      </div>
    );
  }

  if (error || !record) {
    return (
      <div className="run-detail w-full h-full flex flex-col overflow-hidden bg-refly-bg-main-z1">
        {/* Header */}
        <div className="h-14 px-4 flex items-center border-b border-solid border-refly-Card-Border bg-refly-secondary-default/10">
          <Button
            type="text"
            icon={<ArrowLeft size={16} />}
            onClick={handleBack}
            className="flex items-center gap-2 text-refly-text-1 hover:text-refly-text-0"
          >
            {t('runDetail.backToHistory')}
          </Button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Empty
            description={<span className="text-refly-text-2">{t('runDetail.notFound')}</span>}
            image={EmptyImage}
            imageStyle={{ width: 180, height: 180 }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="run-detail w-full h-full flex flex-col overflow-hidden bg-refly-bg-main-z1">
      {/* Header */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-solid border-refly-Card-Border bg-refly-secondary-default/10">
        <div className="flex items-center gap-4">
          <Button
            type="text"
            icon={<ArrowLeft size={16} />}
            onClick={handleBack}
            className="flex items-center gap-2 text-refly-text-1 hover:text-refly-text-0"
          >
            {t('runDetail.backToHistory')}
          </Button>
          <div className="h-6 w-px bg-refly-Card-Border" />
          <Typography.Text
            className="text-base font-medium text-refly-text-0"
            ellipsis={{ tooltip: true }}
          >
            {record.workflowTitle || t('common.untitled')}
          </Typography.Text>
          <StatusTag status={record.status} />
        </div>
        <div className="flex items-center gap-2">
          <Button
            icon={<Copy size={16} />}
            onClick={handleCopy}
            loading={duplicateLoading}
            disabled={duplicateLoading}
          >
            {t('runDetail.actions.copy')}
          </Button>
          <Button
            type="primary"
            icon={<LuShuffle size={16} />}
            onClick={handleRemix}
            loading={duplicateLoading}
            disabled={duplicateLoading}
          >
            {t('runDetail.actions.remix')}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Run Info */}
        <div className="w-80 flex-shrink-0 border-r border-solid border-refly-Card-Border p-4 overflow-y-auto">
          <div className="space-y-4">
            <div>
              <div className="text-sm text-refly-text-2 mb-1">{t('runDetail.status')}</div>
              <StatusTag status={record.status} />
            </div>

            <div>
              <div className="text-sm text-refly-text-2 mb-1">{t('runDetail.triggeredAt')}</div>
              <div className="text-sm text-refly-text-0">
                {time(record.triggeredAt, language as LOCALE).format('YYYY-MM-DD HH:mm:ss')}
              </div>
            </div>

            {record.completedAt && (
              <div>
                <div className="text-sm text-refly-text-2 mb-1">{t('runDetail.completedAt')}</div>
                <div className="text-sm text-refly-text-0">
                  {time(record.completedAt, language as LOCALE).format('YYYY-MM-DD HH:mm:ss')}
                </div>
              </div>
            )}

            <div>
              <div className="text-sm text-refly-text-2 mb-1">{t('runDetail.creditUsed')}</div>
              <div className="text-sm text-refly-text-0">{record.creditUsed}</div>
            </div>

            {record.failureReason && (
              <div>
                <div className="text-sm text-refly-text-2 mb-1">{t('runDetail.failureReason')}</div>
                <div className="text-sm text-red-500">{record.failureReason}</div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Canvas Snapshot */}
        <div className="flex-1 relative">
          {snapshotLoading ? (
            <div className="w-full h-full flex items-center justify-center">
              <Spin size="large" />
            </div>
          ) : snapshot ? (
            <ReactFlowProvider>
              <ReactFlow
                nodes={flowNodes}
                edges={flowEdges}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
                panOnScroll
                zoomOnScroll
                zoomOnPinch
                zoomOnDoubleClick={false}
                className="bg-refly-bg-canvas"
              >
                <Background />
              </ReactFlow>
            </ReactFlowProvider>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Empty
                description={<span className="text-refly-text-2">{t('runDetail.noSnapshot')}</span>}
                image={EmptyImage}
                imageStyle={{ width: 120, height: 120 }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

RunDetail.displayName = 'RunDetail';

export default RunDetail;
