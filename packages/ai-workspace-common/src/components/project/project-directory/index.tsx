import { useSiderStoreShallow } from '@refly-packages/ai-workspace-common/stores/sider';
import { Divider, Layout } from 'antd';
import { useState, useEffect, useCallback } from 'react';
import { useGetProjectDetail } from '@refly-packages/ai-workspace-common/queries';
import { Document, Resource } from '@refly/openapi-schema';
import { CanvasMenu } from '@refly-packages/ai-workspace-common/components/project/canvas-menu';
import { SourcesMenu } from '@refly-packages/ai-workspace-common/components/project/source-menu';
import { ProjectSettings } from '@refly-packages/ai-workspace-common/components/project/project-settings';
import cn from 'classnames';
import './index.scss';
import { useHandleSiderData } from '@refly-packages/ai-workspace-common/hooks/use-handle-sider-data';
import { useGetProjectCanvasId } from '@refly-packages/ai-workspace-common/hooks/use-get-project-canvasId';
import { useNavigate } from 'react-router-dom';
import { ProjectKnowledgeToggle } from '@refly-packages/ai-workspace-common/components/project/project-knowledge-toggle';
import { useProjectSelectorStoreShallow } from '@refly-packages/ai-workspace-common/stores/project-selector';
import {
  useCanvasStore,
  useCanvasStoreShallow,
} from '@refly-packages/ai-workspace-common/stores/canvas';

export const iconClassName =
  'w-3.5 h-3.5 flex-shrink-0 flex items-center justify-center hover:text-gray-700';

export type sourceObject =
  | ({
      entityType: 'document';
      entityId: string;
    } & Document)
  | ({
      entityType: 'resource';
      entityId: string;
    } & Resource);

interface ProjectDirectoryProps {
  projectId: string;
  source: 'sider' | 'popover';
}

export const ProjectDirectory = ({ projectId, source }: ProjectDirectoryProps) => {
  const {
    getCanvasList,
    updateCanvasList,
    isLoadingCanvas,
    sourceList,
    loadingSource,
    getSourceList,
  } = useHandleSiderData(true);
  const { canvasId } = useGetProjectCanvasId();
  const navigate = useNavigate();
  const { collapse, setCollapse, canvasList } = useSiderStoreShallow((state) => ({
    canvasList: state.canvasList,
    collapse: state.collapse,
    setCollapse: state.setCollapse,
  }));
  const { setShowReflyPilot } = useCanvasStoreShallow((state) => ({
    setShowReflyPilot: state.setShowReflyPilot,
  }));

  const { data: projectDetail } = useGetProjectDetail({ query: { projectId } }, null, {
    enabled: !!projectId,
  });
  const data = projectDetail?.data;
  const [projectData, setProjectData] = useState(data);

  // Update global store when project ID changes
  const { setSelectedProjectId } = useProjectSelectorStoreShallow((state) => ({
    setSelectedProjectId: state.setSelectedProjectId,
  }));

  // Internal project ID state - initialized from props
  const [internalProjectId, setInternalProjectId] = useState(projectId);

  const handleRemoveCanvases = useCallback(
    async (canvasIds: string[]) => {
      const newCanvasList = canvasList.filter((item) => !canvasIds.includes(item.id));
      updateCanvasList(newCanvasList);
      if (canvasIds.includes(canvasId)) {
        const newCanvasId = newCanvasList.length > 0 ? newCanvasList[0].id : 'empty';
        navigate(`/project/${projectId}?canvasId=${newCanvasId}`);
      }
    },
    [updateCanvasList, canvasId, canvasList, navigate, projectId],
  );

  const handleAddCanvases = useCallback(
    async (canvasIds: string[]) => {
      getCanvasList(true);
      if (canvasIds?.[0]) {
        navigate(`/project/${projectId}?canvasId=${canvasIds[0]}`);
      }
    },
    [getCanvasList, navigate, projectId],
  );

  useEffect(() => {
    setProjectData(data);
  }, [data]);

  useEffect(() => {
    getCanvasList(true);
    getSourceList();
  }, [projectId]);

  // Update internal state when prop changes
  useEffect(() => {
    if (projectId !== internalProjectId) {
      setInternalProjectId(projectId);
    }
  }, [projectId]);

  // Update global store when project ID changes
  useEffect(() => {
    if (internalProjectId) {
      setSelectedProjectId(internalProjectId);
    }
  }, [internalProjectId, setSelectedProjectId]);

  // Handle project change from knowledge toggle
  const handleProjectChange = useCallback(
    (newProjectId: string) => {
      if (newProjectId === internalProjectId) return;

      setInternalProjectId(newProjectId);
      navigate(`/project/${newProjectId}`);
    },
    [internalProjectId, navigate],
  );

  const handleSwitchChange = useCallback(
    (checked: boolean) => {
      const { config, showReflyPilot } = useCanvasStore.getState();
      const hasNodePreviews =
        config?.[canvasId]?.nodePreviews?.filter((item) => item?.type === 'skillResponse')?.length >
        0;

      if (checked) {
        if (!showReflyPilot && !hasNodePreviews) {
          setShowReflyPilot(true);
        }
      }
    },
    [canvasId],
  );

  return (
    <Layout.Sider
      width={source === 'sider' ? (collapse ? 0 : 220) : 220}
      className={cn(
        'border border-solid border-gray-100 bg-white shadow-sm relative',
        source === 'sider' ? 'h-[calc(100vh)]' : 'h-[calc(100vh-100px)] rounded-r-lg',
      )}
    >
      <div className="project-directory flex h-full flex-col py-3 pb-0 overflow-y-auto">
        <ProjectSettings
          source={source}
          setCollapse={setCollapse}
          data={projectData}
          onUpdate={(data) => {
            setProjectData({ ...projectData, ...data });
          }}
        />

        <Divider className="my-2" />

        <div className="flex-1 overflow-y-auto">
          <CanvasMenu
            isFetching={isLoadingCanvas}
            canvasList={canvasList}
            projectId={projectId}
            onAddCanvasesSuccess={handleAddCanvases}
            onRemoveCanvases={handleRemoveCanvases}
          />
          <SourcesMenu
            isFetching={loadingSource}
            sourceList={sourceList}
            projectId={projectId}
            documentCount={sourceList.filter((item) => item.entityType === 'document').length || 0}
            resourceCount={sourceList.filter((item) => item.entityType === 'resource').length || 0}
            onUpdatedItems={() => {
              getSourceList();
            }}
          />
        </div>

        {/* Combined Project Knowledge Base Toggle */}
        {internalProjectId ? (
          <ProjectKnowledgeToggle
            currentProjectId={internalProjectId}
            projectSelectorClassName="max-w-[80px]"
            enableSelectProject={false}
            className="px-3"
            enableProjectSelector={false}
            onProjectChange={handleProjectChange}
            onSwitchChange={handleSwitchChange}
          />
        ) : null}
      </div>
    </Layout.Sider>
  );
};
