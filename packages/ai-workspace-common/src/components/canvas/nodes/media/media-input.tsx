import React, { memo, useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { Input, Button, Dropdown } from 'antd';
import { SendOutlined, DownOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import {
  IconImage,
  IconVideo,
  IconAudio,
} from '@refly-packages/ai-workspace-common/components/common/icon';
import {
  MediaType,
  nodeOperationsEmitter,
} from '@refly-packages/ai-workspace-common/events/nodeOperations';
import { cn } from '@refly/utils/cn';
import { useGetProjectCanvasId } from '@refly-packages/ai-workspace-common/hooks/use-get-project-canvasId';
import { useCreateCanvas } from '@refly-packages/ai-workspace-common/hooks/canvas/use-create-canvas';
import { ChatModeSelector } from '@refly-packages/ai-workspace-common/components/canvas/front-page/chat-mode-selector';
import { useChatStoreShallow } from '@refly-packages/ai-workspace-common/stores/chat';
import { useFrontPageStoreShallow } from '@refly-packages/ai-workspace-common/stores/front-page';

const modelsByType = {
  image: [
    'black-forest-labs/flux-schnell',
    'black-forest-labs/flux-dev',
    'black-forest-labs/flux-pro',
  ],
  video: [
    'bytedance/seedance-1-pro',
    'bytedance/seedance-1-lite',
    'minimax/video-01',
    'kwaivgi/kling-v2.1',
    'google/veo-3',
    'luma/ray-flash-2-540p',
  ],
  audio: ['resemble-ai/chatterbox', 'google/lyria-2'],
};

const { TextArea } = Input;

interface MediaChatInputProps {
  showChatModeSelector?: boolean;
  readonly: boolean;
  query: string;
  setQuery: (value: string) => void;
  mediaType: MediaType;
  setMediaType: (type: MediaType) => void;
  nodeId?: string;
  onSend?: () => void;
  model?: string;
}

const MediaChatInput = memo(
  ({
    readonly,
    query,
    setQuery,
    mediaType,
    setMediaType,
    nodeId,
    onSend,
    showChatModeSelector,
    model,
  }: MediaChatInputProps) => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [selectedModel, setSelectedModel] = useState<string>(model || '');
    const useDefaultModel = useRef(!!selectedModel);
    const { projectId, isCanvasOpen } = useGetProjectCanvasId();
    const { debouncedCreateCanvas } = useCreateCanvas({
      projectId,
      afterCreateSuccess: () => {
        // Canvas creation is handled by the hook itself
      },
    });

    const { chatMode, setChatMode } = useChatStoreShallow((state) => ({
      chatMode: state.chatMode,
      setChatMode: state.setChatMode,
    }));
    const { setMediaQueryData } = useFrontPageStoreShallow((state) => ({
      setMediaQueryData: state.setMediaQueryData,
    }));

    const mediaOptions = useMemo(() => {
      return [
        {
          value: 'image',
          label: t('canvas.nodes.mediaSkill.image', 'Image'),
          icon: IconImage,
        },
        {
          value: 'video',
          label: t('canvas.nodes.mediaSkill.video', 'Video'),
          icon: IconVideo,
        },
        {
          value: 'audio',
          label: t('canvas.nodes.mediaSkill.audio', 'Audio'),
          icon: IconAudio,
        },
      ];
    }, [t]);

    const availableModels = useMemo(() => {
      return modelsByType[mediaType] || [];
    }, [mediaType]);

    // Set default model when mediaType changes
    useEffect(() => {
      if (useDefaultModel.current) {
        useDefaultModel.current = false;
        return;
      }
      console.log('availableModels', availableModels, availableModels.includes(selectedModel));
      if (availableModels.length > 0 && !availableModels.includes(selectedModel)) {
        setSelectedModel(availableModels[0]);
      }
    }, [availableModels, selectedModel]);

    const modelDropdownItems = useMemo(() => {
      return availableModels.map((model) => ({
        key: model,
        label: (
          <div className="flex items-center">
            <span className="text-sm">{model}</span>
          </div>
        ),
        onClick: () => setSelectedModel(model),
      }));
    }, [availableModels]);

    const dropdownItems = useMemo(() => {
      return mediaOptions.map((option) => ({
        key: option.value,
        label: (
          <div className="flex items-center gap-2">
            <option.icon className="w-4 h-4" />
            <span className="text-sm">{option.label}</span>
          </div>
        ),
        onClick: () => {
          setMediaType(option.value as MediaType);
        },
      }));
    }, [mediaOptions, setMediaType]);

    const currentMediaOption = useMemo(() => {
      return mediaOptions.find((option) => option.value === mediaType);
    }, [mediaOptions, mediaType]);

    const getPlaceholder = useCallback(() => {
      switch (mediaType) {
        case 'image':
          return t(
            'canvas.nodes.mediaSkill.imagePlaceholder',
            'Describe the image you want to generate...',
          );
        case 'video':
          return t(
            'canvas.nodes.mediaSkill.videoPlaceholder',
            'Describe the video you want to generate...',
          );
        case 'audio':
          return t(
            'canvas.nodes.mediaSkill.audioPlaceholder',
            'Describe the audio you want to generate...',
          );
        default:
          return t(
            'canvas.nodes.mediaSkill.defaultPlaceholder',
            'Describe what you want to generate...',
          );
      }
    }, [mediaType, t]);

    const handleGenerateMedia = useCallback(
      async (mediaType: MediaType, query: string) => {
        if (loading) return;
        setLoading(true);

        try {
          // Check if there's no canvas open
          if (!isCanvasOpen) {
            // Create a new canvas first
            const mediaQueryData = { mediaType, query, model: selectedModel };
            setMediaQueryData(mediaQueryData);
            debouncedCreateCanvas('front-page', { isMediaGeneration: true });
          } else {
            nodeOperationsEmitter.emit('generateMedia', {
              mediaType,
              query,
              model: selectedModel,
              nodeId: nodeId || '',
            });
          }
        } catch (error) {
          console.error('Failed to emit generateMedia event', error);
        } finally {
          setLoading(false);
        }
      },
      [loading, selectedModel, nodeId, isCanvasOpen, debouncedCreateCanvas],
    );

    const handleSend = useCallback(() => {
      if (!query?.trim()) return;

      handleGenerateMedia(mediaType, query);

      // Call optional onSend callback
      onSend?.();
    }, [query, mediaType, handleGenerateMedia, onSend]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (readonly) {
          e.preventDefault();
          return;
        }

        // Handle Enter key
        if (e.key === 'Enter') {
          // Shift + Enter creates a new line
          if (e.shiftKey) {
            return;
          }

          // Ctrl/Meta + Enter or plain Enter sends message
          if (e.ctrlKey || e.metaKey || !e.shiftKey) {
            e.preventDefault();
            handleSend();
          }
        }
      },
      [readonly, handleSend],
    );

    return (
      <div>
        <TextArea
          style={{ paddingLeft: 0, paddingRight: 0, height: '100%' }}
          className={cn(
            'flex-1 flex-shrink-0 !m-0 bg-transparent outline-none box-border border-none focus:outline-none focus:shadow-none focus:border-none focus:ring-0',
            readonly && 'cursor-not-allowed !text-black !bg-transparent',
            'dark:hover:bg-transparent dark:hover:!bg-none dark:focus:bg-transparent dark:active:bg-transparent dark:bg-transparent dark:!bg-transparent',
          )}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={getPlaceholder()}
          disabled={readonly}
          autoSize={{ minRows: 2, maxRows: 6 }}
          onKeyDown={handleKeyDown}
        />

        {!readonly && (
          <div className="flex justify-between items-center gap-2 mt-2">
            <div className="flex items-center gap-2">
              {/* Chat Mode Selector */}
              {showChatModeSelector && (
                <ChatModeSelector chatMode={chatMode} setChatMode={setChatMode} />
              )}

              {/* Model Selector */}
              <Dropdown
                trigger={['click']}
                menu={{ items: modelDropdownItems }}
                disabled={readonly || availableModels.length === 0}
                placement="bottomLeft"
              >
                <Button size="small" className="flex items-center gap-1 border-none shadow-none">
                  <span className="text-xs">{selectedModel || 'Select Model'}</span>
                  <DownOutlined className="w-3 h-3" />
                </Button>
              </Dropdown>
            </div>

            <div className="flex items-center gap-2">
              <Dropdown
                trigger={['click']}
                menu={{ items: dropdownItems }}
                disabled={readonly}
                placement="bottomRight"
              >
                <Button size="small" className="flex items-center gap-1">
                  {currentMediaOption && <currentMediaOption.icon className="w-4 h-4" />}
                  <span className="text-xs">{currentMediaOption?.label}</span>
                  <DownOutlined className="w-3 h-3" />
                </Button>
              </Dropdown>

              <Button
                className="text-xs"
                size="small"
                type="primary"
                icon={<SendOutlined />}
                onClick={handleSend}
                disabled={loading || !query?.trim()}
                loading={loading}
              >
                {loading ? t('common.generating', 'Generating...') : t('common.send', 'Send')}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  },
);

MediaChatInput.displayName = 'MediaChatInput';

export { MediaChatInput };
