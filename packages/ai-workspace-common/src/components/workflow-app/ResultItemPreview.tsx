import { memo, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CanvasNode } from '@refly/canvas-common';
import { PreviewComponent } from '@refly-packages/ai-workspace-common/components/canvas/node-preview';
import { Markdown } from '@refly-packages/ai-workspace-common/components/markdown';
import { Play } from 'refly-icons';
import AudioBgSvg from './audioBg.svg';
import ViewSvg from './view.svg';

// Document preview component
const DocumentPreview = memo(
  ({ node, onViewClick }: { node: CanvasNode; onViewClick?: (nodeId: string) => void }) => {
    const [isHovered, setIsHovered] = useState(false);

    return (
      <div
        className="w-full h-full relative overflow-hidden"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <Markdown
          content={node.data?.contentPreview || ''}
          className="text-xs p-2 h-full overflow-hidden text-refly-text-0"
        />
        {/* Hover overlay - show in bottom right corner */}
        {isHovered && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onViewClick?.(node.id);
            }}
            className="absolute z-10 flex items-center justify-center transition-opacity duration-200 cursor-pointer"
            style={{
              right: '14px',
              bottom: '14px',
              width: 'min(56px, 20%)',
              height: 'min(44px, 20%)',
            }}
          >
            <img
              src={ViewSvg}
              alt="View"
              className="w-full h-full object-contain"
              style={{ maxWidth: '100%', maxHeight: '100%' }}
            />
          </div>
        )}
      </div>
    );
  },
);

DocumentPreview.displayName = 'DocumentPreview';

// Image preview component
const ImagePreview = memo(
  ({ node, onViewClick }: { node: CanvasNode; onViewClick?: (nodeId: string) => void }) => {
    const { t } = useTranslation();
    const [isHovered, setIsHovered] = useState(false);

    return (
      <div
        className="w-full h-full relative overflow-hidden"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <img
          src={node.data?.metadata?.imageUrl as string}
          alt={node.data?.title || t('common.untitled')}
          className="w-full h-full object-cover"
        />
        {/* Hover overlay - show in bottom right corner */}
        {isHovered && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onViewClick?.(node.id);
            }}
            className="absolute z-10 flex items-center justify-center transition-opacity duration-200 cursor-pointer"
            style={{
              right: '14px',
              bottom: '14px',
              width: 'min(56px, 20%)',
              height: 'min(44px, 20%)',
            }}
          >
            <img
              src={ViewSvg}
              alt="View"
              className="w-full h-full object-contain"
              style={{ maxWidth: '100%', maxHeight: '100%' }}
            />
          </div>
        )}
      </div>
    );
  },
);

ImagePreview.displayName = 'ImagePreview';

// Video preview component with independent state
const VideoPreview = memo(
  ({ node, onViewClick }: { node: CanvasNode; onViewClick?: (nodeId: string) => void }) => {
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
        {/* Hover overlay - show in bottom right corner */}
        {isHovered && !isPlaying && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onViewClick?.(node.id);
            }}
            className="absolute z-10 flex items-center justify-center transition-opacity duration-200 cursor-pointer"
            style={{
              right: '14px',
              bottom: '14px',
              width: 'min(56px, 20%)',
              height: 'min(44px, 20%)',
            }}
          >
            <img
              src={ViewSvg}
              alt="View"
              className="w-full h-full object-contain"
              style={{ maxWidth: '100%', maxHeight: '100%' }}
            />
          </div>
        )}
      </div>
    );
  },
);

VideoPreview.displayName = 'VideoPreview';

// Audio preview component with independent state
const AudioPreview = memo(
  ({ node, onViewClick }: { node: CanvasNode; onViewClick?: (nodeId: string) => void }) => {
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
        {/* Hover overlay - show in bottom right corner */}
        {isHovered && !isPlaying && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onViewClick?.(node.id);
            }}
            className="absolute z-10 flex items-center justify-center transition-opacity duration-200 cursor-pointer"
            style={{
              right: '14px',
              bottom: '14px',
              width: 'min(56px, 20%)',
              height: 'min(44px, 20%)',
            }}
          >
            <img
              src={ViewSvg}
              alt="View"
              className="w-full h-full object-contain"
              style={{ maxWidth: '100%', maxHeight: '100%' }}
            />
          </div>
        )}
      </div>
    );
  },
);

AudioPreview.displayName = 'AudioPreview';

// Default preview component with hover overlay
const DefaultPreview = memo(
  ({ node, onViewClick }: { node: CanvasNode; onViewClick?: (nodeId: string) => void }) => {
    const [isHovered, setIsHovered] = useState(false);

    return (
      <div
        className="w-full h-full relative"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <PreviewComponent node={node} purePreview={true} />
        {/* Transparent overlay to prevent direct interaction */}
        <div className="absolute inset-0 bg-transparent cursor-pointer" />
        {/* Hover overlay - show in bottom right corner */}
        {isHovered && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onViewClick?.(node.id);
            }}
            className="absolute z-10 flex items-center justify-center transition-opacity duration-200 cursor-pointer"
            style={{
              right: '14px',
              bottom: '14px',
              width: 'min(56px, 20%)',
              height: 'min(44px, 20%)',
            }}
          >
            <img
              src={ViewSvg}
              alt="View"
              className="w-full h-full object-contain"
              style={{ maxWidth: '100%', maxHeight: '100%' }}
            />
          </div>
        )}
      </div>
    );
  },
);

DefaultPreview.displayName = 'DefaultPreview';

// Individual result item preview component
export const ResultItemPreview = memo(
  ({ node, onViewClick }: { node: CanvasNode; onViewClick?: (nodeId: string) => void }) => {
    // For document nodes, show the contentPreview as markdown
    if (node.type === 'document' && node.data?.contentPreview) {
      return <DocumentPreview node={node} onViewClick={onViewClick} />;
    }

    // For image nodes, show the image directly with cover crop
    if (node.type === 'image' && node.data?.metadata?.imageUrl) {
      return <ImagePreview node={node} onViewClick={onViewClick} />;
    }

    // For video nodes, show the video with cover crop and play button overlay
    if (node.type === 'video' && node.data?.metadata?.videoUrl) {
      return <VideoPreview node={node} onViewClick={onViewClick} />;
    }

    // For audio nodes, show the audio with fixed background and play button overlay
    if (node.type === 'audio' && node.data?.metadata?.audioUrl) {
      return <AudioPreview node={node} onViewClick={onViewClick} />;
    }

    // For other types, use the PreviewComponent
    return <DefaultPreview node={node} onViewClick={onViewClick} />;
  },
);

ResultItemPreview.displayName = 'ResultItemPreview';
