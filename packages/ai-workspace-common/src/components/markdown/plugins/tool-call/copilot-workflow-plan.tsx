import { memo, useState, useEffect, useRef, useCallback } from 'react';
import { NodeIcon } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/node-icon';
import { type WorkflowPlan } from '@refly/canvas-common';
import { NewConversation, Mcp } from 'refly-icons';
import { InputParameterRow } from '@refly-packages/ai-workspace-common/components/canvas/nodes/start';
import { LabelWrapper } from './label-wrapper';

import { useTranslation } from 'react-i18next';
import { WorkflowVariable } from '@refly/openapi-schema';
import { Typography, Dropdown, Divider } from 'antd';
const { Paragraph } = Typography;

const exampleData: WorkflowPlan = {
  tasks: [
    {
      id: 'fetch_product_hunt_data',
      title: '抓取 Product Hunt Top 10',
      prompt:
        '使用 Perplexity AI 抓取工具获取 Product Hunt 今日 Top 10 产品数据，包括产品名称、简介、链接等关键信息。',
      selectedToolsets: [{ key: 'perplexity', tools: ['search'] }],
    },
    {
      id: 'generate_summary_document',
      title: '生成总结文档',
      prompt:
        '根据抓取到的 Product Hunt Top 10 数据，生成一份总结文档。文档应包含每个产品的名称、简介、主要特点和 Product Hunt 链接。文档格式为 Markdown。',
      selectedToolsets: [
        { key: 'builtin', tools: ['generate_doc'] },
        { key: 'builtin', tools: ['generate_doc'] },
        { key: 'builtin', tools: ['generate_doc'] },
        { key: 'builtin', tools: ['generate_doc'] },
        { key: 'builtin', tools: ['generate_doc'] },
        { key: 'builtin', tools: ['generate_doc'] },
        { key: 'builtin', tools: ['generate_doc'] },
        { key: 'builtin', tools: ['generate_doc'] },
        { key: 'builtin', tools: ['generate_doc'] },
        { key: 'builtin', tools: ['generate_doc'] },
      ],
    },
    {
      id: 'generate_product_podcast',
      title: '生成产品播客',
      prompt:
        '根据 Product Hunt Top 10 的总结内容，生成一个时长约 5 分钟的产品播客。播客内容应包括对每个产品的简要介绍和亮点，语气轻松活泼。',
      selectedToolsets: [{ key: 'fal_audio', tools: ['text_to_speech'] }],
    },
    {
      id: 'send_email_with_links',
      title: '发送邮件',
      prompt:
        '将生成的总结文档和产品播客的链接发送到指定邮箱。邮件主题为“今日 Product Hunt Top 10 总结与播客”，邮件正文包含两个链接。',
      selectedToolsets: [{ key: 'builtin', tools: ['send_email'] }],
    },
  ],
  variables: [
    { name: 'email_address', type: 'string', description: '接收邮件的邮箱地址' },
    { name: 'summary_document_link', type: 'string', description: '总结文档的下载链接' },
    { name: 'podcast_link', type: 'string', description: '产品播客的下载链接' },
  ],
};

// Component for displaying toolset labels with ellipsis when overflow
const LabelsDisplay = memo(
  ({ toolsets }: { toolsets: Array<{ key: string; tools: string[] }> }) => {
    const labelsContainerRef = useRef<HTMLDivElement>(null);
    const measureContainerRef = useRef<HTMLDivElement>(null);
    const [visibleCount, setVisibleCount] = useState(toolsets.length);
    const [isOverflowing, setIsOverflowing] = useState(false);

    // Calculate how many labels can fit in the container
    const calculateVisibleCount = useCallback(() => {
      if (!labelsContainerRef.current || toolsets.length === 0) return;

      const labelsContainer = labelsContainerRef.current;
      const containerWidth = labelsContainer.offsetWidth;
      if (containerWidth === 0) {
        return;
      }

      const gapWidth = 4; // gap-1 = 4px
      const ellipsisWidth = 16; // Approximate width of "..."

      // Measure labels in the hidden measurement container
      const measureContainer = measureContainerRef.current;
      const labelElements = measureContainer?.querySelectorAll(
        '.label-measure-item',
      ) as NodeListOf<HTMLElement> | null;

      if (!labelElements || labelElements.length === 0) return;

      let totalWidth = 0;
      let fitCount = 0;

      for (let i = 0; i < toolsets.length; i++) {
        const currentLabelElement = labelElements[i];
        if (!currentLabelElement) break;

        const labelWidth = currentLabelElement.offsetWidth + (i > 0 ? gapWidth : 0);

        // Check if adding this label plus ellipsis (if needed) would fit
        const wouldFit =
          totalWidth + labelWidth + (i < toolsets.length - 1 ? ellipsisWidth + gapWidth : 0) <=
          containerWidth;

        if (wouldFit) {
          totalWidth += labelWidth;
          fitCount = i + 1;
        } else {
          break;
        }
      }

      setVisibleCount(Math.max(0, fitCount));
      setIsOverflowing(fitCount < toolsets.length);
    }, [toolsets]);

    // Calculate on mount and when toolsets change
    useEffect(() => {
      const timer = requestAnimationFrame(() => {
        calculateVisibleCount();
      });

      return () => cancelAnimationFrame(timer);
    }, [calculateVisibleCount]);

    // Listen to container resize
    useEffect(() => {
      if (!labelsContainerRef.current) return;

      const resizeObserver = new ResizeObserver(() => {
        calculateVisibleCount();
      });

      resizeObserver.observe(labelsContainerRef.current);

      return () => {
        resizeObserver.disconnect();
      };
    }, [calculateVisibleCount]);

    if (toolsets.length === 0) return null;

    const visibleToolsets = toolsets.slice(0, visibleCount);
    const hiddenToolsets = toolsets.slice(visibleCount);

    // Create dropdown menu items for hidden toolsets
    const dropdownMenuItems = hiddenToolsets.map((toolset, index) => ({
      key: `hidden-${toolset.key}-${index}`,
      label: (
        <div className="flex items-center">
          <LabelWrapper
            source="toolsets"
            toolset={{ type: 'regular', id: toolset.key, name: toolset.key }}
          />
        </div>
      ),
    }));

    return (
      <div className="flex items-center gap-1 min-w-0 flex-1">
        <Mcp size={14} color="var(--refly-text-3)" className="flex-shrink-0" />
        <div
          ref={labelsContainerRef}
          className="flex items-center gap-1 min-w-0 flex-1 overflow-hidden"
        >
          {visibleToolsets.map((toolset, index) => (
            <LabelWrapper
              key={`${toolset.key}-${index}`}
              source="toolsets"
              toolset={{ type: 'regular', id: toolset.key, name: toolset.key }}
            />
          ))}
          {isOverflowing && (
            <Dropdown
              menu={{ items: dropdownMenuItems, className: 'max-h-[200px] overflow-y-auto' }}
              placement="top"
              trigger={['hover']}
            >
              <div className="text-refly-text-2 text-xs flex-shrink-0 leading-[18px] cursor-pointer hover:text-refly-text-0">
                ...
              </div>
            </Dropdown>
          )}
        </div>
        {/* Hidden measurement container for accurate width calculation */}
        <div
          ref={measureContainerRef}
          aria-hidden="true"
          className="absolute left-[-9999px] top-[-9999px] whitespace-nowrap pointer-events-none flex items-center gap-1"
        >
          {toolsets.map((toolset) => (
            <div key={`measure-${toolset.key}`} className="label-measure-item">
              <LabelWrapper
                source="toolsets"
                toolset={{ type: 'regular', id: toolset.key, name: toolset.key }}
              />
            </div>
          ))}
        </div>
      </div>
    );
  },
);

LabelsDisplay.displayName = 'LabelsDisplay';

interface CopilotWorkflowPlanProps {
  data: WorkflowPlan;
}
export const CopilotWorkflowPlan = memo(({ data }: CopilotWorkflowPlanProps) => {
  console.log('data', data);
  const { tasks } = data || exampleData;
  const { variables } = data || exampleData;
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3 pt-4">
      <div className="flex flex-col gap-3 p-4 rounded-xl border-solid border-[1px] border-refly-Card-Border bg-refly-bg-canvas">
        <div className="flex items-center gap-1.5">
          <NodeIcon type="start" small />
          <div className="text-refly-text-caption font-medium leading-5 flex-1 truncate text-sm">
            {t('canvas.nodeTypes.startNode')}
          </div>
        </div>

        {variables?.length > 0 && (
          <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto">
            {variables?.map((variable: WorkflowVariable) => (
              <InputParameterRow
                key={variable.name}
                variableType={variable.variableType}
                label={variable.name}
                isRequired={variable.required}
                isSingle={variable.isSingle}
              />
            ))}
          </div>
        )}
      </div>

      {tasks?.map((task: any) => (
        <div
          className="flex flex-col gap-3 p-4 rounded-xl border-solid border-[1px] border-refly-Card-Border bg-refly-bg-canvas"
          key={task.id}
        >
          <div className="flex items-center gap-1.5">
            <NodeIcon type="skillResponse" small />
            <div className="text-refly-text-caption font-medium leading-5 flex-1 truncate text-sm">
              {task.title}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <NewConversation size={14} color="var(--refly-text-3)" />
            <Paragraph
              className="text-refly-text-2 flex-1 truncate text-xs leading-4 !m-0"
              ellipsis={{ rows: 1, tooltip: true }}
            >
              {task.prompt}
            </Paragraph>
          </div>
          <LabelsDisplay toolsets={task.selectedToolsets ?? []} />
        </div>
      ))}

      <Divider className="m-0 mt-1" />
    </div>
  );
});

CopilotWorkflowPlan.displayName = 'CopilotWorkflowPlan';
