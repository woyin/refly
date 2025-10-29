import { memo, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CanvasNode } from '@refly/canvas-common';
import { PreviewComponent } from '@refly-packages/ai-workspace-common/components/canvas/node-preview';
import { Markdown } from '@refly-packages/ai-workspace-common/components/markdown';
import { Play } from 'refly-icons';

export interface SelectedResultsGridProps {
  selectedResults: string[];
  options: CanvasNode[];
}

// Individual result item preview component
const ResultItemPreview = memo(({ node }: { node: CanvasNode }) => {
  const { t } = useTranslation();
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isVideoHovered, setIsVideoHovered] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

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

  // For video nodes, show the video with cover crop and play button overlay
  if (node.type === 'video' && node.data?.metadata?.videoUrl) {
    const handleVideoClick = () => {
      if (videoRef.current) {
        if (isVideoPlaying) {
          videoRef.current.pause();
          setIsVideoPlaying(false);
        } else {
          videoRef.current.play();
          setIsVideoPlaying(true);
        }
      }
    };

    const handleVideoEnd = () => {
      setIsVideoPlaying(false);
    };

    return (
      <div
        className="w-full h-full relative overflow-hidden bg-black cursor-pointer"
        onClick={handleVideoClick}
        onMouseEnter={() => setIsVideoHovered(true)}
        onMouseLeave={() => setIsVideoHovered(false)}
      >
        <video
          ref={videoRef}
          src={node.data.metadata.videoUrl as string}
          className="w-full h-full object-cover"
          muted
          preload="metadata"
          onEnded={handleVideoEnd}
        />
        {/* Play button overlay - only show when not playing */}
        {!isVideoPlaying && (
          <div
            className={`absolute inset-0 flex items-center justify-center bg-black transition-opacity duration-200 ${
              isVideoHovered ? 'bg-opacity-20' : 'bg-opacity-30'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${
                isVideoHovered ? 'scale-110' : ''
              }`}
              style={{
                borderRadius: '80px',
                background: 'rgba(28, 31, 35, 0.60)',
              }}
            >
              <Play color="white" className="w-4 h-4 text-white ml-0.5" />
            </div>
          </div>
        )}
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
