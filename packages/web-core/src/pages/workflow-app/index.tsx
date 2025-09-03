import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useGetWorkflowAppDetail } from '@refly-packages/ai-workspace-common/queries';
import { message, Segmented } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { WorkflowVariable } from '@refly/openapi-schema';
import { GithubStar } from '@refly-packages/ai-workspace-common/components/common/github-star';
import { Logo } from '@refly-packages/ai-workspace-common/components/common/logo';
import { WorkflowAppProducts } from '@refly-packages/ai-workspace-common/components/workflow-app/products';
import { WorkflowAppRunLogs } from '@refly-packages/ai-workspace-common/components/workflow-app/run-logs';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { WorkflowRunForm } from '@refly-packages/ai-workspace-common/components/canvas/workflow-run/workflow-run-form';

const WorkflowAppPage: React.FC = () => {
  const { t } = useTranslation();
  const { appId: routeAppId } = useParams();
  const navigate = useNavigate();
  const appId = routeAppId ?? '';
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('runLogs');
  const [workflowVariables, setWorkflowVariables] = useState<WorkflowVariable[]>([]);

  const { data, isLoading } = useGetWorkflowAppDetail({ query: { appId } });
  const workflowApp = data?.data;
  console.log('appDetail', workflowApp);
  console.log('isLoading', isLoading);

  useEffect(() => {
    if (workflowApp?.variables) {
      setWorkflowVariables(workflowApp?.variables ?? []);
    }
  }, [workflowApp]);

  const onSubmit = useCallback(async (variables: WorkflowVariable[]) => {
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

    setExecutionId(data?.data?.executionId ?? null);

    message.success('Workflow started');
  }, []);

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

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 p-4">
        <Logo onClick={() => navigate?.('/')} />
        <GithubStar />
      </div>

      {/* Hero Section */}
      <div className="relative mx-auto max-w-5xl px-4 pt-10 md:pt-14">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
            {workflowApp?.title ?? ''}
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600 md:text-base">
            {workflowApp?.description ?? ''}
          </p>
        </div>

        {/* Prompt Bar */}
        <div className="mx-auto mt-6 max-w-xl">
          <WorkflowRunForm
            workflowVariables={workflowVariables}
            onSubmitVariables={onSubmit}
            loading={isLoading}
          />
        </div>

        {/* Tabs */}
        <div className="mx-auto mt-6 flex max-w-4xl items-center justify-center gap-2">
          <Segmented
            className="w-[60%] [&_.ant-segmented-item]:flex-1 [&_.ant-segmented-item]:text-center"
            shape="round"
            options={segmentedOptions}
            value={activeTab}
            onChange={(value) => setActiveTab(value)}
          />
        </div>

        {/* Content area */}
        <div className="mx-auto mt-3 max-w-4xl">
          {activeTab === 'products' ? (
            <WorkflowAppProducts appId={appId} executionId={executionId ?? ''} />
          ) : activeTab === 'runLogs' ? (
            <WorkflowAppRunLogs appId={appId} executionId={executionId ?? ''} />
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default memo(WorkflowAppPage);
