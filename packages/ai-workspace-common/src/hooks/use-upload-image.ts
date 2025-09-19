import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { genImageID, genUniqueId } from '@refly/utils';
import { useMemo } from 'react';
import { nodeOperationsEmitter } from '@refly-packages/ai-workspace-common/events/nodeOperations';
import { CanvasNodeData, ImageNodeMeta } from '@refly/canvas-common';
import { useImageUploadStore, type UploadProgress } from '@refly/stores';

export const useUploadImage = () => {
  const { startUpload, updateProgress, setUploadSuccess, setUploadError } = useImageUploadStore();

  const uploadImage = async (image: File, canvasId: string, uploadId?: string) => {
    const response = await getClient().upload({
      body: {
        file: image,
        entityId: canvasId,
        entityType: 'canvas',
      },
    });

    // Update progress if uploadId is provided
    if (uploadId) {
      updateProgress(uploadId, 100);
    }

    return response?.data;
  };

  const handleUploadImage = async (imageFile: File, canvasId: string) => {
    const uploadFile: UploadProgress = {
      id: genUniqueId(),
      fileName: imageFile.name,
      progress: 0,
      status: 'uploading',
    };
    startUpload([uploadFile]);
    const uploadId = uploadFile?.id;

    try {
      const result = await uploadImage(imageFile, canvasId, uploadId);
      const { data, success } = result ?? {};

      if (success && data) {
        const nodeData = {
          title: imageFile.name,
          entityId: genImageID(),
          metadata: {
            imageUrl: data.url,
            storageKey: data.storageKey,
          } as ImageNodeMeta,
        };

        await new Promise<void>((resolve) => {
          const timeoutId = setTimeout(resolve, 1000);
          nodeOperationsEmitter.emit('addNode', {
            node: { type: 'image', data: nodeData },
            shouldPreview: false,
            needSetCenter: true,
            positionCallback: () => {
              clearTimeout(timeoutId);
              resolve();
            },
          });
        });

        // Mark upload as successful - only after node is successfully created
        if (uploadId) {
          setUploadSuccess(uploadId);
        }

        return nodeData;
      } else {
        // Mark upload as failed - uploadImage returned success: false or no data
        if (uploadId) {
          setUploadError(uploadId, 'Upload failed - no data received');
        }
        return null;
      }
    } catch (error) {
      // Mark upload as failed
      if (uploadId) {
        setUploadError(uploadId, error instanceof Error ? error.message : 'Upload failed');
      }
      return null;
    }
  };

  const handleUploadMultipleImages = async (
    imageFiles: File[],
    canvasId: string,
  ): Promise<CanvasNodeData<ImageNodeMeta>[]> => {
    // Start upload tracking for all files
    const uploadFiles: UploadProgress[] = imageFiles.map((file) => ({
      id: genUniqueId(),
      fileName: file.name,
      progress: 0,
      status: 'uploading',
    }));
    startUpload(uploadFiles);

    // Store the reference position for node placement
    let referencePosition: { x: number; y: number } | null = null;
    const nodesData = [];

    for (let i = 0; i < imageFiles.length; i++) {
      const imageFile = imageFiles[i];
      const uploadId = uploadFiles[i]?.id;

      try {
        const result = await uploadImage(imageFile, canvasId, uploadId);
        const { data, success } = result ?? {};

        if (success && data) {
          const nodeData: CanvasNodeData<ImageNodeMeta> = {
            title: imageFile.name ?? '',
            entityId: genImageID(),
            metadata: {
              imageUrl: data.url,
              storageKey: data.storageKey,
            },
          };

          await new Promise<void>((resolve) => {
            // Use the event emitter to add nodes with proper spacing
            nodeOperationsEmitter.emit('addNode', {
              node: {
                type: 'image',
                data: nodeData,
                position: referencePosition
                  ? {
                      x: referencePosition.x,
                      y: referencePosition.y + 150, // Add vertical spacing between nodes
                    }
                  : undefined,
              },
              shouldPreview: false,
              needSetCenter: i === imageFiles.length - 1,
              positionCallback: (newPosition) => {
                referencePosition = newPosition;
                resolve();
              },
            });

            // Add a timeout in case the callback doesn't fire
            setTimeout(() => resolve(), 100);
          });

          nodesData.push(nodeData);

          // Mark upload as successful - only after node is successfully created
          if (uploadId) {
            setUploadSuccess(uploadId);
          }
        } else {
          // Mark upload as failed - uploadImage returned success: false or no data
          if (uploadId) {
            setUploadError(uploadId, 'Upload failed - no data received');
          }
        }
      } catch (error) {
        // Mark upload as failed
        if (uploadId) {
          setUploadError(uploadId, error instanceof Error ? error.message : 'Upload failed');
        }
      }
    }

    return nodesData;
  };

  return useMemo(
    () => ({
      handleUploadImage,
      handleUploadMultipleImages,
    }),
    [],
  );
};
