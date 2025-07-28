import { useParams } from 'react-router-dom';
import { Canvas } from '@refly-packages/ai-workspace-common/components/canvas';

const ShareCanvasPage = () => {
  const { canvasId = '' } = useParams();

  return <Canvas canvasId={canvasId} readonly />;
};

export default ShareCanvasPage;
