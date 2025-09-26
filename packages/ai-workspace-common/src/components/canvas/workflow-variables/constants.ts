import { VariableResourceType } from '@refly/openapi-schema';

export const MAX_OPTIONS = 20;

export const DOCUMENT_FILE_EXTENSIONS = ['txt', 'md', 'markdown', 'pdf', 'html', 'docx', 'epub'];
export const IMAGE_FILE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'tiff', 'bmp', 'webp', 'svg'];
export const AUDIO_FILE_EXTENSIONS = ['mp3', 'm4a', 'wav', 'mpga', 'ogg', 'flac', 'aac'];
export const VIDEO_FILE_EXTENSIONS = ['mp4', 'mov', 'webm', 'avi', 'mkv', 'flv', 'wmv'];

export const ACCEPT_FILE_EXTENSIONS = [
  ...DOCUMENT_FILE_EXTENSIONS,
  ...IMAGE_FILE_EXTENSIONS,
  ...AUDIO_FILE_EXTENSIONS,
  ...VIDEO_FILE_EXTENSIONS,
];

export const FILE_SIZE_LIMITS = {
  document: 20, // 20MB
  image: 10, // 10MB
  audio: 50, // 50MB
  video: 100, // 100MB
  unknown: 100, // 100MB
} as const;

export const RESOURCE_TYPE = ['document', 'image', 'audio', 'video'] as VariableResourceType[];
