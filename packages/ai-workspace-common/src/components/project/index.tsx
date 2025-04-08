import { useNavigate, useSearchParams } from 'react-router-dom';
import { Canvas } from '../canvas';
import { NoCanvas } from './no-canvas';
import { useSiderStoreShallow } from '@refly-packages/ai-workspace-common/stores/sider';
import { useEffect } from 'react';

export const Project = ({ projectId }: { projectId: string }) => {
  const [searchParams] = useSearchParams();
  const canvasId = searchParams.get('canvasId');
  const navigate = useNavigate();

  const { canvasList = [] } = useSiderStoreShallow((state) => ({
    canvasList: state.canvasList ?? [],
    collapse: state.collapse,
    setCollapse: state.setCollapse,
  }));

  useEffect(() => {
    if (canvasId === 'empty' && canvasList.length > 0) {
      navigate(`/project/${projectId}?canvasId=${canvasList[0].id}`, { replace: true });
    }
  }, [canvasId, projectId, canvasList, navigate]);

  if (!canvasId || canvasId === 'empty') {
    return <NoCanvas projectId={projectId} />;
  }

  return <Canvas canvasId={canvasId} />;
};
