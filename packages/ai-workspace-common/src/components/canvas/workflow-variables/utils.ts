import type { FileCategoryInfo } from './types';
import {
  DOCUMENT_FILE_EXTENSIONS,
  IMAGE_FILE_EXTENSIONS,
  AUDIO_FILE_EXTENSIONS,
  VIDEO_FILE_EXTENSIONS,
} from './constants';

export const getFileExtension = (filename: string): string => {
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex === -1 || lastDotIndex === filename.length - 1) {
    return '';
  }
  return filename.slice(lastDotIndex + 1).toLowerCase();
};

export const getFileCategoryAndLimit = (file: File): FileCategoryInfo => {
  const extension = getFileExtension(file.name);

  // Document types
  if (DOCUMENT_FILE_EXTENSIONS.includes(extension)) {
    return { category: 'document', maxSize: 20 * 1024 * 1024, fileType: extension };
  }

  // Image types
  if (IMAGE_FILE_EXTENSIONS.includes(extension)) {
    return { category: 'image', maxSize: 10 * 1024 * 1024, fileType: extension };
  }

  // Audio types
  if (AUDIO_FILE_EXTENSIONS.includes(extension)) {
    return { category: 'audio', maxSize: 50 * 1024 * 1024, fileType: extension };
  }

  // Video types
  if (VIDEO_FILE_EXTENSIONS.includes(extension)) {
    return { category: 'video', maxSize: 100 * 1024 * 1024, fileType: extension };
  }

  // Unknown type
  return { category: 'unknown', maxSize: 100 * 1024 * 1024, fileType: extension };
};

export const ensureUniqueOptions = (options: string[]): string[] => {
  const validOptions = options.filter((option) => option && option.trim().length > 0);
  const uniqueOptions: string[] = [];
  const seen = new Set<string>();

  for (const option of validOptions) {
    if (!seen.has(option)) {
      seen.add(option);
      uniqueOptions.push(option);
    }
  }

  return uniqueOptions;
};
