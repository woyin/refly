import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useGetPublicWorkflowAppDetail } from '@refly-packages/ai-workspace-common/queries';
import { message, Segmented, notification } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CanvasNodeType, WorkflowNodeExecution, WorkflowVariable } from '@refly/openapi-schema';
import { GithubStar } from '@refly-packages/ai-workspace-common/components/common/github-star';
import { Logo } from '@refly-packages/ai-workspace-common/components/common/logo';
import { WorkflowAppProducts } from '@refly-packages/ai-workspace-common/components/workflow-app/products';
import { WorkflowAppRunLogs } from '@refly-packages/ai-workspace-common/components/workflow-app/run-logs';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { WorkflowRunForm } from '@refly-packages/ai-workspace-common/components/canvas/workflow-run/workflow-run-form';
import { useWorkflowExecutionPolling } from '@refly-packages/ai-workspace-common/hooks/use-workflow-execution-polling';
import { ReactFlowProvider } from '@refly-packages/ai-workspace-common/components/canvas';
import SettingModal from '@refly-packages/ai-workspace-common/components/settings';
import { useSiderStoreShallow, useCanvasOperationStoreShallow } from '@refly/stores';
import { ToolsDependencyChecker } from '@refly-packages/ai-workspace-common/components/canvas/tools-dependency';
import { CanvasProvider } from '@refly-packages/ai-workspace-common/context/canvas';
import { useIsLogin } from '@refly-packages/ai-workspace-common/hooks/use-is-login';

const WorkflowAppPage: React.FC = () => {
  const { t } = useTranslation();
  const { appId: routeAppId } = useParams();
  const navigate = useNavigate();
  const appId = routeAppId ?? '';
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('runLogs');
  const [workflowVariables, setWorkflowVariables] = useState<WorkflowVariable[]>([]);
  const [finalNodeExecutions, setFinalNodeExecutions] = useState<any[]>([]);

  // Settings modal state
  const { showSettingModal, setShowSettingModal } = useSiderStoreShallow((state) => ({
    showSettingModal: state.showSettingModal,
    setShowSettingModal: state.setShowSettingModal,
  }));

  // Canvas operation state for duplicate functionality
  const { openDuplicateModal } = useCanvasOperationStoreShallow((state) => ({
    openDuplicateModal: state.openDuplicateModal,
  }));

  // Check user login status
  const { isLoggedRef } = useIsLogin();

  // Always use public workflow app data for consistent behavior
  // This ensures both owner and other users see the same published version
  const { data: publicData, isLoading: isPublicLoading } = useGetPublicWorkflowAppDetail(
    { path: { appId } },
    undefined,
    { enabled: !!appId },
  );

  const data = publicData;
  const isLoading = isPublicLoading;
  const workflowApp = data?.data;
  console.log('appDetail', workflowApp);
  console.log('isLoading', isLoading);

  useEffect(() => {
    if (workflowApp?.variables) {
      setWorkflowVariables(workflowApp?.variables ?? []);
    }
  }, [workflowApp]);

  const { data: workflowDetail } = useWorkflowExecutionPolling({
    executionId,
    enabled: true,
    interval: 1000,

    onComplete: (status, data) => {
      // Save final nodeExecutions before clearing executionId
      if (data?.data?.nodeExecutions) {
        setFinalNodeExecutions(data.data.nodeExecutions);
      }

      // Clear executionId when workflow completes or fails
      setExecutionId(null);

      if (status === 'finish') {
        notification.success({
          message: t('workflowApp.run.completed') || 'App run successfully',
        });
      } else if (status === 'failed') {
        notification.error({
          message: t('workflowApp.run.failed') || 'App run failed',
        });
      }
    },
    onError: (_error) => {
      // Clear executionId on error
      setExecutionId(null);
      notification.error({
        message: t('workflowApp.run.error') || 'Run error',
      });
    },
  });

  useEffect(() => {
    console.log('workflowDetail', workflowDetail);
  }, [workflowDetail]);

  const nodeExecutions = useMemo(() => {
    // Use current workflowDetail if available, otherwise use final cached results
    return workflowDetail?.nodeExecutions || finalNodeExecutions || [];
  }, [workflowDetail, finalNodeExecutions]);

  console.log('nodeExecutions', nodeExecutions);

  const products = useMemo(() => {
    return nodeExecutions.filter((nodeExecution: WorkflowNodeExecution) =>
      ['document', 'codeArtifact', 'image', 'video', 'audio'].includes(
        nodeExecution.nodeType as CanvasNodeType,
      ),
    );
  }, [nodeExecutions]);

  const logs = useMemo(() => {
    return nodeExecutions.filter((nodeExecution: WorkflowNodeExecution) =>
      ['skillResponse'].includes(nodeExecution.nodeType as CanvasNodeType),
    );
  }, [nodeExecutions]);

  const onSubmit = useCallback(
    async (variables: WorkflowVariable[]) => {
      // Check if user is logged in before executing workflow
      if (!isLoggedRef.current) {
        message.warning('Please login to run this workflow');
        // Redirect to login with return URL
        const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
        navigate(`/?autoLogin=true&returnUrl=${returnUrl}`);
        return;
      }

      const { data, error } = await getClient().executeWorkflowApp({
        body: {
          appId,
          variables,
        },
      });

      if (error) {
        message.error(`executeWorkflowApp error: ${error}`);
        return;
      }

      const newExecutionId = data?.data?.executionId ?? null;
      if (newExecutionId) {
        setExecutionId(newExecutionId);
        message.success('Workflow started');
      } else {
        message.error('Failed to get execution ID');
      }
    },
    [appId, isLoggedRef, navigate],
  );

  const handleCopyWorkflow = useCallback(() => {
    console.log('copy workflow');

    // Check if user is logged in before copying workflow
    if (!isLoggedRef.current) {
      message.warning('Please login to copy this workflow');
      // Redirect to login with return URL
      const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
      navigate(`/?autoLogin=true&returnUrl=${returnUrl}`);
      return;
    }

    if (!workflowApp?.canvasId || !workflowApp?.title) {
      message.error(t('common.error'));
      return;
    }

    openDuplicateModal(workflowApp.canvasId, workflowApp.title);
  }, [workflowApp?.canvasId, workflowApp?.title, openDuplicateModal, t, isLoggedRef, navigate]);

  const segmentedOptions = useMemo(() => {
    return [
      {
        label: t('workflowApp.runLogs'),
        value: 'runLogs',
      },
      {
        label: t('workflowApp.products'),
        value: 'products',
      },
    ];
  }, [t]);

  console.log('products', products);

  return (
    <ReactFlowProvider>
      <CanvasProvider readonly={true} canvasId={workflowApp?.canvasId ?? ''}>
        <div className="min-h-screen bg-gray-50">
          {/* Header */}
          <div className="bg-white border-b border-gray-200">
            <div className="mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">
                <div className="flex items-center gap-3">
                  <Logo onClick={() => navigate?.('/')} />
                  <GithubStar />
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            {/* Hero Section */}
            <div className="text-center mb-6 sm:mb-8">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">
                {workflowApp?.title ?? ''}
              </h1>
              <p className="mt-3 sm:mt-4 text-base sm:text-lg text-gray-600 max-w-2xl mx-auto">
                {workflowApp?.description ?? ''}
              </p>
            </div>

            {/* Workflow Form */}
            <div className="mb-6 sm:mb-8">
              <WorkflowRunForm
                workflowVariables={workflowVariables}
                onSubmitVariables={onSubmit}
                loading={isLoading}
                onCopyWorkflow={handleCopyWorkflow}
              />
            </div>

            {/* Tools Dependency Form */}
            {workflowApp?.canvasId && (
              <div className="mb-6 sm:mb-8">
                <ToolsDependencyChecker canvasId={workflowApp.canvasId} />
              </div>
            )}

            {/* Tabs */}
            <div className="mb-4 sm:mb-6 flex justify-center">
              <Segmented
                className="max-w-sm sm:max-w-md mx-auto"
                shape="round"
                options={segmentedOptions}
                value={activeTab}
                onChange={(value) => setActiveTab(value)}
              />
            </div>

            {/* Content Area */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm min-h-[200px]">
              {activeTab === 'products' ? (
                <WorkflowAppProducts products={products || []} />
              ) : activeTab === 'runLogs' ? (
                <WorkflowAppRunLogs nodeExecutions={logs || []} />
              ) : null}
            </div>
          </div>
        </div>

        {/* Settings Modal */}
        <SettingModal visible={showSettingModal} setVisible={setShowSettingModal} />
      </CanvasProvider>
    </ReactFlowProvider>
  );
};

export default memo(WorkflowAppPage);
