import { useUserStoreShallow } from '@refly/stores';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useListResources } from '@refly-packages/ai-workspace-common/queries/queries';
import { useGetProjectCanvasId } from './use-get-project-canvasId';

export const useFetchResources = () => {
  const { canvasId, shareData, shareLoading } = useCanvasContext();
  const { projectId } = useGetProjectCanvasId();
  const isLogin = useUserStoreShallow((state) => state.isLogin);

  const fetchRemoteEnabled = isLogin && !shareData;
  const {
    data: resourcesData,
    isLoading: isLoadingResources,
    refetch,
  } = useListResources(
    {
      query: {
        canvasId,
        projectId,
      },
    },
    [],
    { enabled: fetchRemoteEnabled },
  );

  return {
    data: shareData?.resources ?? resourcesData?.data ?? [],
    refetch: fetchRemoteEnabled ? refetch : () => {},
    isLoading: shareLoading || isLoadingResources,
  };
};
