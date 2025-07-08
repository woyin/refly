import { useEffect } from 'react';

import { useChatStoreShallow } from '@refly-packages/ai-workspace-common/stores/chat';
import { useListProviderItems } from '@refly-packages/ai-workspace-common/queries';
import { useUserStoreShallow } from '@refly-packages/ai-workspace-common/stores/user';

export const useGetMediaModel = () => {
  const { setMediaModelList, setMediaModelListLoading } = useChatStoreShallow((state) => ({
    setMediaModelList: state.setMediaModelList,
    setMediaModelListLoading: state.setMediaModelListLoading,
  }));
  const { isLogin } = useUserStoreShallow((state) => ({
    isLogin: state.isLogin,
  }));
  const { data, isLoading } = useListProviderItems(
    {
      query: {
        category: 'mediaGeneration',
      },
    },
    null,
    {
      enabled: isLogin,
    },
  );

  useEffect(() => {
    if (data?.data) {
      setMediaModelList(
        data.data.map((item) => ({
          ...item,
          config: {
            ...item.config,
            capabilities: {
              image: item.group === '图片',
              video: item.group === '视频',
              audio: item.group === '音频',
            },
          },
        })),
      );
    }
  }, [data?.data, setMediaModelList]);

  useEffect(() => {
    setMediaModelListLoading(isLoading);
  }, [isLoading, setMediaModelListLoading]);
};
