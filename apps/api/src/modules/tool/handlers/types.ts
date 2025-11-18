/**
 * Handler-related type definitions and interfaces
 */

import type {
  FileMetadata,
  HandlerContext,
  HandlerRequest,
  HandlerResponse,
  UploadMetadata,
  UploadResult,
} from '@refly/openapi-schema';

export { HandlerError } from '../constant';

/**
 * Pre-handler function type
 */
export type PreHandler = (
  request: HandlerRequest,
  context: HandlerContext,
) => Promise<HandlerRequest>;

/**
 * Post-handler function type
 */
export type PostHandler = (
  response: HandlerResponse,
  request: HandlerRequest,
  context: HandlerContext,
) => Promise<HandlerResponse>;

/**
 * Resource resolver interface
 */
export interface ResourceResolver {
  /**
   * Download file from storage by storage key
   */
  resolveFile: (storageKey: string, visibility: 'public' | 'private') => Promise<Buffer>;

  /**
   * Get file metadata from database by entity ID
   */
  getFileMetadata: (entityId: string) => Promise<FileMetadata | null>;
}

/**
 * Resource uploader interface
 */
export interface ResourceUploader {
  /**
   * Upload file to storage and create database record
   */
  uploadFile: (localPath: string, metadata: UploadMetadata) => Promise<UploadResult>;
}
