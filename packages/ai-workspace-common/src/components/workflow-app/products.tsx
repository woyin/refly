import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';
import { EndMessage } from '@refly-packages/ai-workspace-common/components/workspace/scroll-loading';

import { WorkflowNodeExecution } from '@refly/openapi-schema';
import { Empty } from 'antd';
import { NodeRenderer } from '@refly-packages/ai-workspace-common/components/slideshow/components/NodeRenderer';
import { type NodeRelation } from '@refly-packages/ai-workspace-common/components/slideshow/components/ArtifactRenderer';

export const WorkflowAppProducts = ({ products }: { products: WorkflowNodeExecution[] }) => {
  const { t } = useTranslation();

  // Transform WorkflowNodeExecution to NodeRelation for NodeRenderer
  const transformWorkflowNodeToNodeRelation = (
    product: WorkflowNodeExecution,
    index: number,
  ): NodeRelation => {
    return {
      relationId: product.nodeExecutionId || `workflow-${product.nodeId}-${index}`,
      pageId: undefined, // Optional field
      nodeId: product.nodeId,
      nodeType: product.nodeType || 'unknown',
      entityId: product.entityId || '',
      orderIndex: index,
      nodeData: {
        title: product.title,
        content: undefined, // Will be fetched by renderer if needed
        metadata: {
          status: product.status,
          progress: product.progress,
          createdAt: product.createdAt,
          updatedAt: product.updatedAt,
        },
        entityId: product.entityId, // Ensure entityId is also in nodeData
      },
    };
  };

  // Transform products to NodeRelation array with memoization
  const transformedNodes = useMemo(() => {
    return (
      products?.map((product, index) => transformWorkflowNodeToNodeRelation(product, index)) || []
    );
  }, [products]);

  return (
    <div className="w-full h-full flex flex-col gap-2">
      {products?.length === 0 ? (
        <div className="w-full h-full flex items-center justify-center">
          <Empty description={t('workflowApp.emptyLogs')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </div>
      ) : (
        <>
          {transformedNodes?.map((node, index) => (
            <div
              key={node.relationId || `content-${index}`}
              id={`content-block-${index}`}
              className={`transition-all duration-300 h-[400px] rounded-lg bg-white dark:bg-gray-900 ${'shadow-refly-m hover:shadow-lg dark:hover:shadow-gray-600'}`}
            >
              <NodeRenderer
                node={node}
                key={node.relationId}
                isFocused={true} // Allow interaction with the content
              />
            </div>
          ))}

          <EndMessage />
        </>
      )}
    </div>
  );
};
