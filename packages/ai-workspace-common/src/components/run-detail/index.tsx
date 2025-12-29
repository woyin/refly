import { memo, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Empty, message } from 'antd';
import { client } from '@refly/openapi-schema';
import { Canvas, SnapshotData } from '@refly-packages/ai-workspace-common/components/canvas';
import { RunDetailInfo } from '@refly-packages/ai-workspace-common/components/canvas/run-detail-panel';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';
import { useDuplicateCanvas } from '@refly-packages/ai-workspace-common/hooks/use-duplicate-canvas';
import EmptyImage from '@refly-packages/ai-workspace-common/assets/noResource.svg';
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

interface RunDetailProps {
  recordId: string;
}

const RunDetail = memo(({ recordId }: RunDetailProps) => {
  const { t } = useTranslation();

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

        const responseData = (response.data as any)?.data;
        if (responseData) {
          setRecord(responseData as ScheduleRecordDetail);
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
  // Always try to fetch snapshot, even for failed runs
  useEffect(() => {
    const fetchSnapshot = async () => {
      if (!record) return;

      // Try to fetch snapshot regardless of status or snapshotStorageKey
      // The backend will return the snapshot if it exists
      setSnapshotLoading(true);

      try {
        const response = await client.post({
          url: '/schedule/record/snapshot',
          body: { scheduleRecordId: recordId },
        });

        const responseData = (response.data as any)?.data;
        if (responseData) {
          // Ensure the snapshot has the title from record for display
          const snapshotWithTitle = {
            ...responseData,
            title: responseData.title || record.workflowTitle || record.scheduleName,
          };
          setSnapshot(snapshotWithTitle as SnapshotData);
        }
      } catch (err) {
        console.error('Failed to fetch snapshot:', err);
        // Snapshot error is not critical, we can still show a message
      } finally {
        setSnapshotLoading(false);
      }
    };

    fetchSnapshot();
  }, [record, recordId]);

  const handleDuplicate = useCallback(() => {
    if (!record?.canvasId) {
      message.error(t('runDetail.duplicateFailed'));
      return;
    }

    duplicateCanvas({
      canvasId: record.canvasId,
      title: record.workflowTitle || t('common.untitled'),
      isCopy: true,
      onSuccess: () => {
        message.success(t('runDetail.duplicateSuccess'));
      },
    });
  }, [record, duplicateCanvas, t]);

  // Build runDetailInfo from record
  const runDetailInfo: RunDetailInfo | undefined = record
    ? {
        status: record.status,
        triggeredAt: record.triggeredAt,
        completedAt: record.completedAt,
        creditUsed: record.creditUsed,
        failureReason: record.failureReason,
        canvasId: record.canvasId,
        workflowTitle: record.workflowTitle,
      }
    : undefined;

  if (loading) {
    return (
      <div className="run-detail w-full h-full flex items-center justify-center bg-refly-bg-main-z1">
        <Spin size="large" />
      </div>
    );
  }

  if (error || !record) {
    return (
      <div className="run-detail w-full h-full flex items-center justify-center bg-refly-bg-main-z1">
        <Empty
          description={<span className="text-refly-text-2">{t('runDetail.notFound')}</span>}
          image={EmptyImage}
          imageStyle={{ width: 180, height: 180 }}
        />
      </div>
    );
  }

  return (
    <div className="run-detail w-full h-full flex flex-col overflow-hidden">
      {snapshotLoading ? (
        <div className="w-full h-full flex items-center justify-center bg-refly-bg-main-z1">
          <Spin size="large" />
        </div>
      ) : snapshot ? (
        <Canvas
          canvasId={record.canvasId}
          readonly
          snapshotData={snapshot}
          hideLogoButton
          runDetailInfo={runDetailInfo}
          onDuplicate={handleDuplicate}
          duplicateLoading={duplicateLoading}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-refly-bg-main-z1">
          <Empty
            description={<span className="text-refly-text-2">{t('runDetail.noSnapshot')}</span>}
            image={EmptyImage}
            imageStyle={{ width: 120, height: 120 }}
          />
        </div>
      )}
    </div>
  );
});

RunDetail.displayName = 'RunDetail';

export default RunDetail;
