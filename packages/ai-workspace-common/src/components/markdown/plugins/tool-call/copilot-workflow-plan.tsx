import { memo } from 'react';
import { NodeIcon } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/node-icon';
import { ToolsetIcon } from '@refly-packages/ai-workspace-common/components/canvas/common/toolset-icon';

import { NewConversation } from 'refly-icons';

const exampleData = {
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
      selectedToolsets: [{ key: 'builtin', tools: ['generate_doc'] }],
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

interface CopilotWorkflowPlanProps {
  data: any;
}
export const CopilotWorkflowPlan = memo(({ data }: CopilotWorkflowPlanProps) => {
  console.log('data', data);
  const { tasks } = exampleData;

  return (
    <div className="flex flex-col gap-3 py-3">
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
            <NewConversation size={14} color="var(--refly-text-caption)" />
            <div className="text-refly-text-2 flex-1 truncate text-xs leading-4">{task.prompt}</div>
          </div>
          <div>
            {task.selectedToolsets?.map((toolset: any) => (
              <ToolsetIcon
                key={toolset.key}
                toolset={{ type: toolset.type, id: toolset.id, name: toolset.name }}
                isBuiltin={toolset.type === 'builtin'}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
});

CopilotWorkflowPlan.displayName = 'CopilotWorkflowPlan';
