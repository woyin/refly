import { useGetWorkflowVariables } from '@refly-packages/ai-workspace-common/queries';
import { useUserStoreShallow } from '@refly/stores';

export const useVariablesManagement = (canvasId: string) => {
  const isSharePage = location?.pathname?.startsWith('/share/') ?? false;
  const isLogin = useUserStoreShallow((state) => state.isLogin);

  const {
    data: workflowVariables,
    isLoading,
    refetch,
  } = useGetWorkflowVariables(
    {
      query: {
        canvasId,
      },
    },
    undefined,
    {
      enabled: !!canvasId && isLogin && !isSharePage,
    },
  );

  return {
    data: workflowVariables?.data ?? [],
    isLoading,
    refetch,
  };
};
