import { memo, useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CanvasNode } from '@refly/canvas-common';
import { PreviewComponent } from '@refly-packages/ai-workspace-common/components/canvas/node-preview';
import { Markdown } from '@refly-packages/ai-workspace-common/components/markdown';
import { Play } from 'refly-icons';
import AudioBgSvg from './audioBg.svg';

export interface SelectedResultsGridProps {
  selectedResults: string[];
  options: CanvasNode[];
  bordered?: boolean;
}

// Document preview component
const DocumentPreview = memo(({ node }: { node: CanvasNode }) => {
  return (
    <div className="w-full h-full overflow-hidden">
      <Markdown
        content={node.data?.contentPreview || ''}
        className="text-xs p-2 h-full overflow-hidden text-refly-text-0"
      />
    </div>
  );
});

DocumentPreview.displayName = 'DocumentPreview';

// Image preview component
const ImagePreview = memo(({ node }: { node: CanvasNode }) => {
  const { t } = useTranslation();

  return (
    <div className="w-full h-full relative overflow-hidden">
      <img
        src={node.data?.metadata?.imageUrl as string}
        alt={node.data?.title || t('common.untitled')}
        className="w-full h-full object-cover"
      />
    </div>
  );
});

ImagePreview.displayName = 'ImagePreview';

// Video preview component with independent state
const VideoPreview = memo(({ node }: { node: CanvasNode }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleVideoClick = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const handleVideoEnd = () => {
    setIsPlaying(false);
    setProgress(0);
  };

  const handleVideoTimeUpdate = () => {
    if (videoRef.current) {
      const progressValue = (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setProgress(progressValue);
    }
  };

  return (
    <div
      className="w-full h-full relative overflow-hidden cursor-pointer"
      style={{ backgroundColor: 'var(--refly-bg-canvas)' }}
      onClick={handleVideoClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <video
        ref={videoRef}
        src={node.data?.metadata?.videoUrl as string}
        className="w-full h-full object-cover"
        muted
        preload="metadata"
        onEnded={handleVideoEnd}
        onTimeUpdate={handleVideoTimeUpdate}
      >
        <track kind="captions" />
      </video>
      {/* Play button overlay - only show when not playing */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${
              isHovered ? 'scale-110' : ''
            }`}
            style={{
              borderRadius: '80px',
              backgroundColor: 'var(--refly-bg-float-z3)',
            }}
          >
            <Play color="var(--refly-text-StaticWhite)" className="w-4 h-4 ml-0.5" />
          </div>
        </div>
      )}
      {/* Progress bar - only show when playing */}
      {isPlaying && (
        <div
          className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full overflow-hidden"
          style={{ backgroundColor: 'var(--refly-modal-mask)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-300 ease-out"
            style={{
              width: `${progress}%`,
              backgroundColor: 'var(--refly-text-StaticWhite)',
              transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        </div>
      )}
    </div>
  );
});

VideoPreview.displayName = 'VideoPreview';

// Audio preview component with independent state
const AudioPreview = memo(({ node }: { node: CanvasNode }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleAudioClick = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const handleAudioEnd = () => {
    setIsPlaying(false);
    setProgress(0);
  };

  const handleAudioTimeUpdate = () => {
    if (audioRef.current) {
      const progressValue = (audioRef.current.currentTime / audioRef.current.duration) * 100;
      setProgress(progressValue);
    }
  };

  return (
    <div
      className="w-full h-full relative overflow-hidden cursor-pointer"
      onClick={handleAudioClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        backgroundColor: 'var(--refly-Colorful-red-light)',
      }}
    >
      {/* Fixed background pattern */}
      <div className="absolute inset-0 opacity-30">
        <div className="w-full h-full flex items-center justify-center">
          <img src={AudioBgSvg} alt="Audio background" className="w-full h-full object-contain" />
        </div>
      </div>

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={node.data?.metadata?.audioUrl as string}
        onEnded={handleAudioEnd}
        onTimeUpdate={handleAudioTimeUpdate}
      >
        <track kind="captions" />
      </audio>

      {/* Play button overlay - only show when not playing */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${
              isHovered ? 'scale-110' : ''
            }`}
            style={{
              borderRadius: '80px',
              backgroundColor: 'var(--refly-bg-float-z3)',
            }}
          >
            <Play color="var(--refly-text-StaticWhite)" className="w-4 h-4 ml-0.5" />
          </div>
        </div>
      )}
      {/* Progress bar - only show when playing */}
      {isPlaying && (
        <div
          className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full overflow-hidden"
          style={{ backgroundColor: 'var(--refly-modal-mask)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-300 ease-out"
            style={{
              width: `${progress}%`,
              backgroundColor: 'var(--refly-text-StaticWhite)',
              transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        </div>
      )}
    </div>
  );
});

AudioPreview.displayName = 'AudioPreview';

// Individual result item preview component
const ResultItemPreview = memo(({ node }: { node: CanvasNode }) => {
  // For document nodes, show the contentPreview as markdown
  if (node.type === 'document' && node.data?.contentPreview) {
    return <DocumentPreview node={node} />;
  }

  // For image nodes, show the image directly with cover crop
  if (node.type === 'image' && node.data?.metadata?.imageUrl) {
    return <ImagePreview node={node} />;
  }

  // For video nodes, show the video with cover crop and play button overlay
  if (node.type === 'video' && node.data?.metadata?.videoUrl) {
    return <VideoPreview node={node} />;
  }

  // For audio nodes, show the audio with fixed background and play button overlay
  if (node.type === 'audio' && node.data?.metadata?.audioUrl) {
    return <AudioPreview node={node} />;
  }

  // For other types, use the PreviewComponent
  return (
    <div className="w-full h-full relative">
      <PreviewComponent node={node} purePreview={true} />
      {/* Transparent overlay to prevent direct interaction */}
      <div className="absolute inset-0 bg-transparent cursor-pointer" />
    </div>
  );
});

ResultItemPreview.displayName = 'ResultItemPreview';

// Grid component to display selected results in a card layout
export const SelectedResultsGrid = memo(
  ({ selectedResults, options, bordered = false }: SelectedResultsGridProps) => {
    const { t } = useTranslation();
    const firstItemRef = useRef<HTMLDivElement>(null);
    const [itemHeight, setItemHeight] = useState<number | null>(null);

    // Filter options to only show selected ones
    const selectedNodes = options.filter((node) => selectedResults.includes(node.id));

    // Measure the actual height of the first item from full rows
    useEffect(() => {
      if (firstItemRef.current) {
        const updateHeight = () => {
          const height = firstItemRef.current?.offsetHeight;
          if (height !== undefined && height > 0) {
            setItemHeight(height);
          }
        };

        // Initial measurement
        updateHeight();

        // Use ResizeObserver to watch for size changes
        const resizeObserver = new ResizeObserver(() => {
          updateHeight();
        });

        resizeObserver.observe(firstItemRef.current);

        return () => {
          resizeObserver.disconnect();
        };
      }
    }, [selectedNodes.length]);

    if (selectedNodes.length === 0) {
      return (
        <div className="w-full h-full flex items-center justify-center text-refly-text-2 text-sm">
          {t('workflowApp.noResultsSelected')}
        </div>
      );
    }

    // Calculate if item is in last row and how many items in last row
    const totalItems = selectedNodes.length;
    const itemsPerRow = 3;
    const fullRows = Math.floor(totalItems / itemsPerRow);
    const itemsInLastRow = totalItems % itemsPerRow;
    const isLastRowIncomplete = itemsInLastRow > 0 && itemsInLastRow < itemsPerRow;

    // Separate items into full rows and last row
    const fullRowItems = selectedNodes.slice(0, fullRows * itemsPerRow);
    const lastRowItems = isLastRowIncomplete ? selectedNodes.slice(fullRows * itemsPerRow) : [];

    return (
      <div className="w-full h-full overflow-y-auto">
        <div className="space-y-3">
          {/* Full rows */}
          {fullRowItems.length > 0 && (
            <div
              className="grid grid-cols-3 cursor-pointer"
              style={{
                gap: bordered ? '10px' : '12px',
              }}
            >
              {fullRowItems.map((node, index) => (
                <div
                  key={node.id}
                  ref={index === 0 ? firstItemRef : null}
                  className={`relative cursor-pointer overflow-hidden rounded-lg ${
                    bordered ? 'border' : ''
                  }`}
                  style={{
                    minWidth: '128px',
                    aspectRatio: '128 / 77',
                    borderRadius: '8px',
                    backgroundColor: 'var(--refly-bg-content-z2)',
                    ...(bordered
                      ? {
                          border:
                            '1px solid var(--border---refly-Card-Border, rgba(0, 0, 0, 0.10))',
                          padding: '12px',
                        }
                      : {}),
                  }}
                >
                  {bordered ? (
                    <div className="w-full h-full overflow-hidden rounded-lg">
                      <ResultItemPreview node={node} />
                    </div>
                  ) : (
                    <ResultItemPreview node={node} />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Last incomplete row */}
          {isLastRowIncomplete && lastRowItems.length > 0 && (
            <div
              className="flex cursor-pointer"
              style={{
                gap: bordered ? '10px' : '12px',
              }}
            >
              {lastRowItems.map((node) => (
                <div
                  key={node.id}
                  className={`relative cursor-pointer overflow-hidden rounded-lg flex-1 ${
                    bordered ? 'border' : ''
                  }`}
                  style={{
                    minWidth: '128px',
                    // Use measured height if there are full rows above and height is measured,
                    // otherwise use aspectRatio (for initial render or when no full rows exist)
                    height:
                      fullRows > 0 && itemHeight !== null
                        ? `${itemHeight}px`
                        : fullRows === 0
                          ? undefined
                          : '77px', // Fallback during measurement
                    aspectRatio: fullRows > 0 && itemHeight !== null ? undefined : '128 / 77',
                    borderRadius: '8px',
                    backgroundColor: 'var(--refly-bg-content-z2)',
                    ...(bordered
                      ? {
                          border:
                            '1px solid var(--border---refly-Card-Border, rgba(0, 0, 0, 0.10))',
                          padding: '12px',
                        }
                      : {}),
                  }}
                >
                  {bordered ? (
                    <div className="w-full h-full overflow-hidden rounded-lg">
                      <ResultItemPreview node={node} />
                    </div>
                  ) : (
                    <ResultItemPreview node={node} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  },
);

SelectedResultsGrid.displayName = 'SelectedResultsGrid';
