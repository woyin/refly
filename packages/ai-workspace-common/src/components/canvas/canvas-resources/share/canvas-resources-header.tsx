import { memo, useCallback, useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Tooltip, Typography, Input, InputRef } from 'antd';
import { Add, ScreenFull, ScreenDefault, SideRight } from 'refly-icons';
import {
  useActiveNode,
  useCanvasResourcesPanelStoreShallow,
  useImportResourceStoreShallow,
} from '@refly/stores';
import { TopButtons } from './top-buttons';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import cn from 'classnames';
import { useUpdateNodeTitle } from '@refly-packages/ai-workspace-common/hooks/use-update-node-title';
import { CanvasNodeType } from '@refly/openapi-schema';

const { Text } = Typography;

export const CanvasResourcesHeader = memo(() => {
  const { t } = useTranslation();
  const { canvasId } = useCanvasContext();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitle, setEditingTitle] = useState('');
  const titleInputRef = useRef<InputRef>(null);

  const {
    parentType,
    setParentType,
    sidePanelVisible,
    wideScreenVisible,
    setSidePanelVisible,
    setWideScreenVisible,
    setActiveTab,
    setShowLeftOverview,
  } = useCanvasResourcesPanelStoreShallow((state) => ({
    setShowLeftOverview: state.setShowLeftOverview,
    parentType: state.parentType,
    sidePanelVisible: state.sidePanelVisible,
    wideScreenVisible: state.wideScreenVisible,
    setParentType: state.setParentType,
    setSidePanelVisible: state.setSidePanelVisible,
    setWideScreenVisible: state.setWideScreenVisible,
    setActiveTab: state.setActiveTab,
  }));
  const { activeNode, setActiveNode } = useActiveNode(canvasId);
  const { setImportResourceModalVisible } = useImportResourceStoreShallow((state) => ({
    setImportResourceModalVisible: state.setImportResourceModalVisible,
  }));
  const updateNodeTitle = useUpdateNodeTitle();

  // Update editing title when activeNode changes
  useEffect(() => {
    if (activeNode?.data?.title) {
      setEditingTitle(activeNode.data.title);
    }
  }, [activeNode?.data?.title]);

  const handleClose = useCallback(() => {
    setSidePanelVisible(false);
    setShowLeftOverview(false);
    setWideScreenVisible(false);
  }, [setSidePanelVisible, setShowLeftOverview, setWideScreenVisible]);

  const handleShowLeftOverview = useCallback(() => {
    if (sidePanelVisible && !wideScreenVisible) {
      setShowLeftOverview(true);
    }
  }, [sidePanelVisible, wideScreenVisible, setShowLeftOverview]);

  const handleParentClick = useCallback(() => {
    if (sidePanelVisible) {
      setActiveTab(parentType);
      setParentType(null);
      setActiveNode(null);
      setShowLeftOverview(false);
    }
  }, [
    setParentType,
    setActiveNode,
    setActiveTab,
    setShowLeftOverview,
    parentType,
    sidePanelVisible,
  ]);

  const handleAddResource = useCallback(() => {
    setImportResourceModalVisible(true);
  }, [setImportResourceModalVisible]);

  const handleWideScreen = useCallback(() => {
    setShowLeftOverview(false);
    setWideScreenVisible(true);
  }, [setShowLeftOverview, setWideScreenVisible]);

  const handleExitWideScreen = useCallback(() => {
    setWideScreenVisible(false);
  }, [setWideScreenVisible]);

  // Handle title click to start editing
  const handleTitleClick = useCallback(() => {
    if (!activeNode?.data?.entityId || !activeNode?.type) return;

    setIsEditingTitle(true);
    setEditingTitle(activeNode.data.title || '');

    // Focus the input after a short delay to ensure DOM is ready
    setTimeout(() => {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }, 100);
  }, [activeNode?.data?.entityId, activeNode?.type, activeNode?.data?.title]);

  // Handle title save
  const handleTitleSave = useCallback(() => {
    if (!activeNode?.data?.entityId || !activeNode?.type) return;

    const newTitle = editingTitle.trim();
    if (newTitle && newTitle !== activeNode.data.title) {
      updateNodeTitle(
        newTitle,
        activeNode.data.entityId,
        activeNode.id,
        activeNode.type as CanvasNodeType,
      );
    }

    setIsEditingTitle(false);
  }, [activeNode, editingTitle, setActiveNode, updateNodeTitle]);

  // Handle title cancel
  const handleTitleCancel = useCallback(() => {
    setIsEditingTitle(false);
    setEditingTitle(activeNode?.data?.title || '');
  }, [activeNode?.data?.title]);

  // Handle key press in title input
  const handleTitleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleTitleSave();
      } else if (e.key === 'Escape') {
        handleTitleCancel();
      }
    },
    [handleTitleSave, handleTitleCancel],
  );

  return (
    <div className="w-full h-[65px] flex gap-2 items-center justify-between p-3 border-solid border-refly-Card-Border border-[1px] border-x-0 border-t-0">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {sidePanelVisible && (
          <Tooltip title={t('canvas.toolbar.closeResourcesPanel')} arrow={false}>
            <Button type="text" icon={<SideRight size={16} />} onClick={handleClose} />
          </Tooltip>
        )}

        {parentType ? (
          <div className="min-w-0 flex-1 flex items-center gap-2">
            <Button
              type="text"
              size="small"
              onClick={handleParentClick}
              className={cn(wideScreenVisible ? 'pointer-events-none' : '', 'px-0.5')}
            >
              <a
                className="whitespace-nowrap text-refly-text-1 hover:refly-tertiary-hover hover:text-refly-text-1"
                onMouseEnter={handleShowLeftOverview}
              >
                {t(`canvas.resourceLibrary.${parentType}`)}
              </a>
            </Button>
            <div className="text-refly-text-2">/</div>
            {isEditingTitle ? (
              <Input
                ref={titleInputRef}
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={handleTitleKeyPress}
                className="min-w-0 flex-1 !max-w-[400px]"
                size="small"
                autoFocus
              />
            ) : (
              <Text
                ellipsis={{ tooltip: true }}
                className="min-w-0 flex-1 !max-w-[400px] leading-5 cursor-pointer hover:text-refly-primary hover:bg-refly-tertiary-hover rounded-lg px-1 py-0.5"
                onClick={handleTitleClick}
              >
                {activeNode?.data?.title || t('common.untitled')}
              </Text>
            )}
          </div>
        ) : (
          <div className="text-refly-text-0 text-base font-semibold leading-[26px] min-w-0 flex-1">
            {t('canvas.resourceLibrary.title')}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        {!parentType && (
          <Tooltip title={t('canvas.toolbar.addResource')} arrow={false}>
            <Button size="small" type="text" icon={<Add size={16} />} onClick={handleAddResource} />
          </Tooltip>
        )}

        <TopButtons />

        {parentType && (
          <Tooltip title={t('canvas.toolbar.addResource')} arrow={false}>
            <Button size="small" type="text" icon={<Add size={16} />} onClick={handleAddResource} />
          </Tooltip>
        )}

        {activeNode && (
          <Tooltip
            title={t(
              `canvas.resourceLibrary.${wideScreenVisible ? 'exitWideScreen' : 'wideScreen'}`,
            )}
            arrow={false}
          >
            <Button
              className="!h-5 !w-5 p-0"
              size="small"
              type="text"
              icon={wideScreenVisible ? <ScreenDefault size={16} /> : <ScreenFull size={16} />}
              onClick={wideScreenVisible ? handleExitWideScreen : handleWideScreen}
            />
          </Tooltip>
        )}
      </div>
    </div>
  );
});

CanvasResourcesHeader.displayName = 'CanvasResourcesHeader';
