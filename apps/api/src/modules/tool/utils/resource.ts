/**
 * Resource management utilities
 * Handles file upload, download, path operations, and resource field extraction for tool responses
 */

import { Logger } from '@nestjs/common';
import * as fs from 'node:fs/promises';
import type {
  FileMetadata,
  HandlerContext,
  HandlerRequest,
  JsonSchema,
  ResourceField,
  ResponseSchema,
  SchemaProperty,
  ToolResourceType,
  UploadResult,
} from '@refly/openapi-schema';
import type { ResourceResolver, ResourceUploader } from '../handlers/types';
import { RequestContextManager } from '../core/context/request-context';

/**
 * ============================================================================
 * Path Utilities
 * ============================================================================
 */

/**
 * Get value from object by path (supports nested paths with dots)
 * @param obj - Source object
 * @param path - Dot-separated path (e.g., "user.profile.name")
 * @returns Value at the path or undefined
 */
export function getValueByPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (!current || typeof current !== 'object') {
      return undefined;
    }

    current = (current as Record<string, unknown>)[part];

    if (current === undefined) {
      return undefined;
    }
  }

  return current;
}

/**
 * Set value in object by path (supports nested paths with dots)
 * Creates intermediate objects if they don't exist
 * @param obj - Target object
 * @param path - Dot-separated path (e.g., "user.profile.name")
 * @param value - Value to set
 */
export function setValueByPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  const lastPart = parts.pop();

  if (!lastPart) {
    return;
  }

  let current: Record<string, unknown> = obj;

  // Navigate to the parent object
  for (const part of parts) {
    if (!(part in current)) {
      current[part] = {};
    }

    const next = current[part];
    if (typeof next !== 'object' || next === null) {
      current[part] = {};
    }

    current = current[part] as Record<string, unknown>;
  }

  // Set the value
  current[lastPart] = value;
}

/**
 * Check if a path exists in an object
 * @param obj - Source object
 * @param path - Dot-separated path
 * @returns True if path exists
 */
export function hasPath(obj: Record<string, unknown>, path: string): boolean {
  return getValueByPath(obj, path) !== undefined;
}

/**
 * Get all paths in an object (useful for debugging)
 * @param obj - Source object
 * @param prefix - Path prefix for recursion
 * @returns Array of all paths in the object
 */
export function getAllPaths(obj: Record<string, unknown>, prefix = ''): string[] {
  const paths: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    const currentPath = prefix ? `${prefix}.${key}` : key;
    paths.push(currentPath);

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      paths.push(...getAllPaths(value as Record<string, unknown>, currentPath));
    }
  }

  return paths;
}

/**
 * ============================================================================
 * Upload Utilities
 * ============================================================================
 */

/**
 * Upload a single resource item
 * Automatically detects resource type and handles:
 * - Buffer objects: { buffer: Buffer, filename?: string, mimetype?: string }
 * - URL strings: "https://example.com/file.mp3"
 * - Local file paths: "/tmp/file.mp3"
 * - Base64 objects: { data: string, filename: string, mimetype: string }
 * - Upload results: { url, entityId, storageKey }
 */
export async function uploadResourceItem(
  value: unknown,
  fieldPath: string,
  resourceType: ToolResourceType,
  request: HandlerRequest,
  uploader: ResourceUploader,
  logger: Logger,
  context?: HandlerContext,
): Promise<UploadResult | null> {
  try {
    // Case 1: Already an upload result - return directly
    if (isUploadResult(value)) {
      return value as UploadResult;
    }

    // Case 2: Buffer object - { buffer, filename?, mimetype? }
    if (isBufferObject(value)) {
      return await uploadBufferResource(value, resourceType, request, uploader, logger, context);
    }

    // Case 3: Base64 object - { data, filename, mimetype }
    if (isBase64Object(value)) {
      return await uploadBase64Resource(value, resourceType, request, uploader, logger, context);
    }

    // Case 4: String - could be URL or local file path
    if (typeof value === 'string') {
      logger.log(
        `Detected string value for field ${fieldPath}: ${value.substring(0, 100)}${value.length > 100 ? '...' : ''}`,
      );
      return await uploadStringResource(value, resourceType, request, uploader, logger);
    }

    logger.warn(`Unsupported resource value type for field ${fieldPath}: ${typeof value}`);
    return null;
  } catch (error) {
    logger.error(
      `Failed to upload resource ${fieldPath}: ${(error as Error).message}`,
      (error as Error).stack,
    );
    return null;
  }
}

/**
 * Upload a local file to storage
 */
async function uploadLocalFile(
  filePath: string,
  resourceType: ToolResourceType,
  request: HandlerRequest,
  uploader: ResourceUploader,
  logger: Logger,
): Promise<UploadResult | null> {
  try {
    // Check if it's a valid local file path
    await fs.access(filePath);

    // Upload the file - use context.user if available, fallback to request.user
    const userId = RequestContextManager.getContext().user?.uid;
    return await uploader.uploadFile(filePath, {
      provider: request.provider,
      method: request.method,
      type: resourceType,
      userId,
    });
  } catch {
    // Not a local file path, might be a URL or other string
    logger.warn(`Value is not a local file path: ${filePath}`);
    return null;
  }
}

/**
 * Check if value is an upload result
 */
function isUploadResult(value: unknown): value is UploadResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'entityId' in value &&
    'url' in value &&
    'storageKey' in value
  );
}

/**
 * Upload multiple resource items in parallel
 */
export async function uploadResourceItems(
  items: unknown[],
  baseFieldPath: string,
  resourceType: ToolResourceType,
  request: HandlerRequest,
  uploader: ResourceUploader,
  logger: Logger,
  context?: HandlerContext,
): Promise<UploadResult[]> {
  const results = await Promise.all(
    items.map((item, index) =>
      uploadResourceItem(
        item,
        `${baseFieldPath}[${index}]`,
        resourceType,
        request,
        uploader,
        logger,
        context,
      ),
    ),
  );

  return results.filter((r): r is UploadResult => r !== null);
}

/**
 * Extract upload result data for response
 */
export function extractUploadData(result: UploadResult): {
  url: string;
  entityId: string;
  storageKey: string;
} {
  return {
    url: result.url,
    entityId: result.entityId,
    storageKey: result.storageKey,
  };
}

/**
 * ============================================================================
 * Resource Resolution Utilities (for input resources)
 * ============================================================================
 */

/**
 * Process a single resource item for input
 * Converts entityId to Buffer/File or keeps existing Buffer/File
 * @param value - Value to process (entityId, Buffer, File, etc.)
 * @param fieldPath - Path to the field for logging
 * @param resolver - Resource resolver instance
 * @param logger - Logger instance
 * @returns Processed value (Buffer, File, or original)
 */
export async function resolveResourceItem(
  value: unknown,
  fieldPath: string,
  resolver: ResourceResolver,
  logger: Logger,
): Promise<unknown> {
  // If value is already a Buffer or File, return as-is
  if (value instanceof Buffer || value instanceof Blob || isFileObject(value)) {
    return value;
  }

  // If value is an object with entityId, resolve it
  if (typeof value === 'object' && value !== null && 'entityId' in value) {
    const entityId = (value as { entityId: string }).entityId;

    try {
      // Get file metadata from database
      const metadata = await resolver.getFileMetadata(entityId);

      if (!metadata) {
        logger.warn(`File not found for entityId: ${entityId}`);
        return value;
      }

      // Download file buffer
      const buffer = await resolver.resolveFile(metadata.storageKey, metadata.visibility);

      // Create a File-like object with buffer and metadata
      return createFileObject(buffer, metadata.entityId, metadata.mimeType);
    } catch (error) {
      logger.error(
        `Failed to resolve entityId ${entityId} for field ${fieldPath}: ${(error as Error).message}`,
      );
      return value;
    }
  }

  // If value is a string (might be entityId directly), try to resolve
  if (typeof value === 'string') {
    try {
      const metadata = await resolver.getFileMetadata(value);

      if (!metadata) {
        // Not a valid entityId, return original value
        return value;
      }

      const buffer = await resolver.resolveFile(metadata.storageKey, metadata.visibility);
      return createFileObject(buffer, metadata.entityId, metadata.mimeType);
    } catch {
      // Not a valid entityId, return original value
      return value;
    }
  }

  return value;
}

/**
 * Resolve multiple resource items in parallel
 * @param items - Array of items to resolve
 * @param baseFieldPath - Base path for logging
 * @param resolver - Resource resolver instance
 * @param logger - Logger instance
 * @returns Array of resolved items
 */
export async function resolveResourceItems(
  items: unknown[],
  baseFieldPath: string,
  resolver: ResourceResolver,
  logger: Logger,
): Promise<unknown[]> {
  return await Promise.all(
    items.map((item, index) =>
      resolveResourceItem(item, `${baseFieldPath}[${index}]`, resolver, logger),
    ),
  );
}

/**
 * Check if value is a File object
 * @param value - Value to check
 * @returns True if value appears to be a File
 */
function isFileObject(value: unknown): boolean {
  return (
    value !== null &&
    typeof value === 'object' &&
    ('name' in value || 'type' in value || 'lastModified' in value)
  );
}

/**
 * Create a File-like object from Buffer
 * @param buffer - File buffer
 * @param filename - File name
 * @param mimeType - MIME type
 * @returns File object
 */
function createFileObject(buffer: Buffer, filename: string, mimeType?: string): File {
  // Convert Buffer to Blob
  const blob = new Blob([buffer], { type: mimeType || 'application/octet-stream' });

  // Create File from Blob
  const extension = filename.split('.').pop() || 'bin';
  return new File([blob], `${filename}.${extension}`, { type: mimeType });
}

/**
 * ============================================================================
 * Download Utilities
 * ============================================================================
 */

/**
 * Download file from storage
 * @param storageKey - Storage key of the file
 * @param visibility - File visibility (public or private)
 * @param resolver - Resource resolver instance
 * @param logger - Logger instance
 * @returns File content as Buffer
 */
export async function downloadFile(
  storageKey: string,
  visibility: 'public' | 'private',
  resolver: ResourceResolver,
  logger: Logger,
): Promise<Buffer | null> {
  try {
    return await resolver.resolveFile(storageKey, visibility);
  } catch (error) {
    logger.error(
      `Failed to download file ${storageKey}: ${(error as Error).message}`,
      (error as Error).stack,
    );
    return null;
  }
}

/**
 * Get file metadata from database
 * @param entityId - Entity ID of the file
 * @param resolver - Resource resolver instance
 * @param logger - Logger instance
 * @returns File metadata or null if not found
 */
export async function getFileMetadata(
  entityId: string,
  resolver: ResourceResolver,
  logger: Logger,
): Promise<FileMetadata | null> {
  try {
    return await resolver.getFileMetadata(entityId);
  } catch (error) {
    logger.error(
      `Failed to get file metadata for ${entityId}: ${(error as Error).message}`,
      (error as Error).stack,
    );
    return null;
  }
}

/**
 * Download and resolve resource by entity ID
 * Fetches metadata first, then downloads the file
 * @param entityId - Entity ID of the resource
 * @param resolver - Resource resolver instance
 * @param logger - Logger instance
 * @returns Object containing metadata and file buffer
 */
export async function resolveResource(
  entityId: string,
  resolver: ResourceResolver,
  logger: Logger,
): Promise<{ metadata: FileMetadata; buffer: Buffer } | null> {
  try {
    // Get file metadata
    const metadata = await resolver.getFileMetadata(entityId);
    if (!metadata) {
      logger.warn(`File metadata not found for entity ${entityId}`);
      return null;
    }

    // Download file
    const buffer = await resolver.resolveFile(metadata.storageKey, metadata.visibility);
    if (!buffer) {
      logger.warn(`File not found in storage for entity ${entityId}`);
      return null;
    }

    return { metadata, buffer };
  } catch (error) {
    logger.error(
      `Failed to resolve resource ${entityId}: ${(error as Error).message}`,
      (error as Error).stack,
    );
    return null;
  }
}

/**
 * ============================================================================
 * Schema Extraction Utilities
 * ============================================================================
 */

/**
 * Extract resource fields from JSON schema
 * Finds all fields marked with isResource: true
 * @param schema - JSON schema to extract from
 * @returns Array of resource fields with their paths and types
 */
export function extractResourceFields(schema: JsonSchema): ResourceField[] {
  const resourceFields: ResourceField[] = [];

  function traverse(property: SchemaProperty, path: string, parentIsArray = false): void {
    if (property.isResource && property.resourceType) {
      resourceFields.push({
        fieldPath: path,
        type: property.resourceType,
        isArray: parentIsArray,
      });
      return;
    }

    if (property.type === 'object' && property.properties) {
      for (const [key, subProperty] of Object.entries(property.properties)) {
        const subPath = path ? `${path}.${key}` : key;
        traverse(subProperty, subPath, false);
      }
    }

    if (property.type === 'array' && property.items) {
      if (property.items.isResource && property.items.resourceType) {
        resourceFields.push({
          fieldPath: path,
          type: property.items.resourceType,
          isArray: true,
        });
      } else {
        traverse(property.items, path, true);
      }
    }
  }

  // Traverse all properties in the schema
  if (schema.properties) {
    for (const [fieldName, fieldSchema] of Object.entries(schema.properties)) {
      traverse(fieldSchema, fieldName);
    }
  }

  return resourceFields;
}

/**
 * Extract resource fields from response schema
 * @param schema - Response schema to extract from
 * @returns Array of output resource fields
 */
export function extractOutputResourceFields(schema: ResponseSchema): ResourceField[] {
  return extractResourceFields(schema);
}

/**
 * ============================================================================
 * Enhanced Resource Upload Utilities (Buffer, URL, Base64 support)
 * ============================================================================
 */

/**
 * Buffer object interface
 */
interface BufferObject {
  buffer: Buffer;
  filename?: string;
  mimetype?: string;
}

/**
 * Base64 object interface
 */
interface Base64Object {
  data: string;
  filename: string;
  mimetype: string;
}

/**
 * Check if value is a buffer object
 */
function isBufferObject(value: unknown): value is BufferObject {
  return (
    typeof value === 'object' &&
    value !== null &&
    'buffer' in value &&
    Buffer.isBuffer((value as BufferObject).buffer)
  );
}

/**
 * Check if value is a base64 object
 */
function isBase64Object(value: unknown): value is Base64Object {
  return (
    typeof value === 'object' &&
    value !== null &&
    'data' in value &&
    typeof (value as Base64Object).data === 'string' &&
    'filename' in value &&
    'mimetype' in value
  );
}

/**
 * Check if string is a URL
 */
function isURL(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Check if string is a local file path
 */
async function isLocalFile(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Upload string resource (URL or local path)
 */
async function uploadStringResource(
  value: string,
  resourceType: ToolResourceType,
  request: HandlerRequest,
  uploader: ResourceUploader,
  logger: Logger,
): Promise<UploadResult | null> {
  // Try local file path first
  if (await isLocalFile(value)) {
    logger.log(`Uploading from local file: ${value}`);
    return await uploadLocalFile(value, resourceType, request, uploader, logger);
  }

  // Try URL
  if (isURL(value)) {
    logger.log(`Downloading and uploading from URL: ${value}`);
    return await downloadAndUpload(value, resourceType, request, uploader, logger);
  }

  logger.warn(`String value is neither a local file nor URL: ${value}`);
  return null;
}

/**
 * Upload buffer resource
 */
async function uploadBufferResource(
  value: BufferObject,
  resourceType: ToolResourceType,
  request: HandlerRequest,
  uploader: ResourceUploader,
  logger: Logger,
  context?: HandlerContext,
): Promise<UploadResult | null> {
  // Save buffer to temp file and upload
  return await uploadBufferViaTemp(value, resourceType, request, uploader, logger, context);
}

/**
 * Upload base64 resource
 */
async function uploadBase64Resource(
  value: Base64Object,
  resourceType: ToolResourceType,
  request: HandlerRequest,
  uploader: ResourceUploader,
  logger: Logger,
  context?: HandlerContext,
): Promise<UploadResult | null> {
  // Convert base64 to buffer
  const buffer = Buffer.from(value.data, 'base64');
  return await uploadBufferViaTemp(
    { buffer, filename: value.filename, mimetype: value.mimetype },
    resourceType,
    request,
    uploader,
    logger,
    context,
  );
}

/**
 * Upload buffer via temporary file
 */
async function uploadBufferViaTemp(
  value: BufferObject,
  resourceType: ToolResourceType,
  request: HandlerRequest,
  uploader: ResourceUploader,
  logger: Logger,
  _context?: HandlerContext,
): Promise<UploadResult | null> {
  const os = await import('node:os');
  const path = await import('node:path');

  const tempDir = os.tmpdir();
  const extension =
    value.filename?.split('.').pop() || getExtensionFromMimeType(value.mimetype || '');
  const tempPath = path.join(tempDir, `upload-${Date.now()}.${extension}`);

  try {
    // Write buffer to temp file
    await fs.writeFile(tempPath, value.buffer);
    logger.log(`Saved buffer to temp file: ${tempPath}`);

    // Upload temp file - use context.user if available, fallback to request.user
    const userId = RequestContextManager.getContext().user.uid;
    const result = await uploader.uploadFile(tempPath, {
      provider: request.provider,
      method: request.method,
      type: resourceType,
      userId,
    });

    return result;
  } finally {
    // Clean up temp file
    try {
      await fs.unlink(tempPath);
      logger.log(`Deleted temp file: ${tempPath}`);
    } catch (error) {
      logger.warn(`Failed to delete temp file ${tempPath}: ${(error as Error).message}`);
    }
  }
}

/**
 * Download from URL and upload to storage
 */
async function downloadAndUpload(
  url: string,
  resourceType: ToolResourceType,
  request: HandlerRequest,
  uploader: ResourceUploader,
  logger: Logger,
): Promise<UploadResult | null> {
  const os = await import('node:os');
  const path = await import('node:path');

  const tempDir = os.tmpdir();
  const urlObj = new URL(url);
  const extension = path.extname(urlObj.pathname) || '.bin';
  const tempPath = path.join(tempDir, `download-${Date.now()}${extension}`);

  try {
    // Download file
    logger.log(`Downloading from URL: ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download from ${url}: ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(tempPath, buffer);
    logger.log(`Downloaded to temp file: ${tempPath} (${buffer.length} bytes)`);

    // Upload temp file - use context.user if available, fallback to request.user
    const userId = RequestContextManager.getContext().user.uid;
    const result = await uploader.uploadFile(tempPath, {
      provider: request.provider,
      method: request.method,
      type: resourceType,
      userId,
    });

    return result;
  } finally {
    // Clean up temp file
    try {
      await fs.unlink(tempPath);
      logger.log(`Deleted temp file: ${tempPath}`);
    } catch (error) {
      logger.warn(`Failed to delete temp file ${tempPath}: ${(error as Error).message}`);
    }
  }
}

/**
 * Get file extension from MIME type
 */
function getExtensionFromMimeType(mimetype: string): string {
  const map: Record<string, string> = {
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
    'audio/ogg': 'ogg',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
    'application/octet-stream': 'bin',
  };

  // Extract base type (remove charset, etc.)
  const baseType = mimetype.split(';')[0].trim().toLowerCase();
  return map[baseType] || 'bin';
}
