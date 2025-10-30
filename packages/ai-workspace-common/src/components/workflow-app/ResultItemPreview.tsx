import { memo, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CanvasNode } from '@refly/canvas-common';
import { PreviewComponent } from '@refly-packages/ai-workspace-common/components/canvas/node-preview';
import { Markdown } from '@refly-packages/ai-workspace-common/components/markdown';
import { Play } from 'refly-icons';
import AudioBgSvg from './audioBg.svg';
import ViewSvg from './view.svg';
import {
  LazyCodeArtifactRenderer,
  LazyDocumentRenderer,
} from '@refly-packages/ai-workspace-common/components/slideshow/components/LazyComponents';
import { NodeRelation } from '@refly-packages/ai-workspace-common/components/slideshow/components/ArtifactRenderer';

// Document preview component
const DocumentPreview = memo(
  ({ node }: { node: CanvasNode; onViewClick?: (nodeId: string) => void }) => {
    return (
      <div className="w-full h-full relative overflow-hidden">
        <Markdown
          content={node.data?.contentPreview || ''}
          className="text-xs p-2 h-full overflow-hidden text-refly-text-0"
        />
      </div>
    );
  },
);

DocumentPreview.displayName = 'DocumentPreview';

// Image preview component
const ImagePreview = memo(
  ({ node }: { node: CanvasNode; onViewClick?: (nodeId: string) => void }) => {
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
  },
);

ImagePreview.displayName = 'ImagePreview';

// Video preview component with independent state
const VideoPreview = memo(
  ({ node }: { node: CanvasNode; onViewClick?: (nodeId: string) => void }) => {
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
        {/* View overlay moved to parent */}
      </div>
    );
  },
);

VideoPreview.displayName = 'VideoPreview';

// Audio preview component with independent state
const AudioPreview = memo(
  ({ node }: { node: CanvasNode; onViewClick?: (nodeId: string) => void }) => {
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
        {/* View overlay moved to parent */}
      </div>
    );
  },
);

AudioPreview.displayName = 'AudioPreview';

// Default preview component without view overlay (handled by parent)
const DefaultPreview = memo(
  ({ node }: { node: CanvasNode; onViewClick?: (nodeId: string) => void }) => {
    return (
      <div className="w-full h-full relative">
        <PreviewComponent node={node} purePreview={true} />
        {/* Transparent overlay to prevent direct interaction */}
        <div className="absolute inset-0 bg-transparent cursor-pointer" />
      </div>
    );
  },
);

DefaultPreview.displayName = 'DefaultPreview';

// Individual result item preview component
export const ResultItemPreview = memo(
  ({ node, onViewClick }: { node: CanvasNode; onViewClick?: (nodeId: string) => void }) => {
    const [isHovered, setIsHovered] = useState(false);

    let content: JSX.Element;
    let needsTransparentOverlay = false;
    if (node.type === 'image' && node.data?.metadata?.imageUrl) {
      content = <ImagePreview node={node} />;
    } else if (node.type === 'video' && node.data?.metadata?.videoUrl) {
      content = <VideoPreview node={node} />;
    } else if (node.type === 'audio' && node.data?.metadata?.audioUrl) {
      content = <AudioPreview node={node} />;
    } else if (node.type === 'codeArtifact') {
      needsTransparentOverlay = true;
      content = (
        <LazyCodeArtifactRenderer
          isFullscreen
          node={{ ...node, nodeData: node.data, nodeType: node.type } as unknown as NodeRelation}
        />
      );
    } else if (node.type === 'document') {
      needsTransparentOverlay = true;

      content = (
        <LazyDocumentRenderer
          isFullscreen
          node={{ ...node, nodeData: node.data, nodeType: node.type } as unknown as NodeRelation}
        />
      );
    } else {
      needsTransparentOverlay = true;
      content = <DefaultPreview node={node} />;
    }

    return (
      <div
        className="w-full h-full relative cursor-pointer"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {content}
        {needsTransparentOverlay ? <div className="absolute inset-0 bg-transparent" /> : null}
        {onViewClick && isHovered ? (
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
        ) : null}
      </div>
    );
  },
);
