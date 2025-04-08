import { useState } from 'react';
import { message } from 'antd';
import * as Y from 'yjs';
import { useTranslation } from 'react-i18next';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useDebouncedCallback } from 'use-debounce';
import { useNavigate } from 'react-router-dom';
import { useHandleSiderData } from '@refly-packages/ai-workspace-common/hooks/use-handle-sider-data';
import { useCanvasStore } from '@refly-packages/ai-workspace-common/stores/canvas';
import { IndexeddbPersistence } from 'y-indexeddb';
import { useGetProjectCanvasId } from '@refly-packages/ai-workspace-common/hooks/use-get-project-canvasId';

export const useDeleteCanvas = () => {
  const [isRemoving, setIsRemoving] = useState(false);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { getCanvasList } = useHandleSiderData();
  const { projectId } = useGetProjectCanvasId();
  const deleteCanvas = async (canvasId: string, deleteAllFiles = false) => {
    if (isRemoving) return;
    let success = false;
    try {
      setIsRemoving(true);
      const { data } = await getClient().deleteCanvas({
        body: {
          canvasId,
          deleteAllFiles,
        },
      });

      if (data?.success) {
        success = true;
        message.success(t('canvas.action.deleteSuccess'));

        // Check and remove canvasId from localStorage if matches
        const { currentCanvasId, setCurrentCanvasId, deleteCanvasData } = useCanvasStore.getState();
        const latestCurrentCanvasId = currentCanvasId;
        if (currentCanvasId === canvasId) {
          setCurrentCanvasId(null);
        }

        deleteCanvasData(canvasId);

        // Clear IndexedDB persistence for the deleted canvas
        const indexedDbProvider = new IndexeddbPersistence(canvasId, new Y.Doc());
        await indexedDbProvider.clearData();
        await indexedDbProvider.destroy();

        // Get updated canvas list
        const updatedCanvasList = await getCanvasList();

        // Only navigate if we're currently on the deleted canvas
        if (latestCurrentCanvasId === canvasId) {
          // Find the first available canvas that's not the deleted one
          const remainingCanvas = updatedCanvasList?.find((canvas) => canvas.id !== canvasId);

          // Use setTimeout to ensure all state updates are processed
          setTimeout(() => {
            if (remainingCanvas?.id) {
              projectId
                ? navigate(`/project/${projectId}?canvasId=${remainingCanvas.id}`, {
                    replace: true,
                  })
                : navigate(`/canvas/${remainingCanvas.id}`, { replace: true });
            } else {
              projectId
                ? navigate(`/project/${projectId}`, { replace: true })
                : navigate('/canvas/empty', { replace: true });
            }
          }, 0);
        }
      }
    } finally {
      setIsRemoving(false);
    }
    return success;
  };

  const debouncedDeleteCanvas = useDebouncedCallback(
    (canvasId: string, deleteAllFiles = false) => {
      return deleteCanvas(canvasId, deleteAllFiles);
    },
    300,
    { leading: true },
  );

  return { deleteCanvas: debouncedDeleteCanvas, isRemoving };
};
