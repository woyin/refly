import { useMemo } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useActionResultStoreShallow } from '@refly/stores';

export const useSkillResponseLoadingStatus = (_canvasId: string) => {
  const { getNodes } = useReactFlow();

  // 只订阅 streamResults，避免不必要的重渲染
  const { streamResults } = useActionResultStoreShallow((state) => ({
    streamResults: state.streamResults,
  }));

  const nodes = getNodes();
  const skillResponseNodes = useMemo(
    () => nodes.filter((node) => node.type === 'skillResponse'),
    [nodes],
  );

  const loadingStatus = useMemo(() => {
    if (skillResponseNodes.length === 0) {
      return {
        isLoading: false,
        loadingCount: 0,
        totalCount: 0,
      };
    }

    let loadingCount = 0;

    for (const node of skillResponseNodes) {
      const entityId = node.data?.entityId;
      const metadata = node.data?.metadata as any;
      const status = metadata?.status;

      const isStreaming = !!streamResults[entityId as string];
      const isWaiting = status === 'waiting';
      const isExecuting = status === 'executing';

      if (isWaiting || isExecuting || isStreaming) {
        loadingCount++;
      }
    }

    return {
      isLoading: loadingCount > 0,
      loadingCount,
      totalCount: skillResponseNodes.length,
    };
  }, [getNodes, streamResults, skillResponseNodes]);

  return { ...loadingStatus, skillResponseNodes, nodes };
};
