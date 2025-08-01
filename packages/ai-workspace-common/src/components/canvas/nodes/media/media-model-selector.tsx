import { memo, useCallback, useMemo, useState } from 'react';
import { Button, Dropdown, DropdownProps, Skeleton } from 'antd';
import { useTranslation } from 'react-i18next';
import { ModelIcon } from '@lobehub/icons';
import { getPopupContainer } from '@refly-packages/ai-workspace-common/utils/ui';
import { ProviderItem } from '@refly/openapi-schema';
import { LuInfo } from 'react-icons/lu';
import { SettingsModalActiveTab, useSiderStoreShallow } from '@refly/stores';
import { SettingsButton } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-actions/model-selector';
import { useChatStoreShallow } from '@refly/stores';
import { ArrowDown } from 'refly-icons';
import cn from 'classnames';
import './index.scss';

interface MediaModelSelectorProps {
  maxWidth?: number;
  model: ProviderItem | null;
  setModel: (model: ProviderItem | null) => void;
  readonly?: boolean;
  placement?: DropdownProps['placement'];
  trigger?: DropdownProps['trigger'];
  defaultModel?: ProviderItem | null;
  mediaModelList?: ProviderItem[];
  loading?: boolean;
}

// Memoize the selected model display
const SelectedMediaModelDisplay = memo(
  ({
    maxWidth,
    open,
    model,
    handleOpenSettingModal,
  }: {
    maxWidth?: number;
    open: boolean;
    model: ProviderItem | null;
    handleOpenSettingModal: () => void;
  }) => {
    const { t } = useTranslation();

    if (!model) {
      return (
        <Button
          type="text"
          size="small"
          className={cn(
            'text-sm gap-1.5 p-1 hover:border-refly-Card-Border',
            open && 'border-refly-Card-Border',
          )}
          style={{ color: '#f59e0b' }}
          icon={<LuInfo className="flex items-center" />}
          onClick={handleOpenSettingModal}
        >
          <div className={`${maxWidth ? `max-w-[${maxWidth}px]` : ''} truncate`}>
            {t('copilot.modelSelector.configureModel')}
          </div>
        </Button>
      );
    }

    return (
      <Button
        type="text"
        size="small"
        className={cn(
          'h-7 text-sm gap-1.5 p-1 hover:border-refly-Card-Border min-w-0',
          open && 'border-refly-Card-Border',
        )}
      >
        <ModelIcon className="flex items-center" model={model.name} size={16} type={'color'} />
        <div className={`${maxWidth ? `max-w-[${maxWidth}px]` : ''} truncate`}>{model.name}</div>
        <ArrowDown size={12} color="var(--refly-text-0)" className="flex-shrink-0" />
      </Button>
    );
  },
);

SelectedMediaModelDisplay.displayName = 'SelectedMediaModelDisplay';

const MediaModelLabel = memo(({ model }: { model: ProviderItem }) => {
  return (
    <span className="text-xs flex items-center gap-1 text-refly-text-0 min-w-0 flex-1">
      <span className="truncate">{model.name}</span>
    </span>
  );
});

MediaModelLabel.displayName = 'MediaModelLabel';

// Helper function to get media type from model capabilities
const getMediaTypeFromCapabilities = (model: ProviderItem): string => {
  const config = model.config as any;
  if (!config?.capabilities) return 'image';

  if (config.capabilities.image) return 'image';
  if (config.capabilities.video) return 'video';
  if (config.capabilities.audio) return 'audio';

  return 'image'; // Default fallback
};

// Helper function to get media type label
const getMediaTypeLabel = (mediaType: string, t: any): string => {
  switch (mediaType) {
    case 'image':
      return t('canvas.nodes.mediaSkill.image', 'Image');
    case 'video':
      return t('canvas.nodes.mediaSkill.video', 'Video');
    case 'audio':
      return t('canvas.nodes.mediaSkill.audio', 'Audio');
    default:
      return t('canvas.nodes.mediaSkill.image', 'Image');
  }
};

export const MediaModelSelector = memo(
  ({
    maxWidth,
    placement = 'bottomLeft',
    trigger = ['click'],
    setModel,
    readonly = false,
    model,
    mediaModelList,
    loading,
  }: MediaModelSelectorProps) => {
    const { t } = useTranslation();
    const [dropdownOpen, setDropdownOpen] = useState(false);

    const { setShowSettingModal, setSettingsModalActiveTab } = useSiderStoreShallow((state) => ({
      setShowSettingModal: state.setShowSettingModal,
      setSettingsModalActiveTab: state.setSettingsModalActiveTab,
    }));

    const { setMediaSelectedModel } = useChatStoreShallow((state) => ({
      setMediaSelectedModel: state.setMediaSelectedModel,
    }));

    const handleOpenSettingModal = useCallback(() => {
      setShowSettingModal(true);
      setSettingsModalActiveTab(SettingsModalActiveTab.ModelConfig);
    }, [setShowSettingModal, setSettingsModalActiveTab]);

    // Group models by media type based on capabilities
    const groupedModels = useMemo(() => {
      if (!mediaModelList?.length) return [];

      const groups: { [key: string]: ProviderItem[] } = {
        image: [],
        video: [],
        audio: [],
      };

      for (const model of mediaModelList) {
        if (model.enabled) {
          const mediaType = getMediaTypeFromCapabilities(model);
          groups[mediaType].push(model);
        }
      }

      return Object.entries(groups)
        .filter(([_, models]) => models.length > 0)
        .map(([mediaType, models]) => ({
          mediaType,
          label: getMediaTypeLabel(mediaType, t),
          models,
        }));
    }, [mediaModelList, t]);

    const handleMenuClick = useCallback(
      ({ key }: { key: string }) => {
        const selectedModel = mediaModelList?.find((model) => model.itemId === key);
        if (selectedModel) {
          setModel(selectedModel);
          setMediaSelectedModel(selectedModel);
          setDropdownOpen(false);
        }
      },
      [mediaModelList, setModel, setMediaSelectedModel, setDropdownOpen],
    );

    // Custom dropdown overlay component
    const dropdownOverlay = useMemo(
      () => (
        <div className="w-[240px] bg-refly-bg-content-z2 rounded-xl border border-solid border-refly-Card-Border">
          <div className="max-h-[48vh] w-full overflow-y-auto p-2">
            {groupedModels.map((group) => (
              <div key={group.mediaType}>
                {/* Group header */}
                <div className="font-semibold text-refly-text-1 w-full truncate px-1.5 pb-1 pt-2">
                  {group.label}
                </div>
                {/* Group models */}
                {group.models
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((model) => (
                    <div
                      key={model.itemId}
                      className="flex items-center gap-1.5 rounded-[6px] p-2 hover:bg-refly-tertiary-hover cursor-pointer min-w-0"
                      onClick={() => handleMenuClick({ key: model.itemId })}
                    >
                      <div className="flex-shrink-0 flex items-center">
                        <ModelIcon model={model.name} size={16} type={'color'} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <MediaModelLabel model={model} />
                      </div>
                    </div>
                  ))}
              </div>
            ))}
          </div>
          <SettingsButton
            handleOpenSettingModal={handleOpenSettingModal}
            setDropdownOpen={setDropdownOpen}
          />
        </div>
      ),
      [groupedModels, handleMenuClick, handleOpenSettingModal, setDropdownOpen],
    );

    if (loading) {
      return <Skeleton className="w-28" active paragraph={false} />;
    } else if (!mediaModelList?.length) {
      return (
        <Button
          onClick={handleOpenSettingModal}
          type="text"
          size="small"
          className="text-xs gap-1.5"
          style={{ color: '#f59e0b' }}
          icon={<LuInfo className="flex items-center" />}
        >
          {t('copilot.modelSelector.configureModel')}
        </Button>
      );
    }

    return (
      <Dropdown
        popupRender={() => dropdownOverlay}
        placement={placement}
        trigger={trigger}
        open={dropdownOpen}
        onOpenChange={setDropdownOpen}
        getPopupContainer={getPopupContainer}
        overlayClassName="media-model-selector-overlay"
        autoAdjustOverflow={true}
        disabled={readonly}
      >
        <span className="text-xs flex items-center gap-1.5 cursor-pointer transition-all duration-300">
          <SelectedMediaModelDisplay
            maxWidth={maxWidth}
            open={dropdownOpen}
            model={model}
            handleOpenSettingModal={handleOpenSettingModal}
          />
        </span>
      </Dropdown>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.placement === nextProps.placement &&
      prevProps.readonly === nextProps.readonly &&
      prevProps.model === nextProps.model &&
      prevProps.defaultModel === nextProps.defaultModel &&
      JSON.stringify(prevProps.trigger) === JSON.stringify(nextProps.trigger) &&
      JSON.stringify(prevProps.mediaModelList) === JSON.stringify(nextProps.mediaModelList)
    );
  },
);

MediaModelSelector.displayName = 'MediaModelSelector';
