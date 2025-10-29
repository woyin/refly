import { memo, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CanvasNode } from '@refly/canvas-common';
import { PreviewComponent } from '@refly-packages/ai-workspace-common/components/canvas/node-preview';
import { Markdown } from '@refly-packages/ai-workspace-common/components/markdown';
import { Play } from 'refly-icons';
import AudioBgSvg from './audioBg.svg';

export interface SelectedResultsGridProps {
  selectedResults: string[];
  options: CanvasNode[];
}

// Individual result item preview component
const ResultItemPreview = memo(({ node }: { node: CanvasNode }) => {
  const { t } = useTranslation();
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isVideoHovered, setIsVideoHovered] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isAudioHovered, setIsAudioHovered] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [audioProgress, setAudioProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

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
      setVideoProgress(0);
    };

    const handleVideoTimeUpdate = () => {
      if (videoRef.current) {
        const progress = (videoRef.current.currentTime / videoRef.current.duration) * 100;
        setVideoProgress(progress);
      }
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
          onTimeUpdate={handleVideoTimeUpdate}
        >
          <track kind="captions" />
        </video>
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
        {/* Progress bar - only show when playing */}
        {isVideoPlaying && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black bg-opacity-40 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-300 ease-out"
              style={{
                width: `${videoProgress}%`,
                transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            />
          </div>
        )}
      </div>
    );
  }

  // For audio nodes, show the audio with fixed background and play button overlay
  if (node.type === 'audio' && node.data?.metadata?.audioUrl) {
    const handleAudioClick = () => {
      if (audioRef.current) {
        if (isAudioPlaying) {
          audioRef.current.pause();
          setIsAudioPlaying(false);
        } else {
          audioRef.current.play();
          setIsAudioPlaying(true);
        }
      }
    };

    const handleAudioEnd = () => {
      setIsAudioPlaying(false);
      setAudioProgress(0);
    };

    const handleAudioTimeUpdate = () => {
      if (audioRef.current) {
        const progress = (audioRef.current.currentTime / audioRef.current.duration) * 100;
        setAudioProgress(progress);
      }
    };

    return (
      <div
        className="w-full h-full relative overflow-hidden cursor-pointer"
        onClick={handleAudioClick}
        onMouseEnter={() => setIsAudioHovered(true)}
        onMouseLeave={() => setIsAudioHovered(false)}
        style={{
          background: 'var(--typeColoful---refly-Colorful-red-light, #FFEFED)',
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
          src={node.data.metadata.audioUrl as string}
          onEnded={handleAudioEnd}
          onTimeUpdate={handleAudioTimeUpdate}
        >
          <track kind="captions" />
        </audio>

        {/* Play button overlay - only show when not playing */}
        {!isAudioPlaying && (
          <div
            className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${"   isAudioHovered ? 'bg-opacity-20' : 'bg-opacity-30'"}`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${
                isAudioHovered ? 'scale-110' : ''
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
        {/* Progress bar - only show when playing */}
        {isAudioPlaying && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black bg-opacity-40 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-300 ease-out"
              style={{
                width: `${audioProgress}%`,
                transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            />
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
