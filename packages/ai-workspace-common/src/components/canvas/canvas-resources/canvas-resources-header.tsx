import { Breadcrumb } from 'antd';
export type CanvasResourcesParentType = 'step' | 'result' | 'myUpload';

interface CanvasResourcesHeaderProps {
  parentType: CanvasResourcesParentType | null;
}

export const CanvasResourcesHeader = ({ parentType }: CanvasResourcesHeaderProps) => {
  return (
    <div>
      <Breadcrumb>
        <Breadcrumb.Item>
          {parentType === 'step' ? 'Steps' : parentType === 'result' ? 'Results' : 'My Uploads'}
        </Breadcrumb.Item>
      </Breadcrumb>
    </div>
  );
};
