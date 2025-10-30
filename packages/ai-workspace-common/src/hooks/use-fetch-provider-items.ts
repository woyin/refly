import { useListProviderItems } from '@refly-packages/ai-workspace-common/queries';
import { ListProviderItemsData } from '@refly-packages/ai-workspace-common/requests/types.gen';
import { useUserStoreShallow } from '@refly/stores';

export const useFetchProviderItems = (params: ListProviderItemsData['query']) => {
  const { isLogin, userProfile } = useUserStoreShallow((state) => ({
    isLogin: state.isLogin,
    userProfile: state.userProfile,
  }));

  const {
    data: providerItems,
    isLoading,
    refetch,
  } = useListProviderItems(
    {
      query: {
        isGlobal: userProfile?.preferences?.providerMode === 'global',
        ...params,
      },
    },
    undefined,
    {
      enabled: isLogin,
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      refetchOnReconnect: true,
    },
  );

  return {
    data: providerItems?.data ?? [],
    isLoading,
    refetch,
  };
};
