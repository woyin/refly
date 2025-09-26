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

export const MIME_TYPE_VALIDATION = {
  document: [
    'text/plain', // TXT
    'text/markdown', // MD, MDX, MARKDOWN
    'text/html', // HTML
    'text/csv', // CSV
    'text/xml', // XML
    'application/pdf', // PDF
    'application/vnd.ms-excel', // XLS
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // XLSX
    'application/msword', // DOC
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
    'application/vnd.ms-powerpoint', // PPT
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // PPTX
    'application/epub+zip', // EPUB
    'message/rfc822', // EML
    'application/vnd.ms-outlook', // MSG
  ],
  image: [
    'image/jpeg', // JPG, JPEG
    'image/png', // PNG
    'image/gif', // GIF
    'image/webp', // WEBP
    'image/svg+xml', // SVG
  ],
  audio: [
    'audio/mpeg', // MP3, MPGA
    'audio/mp4', // M4A
    'audio/wav', // WAV
    'audio/amr', // AMR
  ],
  video: [
    'video/mp4', // MP4
    'video/quicktime', // MOV
    'video/mpeg', // MPEG
    'video/webm', // WEBM
  ],
} as const;

export const RESOURCE_TYPE = ['document', 'image', 'audio', 'video'] as VariableResourceType[];
