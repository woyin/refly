import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { CanvasNode } from '@refly/canvas-common';
import { PreviewComponent } from '@refly-packages/ai-workspace-common/components/canvas/node-preview';
import { Markdown } from '@refly-packages/ai-workspace-common/components/markdown';

export interface SelectedResultsGridProps {
  selectedResults: string[];
  options: CanvasNode[];
}

// Individual result item preview component
const ResultItemPreview = memo(({ node }: { node: CanvasNode }) => {
  const { t } = useTranslation();

  // For document nodes, show the contentPreview as markdown
  if (node.type === 'document' && node.data?.contentPreview) {
    return (
      <div className="w-full h-full overflow-hidden">
        <Markdown
          content={node.data.contentPreview}
          className="text-xs p-2 h-full overflow-hidden"
        />
      </div>
    );
  }

  // For image nodes, show the image directly with cover crop
  if (node.type === 'image' && node.data?.metadata?.imageUrl) {
    return (
      <div className="w-full h-full relative overflow-hidden">
        <img
          src={node.data.metadata.imageUrl as string}
          alt={node.data?.title || t('common.untitled')}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  // For other types, use the PreviewComponent
  return (
    <div className="w-full h-full">
      <PreviewComponent node={node} purePreview={true} />
    </div>
  );
});

ResultItemPreview.displayName = 'ResultItemPreview';

// Grid component to display selected results in a card layout
export const SelectedResultsGrid = memo(
  ({ selectedResults, options }: SelectedResultsGridProps) => {
    const { t } = useTranslation();

    // Filter options to only show selected ones
    const selectedNodes = options.filter((node) => selectedResults.includes(node.id));

    if (selectedNodes.length === 0) {
      return (
        <div className="w-full h-full flex items-center justify-center text-refly-text-2 text-sm">
          {t('workflowApp.noResultsSelected')}
        </div>
      );
    }

    return (
      <div className="w-full h-full overflow-y-auto">
        <div className="grid grid-cols-3 gap-3 cursor-pointer">
          {selectedNodes.map((node) => (
            <div
              key={node.id}
              className="relative cursor-pointer overflow-hidden bg-white border border-refly-Card-Border rounded-lg"
              style={{
                height: '77px',
                borderRadius: '8px',
              }}
            >
              <ResultItemPreview node={node} />
            </div>
          ))}
        </div>
      </div>
    );
  },
);

SelectedResultsGrid.displayName = 'SelectedResultsGrid';
