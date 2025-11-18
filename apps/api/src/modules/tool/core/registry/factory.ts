/**
 * Tool Factory
 * Instantiates executable LangChain tools from tool definitions
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type {
  DynamicToolDefinition,
  ParsedMethodConfig,
  ToolsetConfig,
} from '@refly/openapi-schema';
import { AdapterFactory } from '../../adapters/factory/factory';
import { HttpHandler } from '../../handlers/handler';
import type { ResourceResolver, ResourceUploader } from '../../handlers/types';
import { extractResourceFields, parseJsonSchema, resolveCredentials } from '../../utils';
import { ConfigLoader } from '../loader/loader';
import { ToolDefinitionRegistry } from './definition';
import { ToolsetType, getMediaTypeFromMime, getMediaTypeFromExtension } from '../../constant';
import { MiscService } from '../../../misc/misc.service';
import { genMediaID } from '@refly/utils';
import mime from 'mime';
import { readFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { getCurrentUser, runInContext } from '../context/request-context';

/**
 * Tool factory service
 * Orchestrates tool instantiation by combining definitions with runtime dependencies
 */
@Injectable()
export class ToolFactory implements OnModuleInit {
  private readonly logger = new Logger(ToolFactory.name);
  private readonly toolCache = new Map<string, DynamicStructuredTool[]>();

  constructor(
    private readonly configLoader: ConfigLoader,
    private readonly definitionRegistry: ToolDefinitionRegistry,
    private readonly adapterFactory: AdapterFactory,
    private readonly miscService: MiscService,
  ) {}

  /**
   * Called when the module is initialized
   * Marks configuration loader initialization as complete and preloads configs
   */
  async onModuleInit(): Promise<void> {
    // Wait a short time to ensure all other modules are ready
    await new Promise((resolve) => setTimeout(resolve, 1000));
    this.configLoader.setInitializationComplete();

    // Preload config-based tools on startup for debugging
    try {
      const configs = await this.configLoader.loadAllConfigs(ToolsetType.REGULAR);
      this.logger.log(`Preloaded ${configs.length} config-based toolset configurations`);
      // Register tool definitions for preloaded configs
      for (const config of configs) {
        this.definitionRegistry.registerTools(config);
      }
    } catch (error) {
      this.logger.error(
        `Failed to preload config-based tools: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }

    this.logger.log('ToolFactory initialized');
  }

  /**
   * Create built-in resource resolver
   * Uses MiscService to handle file downloads
   */
  private createResourceResolver(): ResourceResolver {
    return {
      resolveFile: async (storageKey: string, visibility: 'public' | 'private') => {
        try {
          const buffer = await this.miscService.downloadFile({ storageKey, visibility });
          return buffer;
        } catch (error) {
          this.logger.error(`Failed to download file ${storageKey}: ${(error as Error).message}`);
          throw error;
        }
      },
      getFileMetadata: async (entityId: string) => {
        // TODO: Implement getFileMetadata in MiscService
        // For now, return null as metadata lookup is not critical for resource resolution
        this.logger.warn(`getFileMetadata not yet implemented for entityId: ${entityId}`);
        return null;
      },
    };
  }

  /**
   * Create built-in resource uploader
   * Uses MiscService to handle file uploads from local files
   */
  private createResourceUploader(): ResourceUploader {
    return {
      uploadFile: async (localPath: string) => {
        try {
          const contextUser = getCurrentUser();
          const userId = contextUser?.uid;
          if (!userId) {
            throw new Error(
              'User ID is required for file upload. Please provide userId in metadata or ensure request context is set.',
            );
          }

          // Read file from local path
          const buffer = await readFile(localPath);
          const filename = basename(localPath);
          const ext = extname(localPath).toLowerCase();

          // Determine MIME type from file extension using mime library
          const mimetype = mime.getType(filename) || 'application/octet-stream';

          // Determine media type using a fallback strategy:
          // 1. Try from MIME type first (more accurate)
          // 2. If MIME type is generic (application/octet-stream) or not recognized, use file extension
          let mediaType = getMediaTypeFromMime(mimetype);
          if (!mediaType) {
            mediaType = getMediaTypeFromExtension(ext);
          }

          // Generate entity ID based on media type
          // genMediaID only accepts 'audio' | 'video' | 'image'
          let entityId: string;
          if (mediaType === 'audio' || mediaType === 'video' || mediaType === 'image') {
            entityId = genMediaID(mediaType);
          } else {
            // For 'doc' type or unrecognized files, generate a generic media ID
            const { createId } = await import('@paralleldrive/cuid2');
            entityId = `media-${createId()}`;
          }

          // Upload to storage using MiscService
          const uploadResult = await this.miscService.uploadFile(
            { uid: userId } as any, // MiscService expects User type with uid
            {
              file: {
                buffer,
                mimetype,
                originalname: filename,
              },
              entityId,
              visibility: 'private',
            },
          );

          if (mediaType) {
            // Log media type for debugging
            this.logger.debug(
              `Uploaded file ${filename} with media type: ${mediaType} (MIME: ${mimetype})`,
            );
          }

          // Map media type to resource type
          // MediaType: 'audio' | 'video' | 'image' | 'doc'
          // ResourceType: 'audio' | 'video' | 'image' | 'document'
          const resourceType: 'audio' | 'video' | 'image' | 'document' =
            mediaType === 'doc'
              ? 'document'
              : (mediaType as 'audio' | 'video' | 'image') || 'document';

          return {
            localPath,
            url: uploadResult.url,
            storageKey: uploadResult.storageKey,
            entityId,
            fileId: uploadResult.storageKey, // Use storageKey as fileId fallback
            resourceType,
            metadata: {
              size: buffer.length,
              mimeType: mimetype,
            },
          };
        } catch (error) {
          this.logger.error(
            `Failed to upload file ${localPath}: ${(error as Error).message}`,
            (error as Error).stack,
          );
          throw error;
        }
      },
    };
  }

  /**
   * Instantiate tools by inventory key (new simplified API)
   * Uses built-in resource handlers, only requires inventoryKey
   * Credentials are loaded from the config automatically
   * @param inventoryKey - Toolset inventory key (e.g., 'fish_audio', 'heygen')
   * @returns Array of DynamicStructuredTool instances
   */
  async instantiateToolsByKey(inventoryKey: string): Promise<DynamicStructuredTool[]> {
    try {
      // Check cache first
      if (this.toolCache.has(inventoryKey)) {
        return this.toolCache.get(inventoryKey)!;
      }

      // Load configuration from inventory
      const config = await this.configLoader.loadConfig(inventoryKey);
      if (!config) {
        this.logger.warn(`No configuration found for inventory key: ${inventoryKey}`);
        return [];
      }

      // Get tool definitions (already registered in onModuleInit)
      const allDefinitions = this.definitionRegistry.getAllDefinitions();
      const definitions = allDefinitions.filter(
        (def) => def.metadata.toolsetKey === config.inventoryKey,
      );

      if (definitions.length === 0) {
        this.logger.warn(`No tool definitions found for ${inventoryKey}`);
        return [];
      }

      // Create built-in resource handlers
      const resourceResolver = this.createResourceResolver();
      const resourceUploader = this.createResourceUploader();

      // Credentials are loaded from config.credentials
      const credentials = config.credentials;

      // Create DynamicStructuredTool instances
      const tools = await this.createDynamicTools(
        config,
        definitions,
        resourceResolver,
        resourceUploader,
        credentials,
      );

      // Cache the tools
      this.toolCache.set(inventoryKey, tools);
      this.logger.log(`Instantiated ${tools.length} tools for ${inventoryKey}`);

      return tools;
    } catch (error) {
      this.logger.error(
        `Failed to instantiate tools for ${inventoryKey}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      return [];
    }
  }

  /**
   * Create DynamicStructuredTool instances from definitions
   */
  private async createDynamicTools(
    config: ToolsetConfig,
    definitions: DynamicToolDefinition[],
    resourceResolver: ResourceResolver,
    resourceUploader: ResourceUploader,
    credentialsOverride?: Record<string, unknown>,
  ): Promise<DynamicStructuredTool[]> {
    const tools: DynamicStructuredTool[] = [];

    for (const definition of definitions) {
      try {
        // Find corresponding method config
        const methodConfig = config.methods.find((m) => m.name === definition.metadata.methodName);
        if (!methodConfig) {
          this.logger.warn(`Method config not found for: ${definition.metadata.methodName}`);
          continue;
        }

        // Parse method to get resource fields
        const parsedMethod = this.parseMethodConfig(methodConfig);

        // Resolve credentials
        const credentials = credentialsOverride || resolveCredentials(config.credentials || {});

        // Create adapter
        const adapter = await this.adapterFactory.createAdapter(parsedMethod, credentials);

        // Create handler
        const handler = new HttpHandler(adapter, {
          endpoint: parsedMethod.endpoint,
          method: parsedMethod.method,
          credentials,
          inputResourceFields: parsedMethod.inputResourceFields,
          outputResourceFields: parsedMethod.outputResourceFields,
          resourceResolver,
          resourceUploader,
          billing: parsedMethod.billing,
          timeout: parsedMethod.timeout,
          formatResponse: false, // Return JSON, not formatted text
        });

        // Create DynamicStructuredTool
        // Use 'as unknown' to avoid excessive depth in type instantiation with complex Zod schemas
        const toolSchema = definition.schema as unknown;
        const tool = new DynamicStructuredTool({
          name: definition.name,
          description: definition.description,
          schema: toolSchema,
          func: async (args: Record<string, unknown>) => {
            try {
              // Try multiple sources for user info (in priority order):
              const user = getCurrentUser();
              // Execute via HttpHandler with request context
              const response = await runInContext(
                { user, requestId: `tool-${definition.name}-${Date.now()}` },
                async () => {
                  return await handler.handle({
                    provider: config.domain,
                    method: parsedMethod.name,
                    params: args,
                    user, // Pass user context (may be undefined)
                    metadata: {
                      toolName: parsedMethod.name,
                      toolsetKey: config.inventoryKey,
                    },
                  });
                },
              );

              // Return JSON response
              return JSON.stringify(response, null, 2);
            } catch (error) {
              this.logger.error(
                `Tool execution failed (${definition.name}): ${(error as Error).message}`,
              );
              return JSON.stringify({
                success: false,
                error: {
                  code: 'EXECUTION_ERROR',
                  message: (error as Error).message,
                },
              });
            }
          },
        });

        // Attach metadata to tool for tracking
        (tool as any).metadata = {
          ...definition.metadata,
          name: definition.metadata.methodName, // Use methodName as name for event tracking
        };

        tools.push(tool);
        this.logger.debug(`Created tool: ${definition.name}`);
      } catch (error) {
        this.logger.error(
          `Failed to create tool ${definition.name}: ${(error as Error).message}`,
          (error as Error).stack,
        );
      }
    }

    return tools;
  }

  /**
   * Parse method config (similar to ToolDefinitionRegistry.parseMethodConfig)
   */
  private parseMethodConfig(method: ToolsetConfig['methods'][0]): ParsedMethodConfig {
    // Parse JSON schemas - these are already validated as object schemas in the config
    const schema = parseJsonSchema(method.schema);
    const responseSchema = parseJsonSchema(method.responseSchema);

    const inputResourceFields = extractResourceFields(schema);
    const outputResourceFields = extractResourceFields(responseSchema);

    return {
      ...method,
      schema,
      responseSchema,
      inputResourceFields,
      outputResourceFields,
    };
  }
}
