import { useGetWorkflowAppDetail } from '@refly-packages/ai-workspace-common/queries';
import { Segmented } from 'antd';
import React, { memo, useCallback, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { GithubStar } from '@refly-packages/ai-workspace-common/components/common/github-star';
import { Logo } from '@refly-packages/ai-workspace-common/components/common/logo';
import { WorkflowAppProducts } from '@refly-packages/ai-workspace-common/components/workflow-app/products';
import { WorkflowAppRunLogs } from '@refly-packages/ai-workspace-common/components/workflow-app/run-logs';

// Types for page labels to support future i18n
interface TabItem {
  key: string;
  label: string;
}

interface FeatureItem {
  title: string;
  description: string;
}

interface PageLabels {
  heroTitle: string;
  heroSubtitle: string;
  promptChips: string[];
  agentBadge: string;
  startButton: string;
  tabs: TabItem[];
  emptyTitle: string;
  emptyDescription: string;
  whyTitle: string;
  features: FeatureItem[];
}

// Small presentational components
const Badge = memo<{ text: string }>((props) => {
  const { text } = props;
  return (
    <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600 shadow-sm">
      {text}
    </span>
  );
});

const PromptBar = memo<{
  agentBadge: string;
  onStart: () => void;
  startText: string;
}>(({ agentBadge, onStart, startText }) => {
  return (
    <div className="w-full rounded-2xl border border-emerald-200 bg-white/70 p-3 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
        <Badge text={agentBadge} />
        <div className="ml-auto hidden items-center gap-2 md:flex">
          <span className="text-xs text-slate-400">...</span>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-center">
        <button
          type="button"
          onClick={onStart}
          className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"
        >
          {startText}
        </button>
      </div>
    </div>
  );
});

const WorkflowAppPage: React.FC = () => {
  const { t } = useTranslation();
  const { appId: routeAppId } = useParams();
  const navigate = useNavigate();
  const appId = routeAppId ?? '';
  const [activeTab, setActiveTab] = useState<string>('runLogs');

  // All texts are centralized here for future i18n
  const labels = useMemo<PageLabels>(() => {
    return {
      heroTitle: 'AI Website Generator',
      heroSubtitle:
        'Describe what you want. The agent will orchestrate a workflow to generate a website that matches your goals. Edit anytime and iterate fast.',
      promptChips: [
        'Generate a website',
        'Theme: Tech Startup',
        'References: design system, docs',
        'Style: Modern/Tech',
        'Pages: 8–12',
      ],
      agentBadge: 'Agent',
      startButton: 'Create Website',
      tabs: [
        { key: 'intro', label: 'App Intro' },
        { key: 'logs', label: 'Run Logs' },
        { key: 'artifacts', label: 'Artifacts' },
      ],
      emptyTitle: 'No artifacts yet',
      emptyDescription: 'Artifacts will be displayed here once the workflow finishes successfully.',
      whyTitle: 'Why choose Refly Workflow?',
      features: [
        {
          title: 'Accessible for everyone',
          description:
            'Non‑technical users can create production‑ready sites with natural language prompts.',
        },
        {
          title: 'Configure once, reuse many times',
          description:
            'Turn a workflow into a reusable template that can be triggered again and again.',
        },
        {
          title: 'Context preserved',
          description:
            'Memory and knowledge make the agent smarter over time without losing context.',
        },
        {
          title: 'Ready to deliver',
          description: 'Generate assets that can be shipped directly to your users or team.',
        },
        {
          title: 'Share and monetize',
          description:
            'Distribute your workflow as an app. Share, collaborate, and monetize with ease.',
        },
        {
          title: 'More to explore',
          description: 'Extensible building blocks unlock more possibilities as you grow.',
        },
      ],
    };
  }, []);

  const { data, isLoading } = useGetWorkflowAppDetail({ query: { appId } });
  const workflowApp = data?.data;
  console.log('appDetail', workflowApp);
  console.log('isLoading', isLoading);

  const onStart = useCallback(() => {
    // Placeholder handler. Integrate with actual action later.
    // This keeps UX consistent during development.
    // eslint-disable-next-line no-alert
    window?.alert?.('Start workflow');
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
        <div className="mx-auto mt-6 max-w-3xl">
          <PromptBar
            agentBadge={labels?.agentBadge ?? 'Agent'}
            onStart={onStart}
            startText={labels?.startButton ?? 'Start'}
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
            <WorkflowAppProducts appId={appId} />
          ) : activeTab === 'runLogs' ? (
            <WorkflowAppRunLogs appId={appId} />
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default memo(WorkflowAppPage);
