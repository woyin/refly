import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { z } from 'zod';
import { User } from '@refly/openapi-schema';
import { ApiDefinition } from './api-definitions';
import { McpLogger } from './logger';

/**
 * Register ReflyService APIs as MCP tools
 *
 * This function registers all ReflyService APIs as MCP tools, allowing them to be
 * invoked by clients.
 *
 * @param server - The MCP server to register tools with
 * @param reflyService - The ReflyService instance to wrap
 * @param defaultUser - The default user to use for API calls
 * @param logger - The logger to use for logging
 */
export function registerReflyTools(
  server: McpServer,
  reflyService: any, // 使用 any 类型来避免类型错误
  defaultUser: User,
  logger: McpLogger,
): void {
  // Register each API as a tool
  const apiDefinitions = generateApiDefinitions();

  for (const apiDef of apiDefinitions) {
    registerSingleTool(server, reflyService, defaultUser, apiDef, logger);
  }

  logger.info(`Registered ${apiDefinitions.length} tools`);
}

/**
 * Register a single ReflyService API as an MCP tool
 *
 * @param server - The MCP server to register the tool with
 * @param reflyService - The ReflyService instance to wrap
 * @param defaultUser - The default user to use for API calls
 * @param apiDef - The API definition to register
 * @param logger - The logger to use for logging
 */
function registerSingleTool(
  server: McpServer,
  reflyService: any, // 使用 any 类型来避免类型错误
  defaultUser: User,
  apiDef: ApiDefinition,
  logger: McpLogger,
): void {
  server.tool(apiDef.name, apiDef.description, { params: apiDef.schema }, async ({ params }) => {
    logger.debug(`Executing tool: ${apiDef.name}`, params);

    // Get user from context or use default
    const user = defaultUser; // 简化处理，始终使用默认用户

    try {
      // Call the ReflyService method
      const result = await reflyService[apiDef.method](user, params);

      // Transform the result if needed
      const transformedResult = apiDef.responseTransformer
        ? apiDef.responseTransformer(result)
        : result;

      logger.debug(`Tool ${apiDef.name} executed successfully`, transformedResult);

      return transformedResult;
    } catch (error) {
      logger.error(`Error executing tool ${apiDef.name}:`, error);

      // Return a formatted error
      return {
        error: true,
        message: error instanceof Error ? error.message : String(error),
        name: apiDef.name,
      };
    }
  });

  logger.debug(`Registered tool: ${apiDef.name}`);
}

/**
 * Generate API definitions for ReflyService methods
 *
 * @returns An array of API definitions
 */
function generateApiDefinitions(): ApiDefinition[] {
  return [
    // Canvas-related APIs
    {
      name: 'listCanvases',
      description: 'List all canvases',
      method: 'listCanvases',
      schema: z.object({
        page: z.number().optional(),
        pageSize: z.number().optional(),
        order: z.string().optional(),
        projectId: z.string().optional(),
      }),
      readOnly: true,
    },
    {
      name: 'createCanvas',
      description: 'Create a new canvas',
      method: 'createCanvas',
      schema: z.object({
        title: z.string(),
        projectId: z.string().optional(),
      }),
      readOnly: false,
    },

    // Document-related APIs
    {
      name: 'getDocumentDetail',
      description: 'Get document details',
      method: 'getDocumentDetail',
      schema: z.object({
        documentId: z.string().describe('Document ID'),
      }),
      readOnly: true,
      destructive: false,
      idempotent: true,
    },
    {
      name: 'listDocuments',
      description: 'List all documents',
      method: 'listDocuments',
      schema: z.object({
        page: z.number().optional().describe('Page number, starting from 1'),
        pageSize: z.number().optional().describe('Number of items per page'),
        order: z.string().optional().describe('Sort order'),
        projectId: z.string().optional().describe('Project ID'),
      }),
      readOnly: true,
      destructive: false,
      idempotent: true,
    },
    {
      name: 'deleteDocument',
      description: 'Delete a specific document',
      method: 'deleteDocument',
      schema: z.object({
        documentId: z.string().describe('ID of the document to delete'),
      }),
      readOnly: false,
      destructive: true,
      idempotent: true,
    },

    // Resource related APIs
    {
      name: 'getResourceDetail',
      description: 'Get resource details',
      method: 'getResourceDetail',
      schema: z.object({
        resourceId: z.string().describe('Resource ID'),
      }),
      readOnly: true,
      destructive: false,
      idempotent: true,
    },
    {
      name: 'createResource',
      description: 'Create a new resource',
      method: 'createResource',
      schema: z.object({
        title: z.string().describe('Resource title'),
        content: z.string().optional().describe('Resource content'),
        type: z.string().optional().describe('Resource type'),
        // Other parameters...
      }),
      readOnly: false,
      destructive: false,
      idempotent: false,
    },
    {
      name: 'updateResource',
      description: 'Update an existing resource',
      method: 'updateResource',
      schema: z.object({
        resourceId: z.string().describe('Resource ID'),
        title: z.string().optional().describe('New resource title'),
        content: z.string().optional().describe('New resource content'),
        // Other parameters...
      }),
      readOnly: false,
      destructive: false,
      idempotent: false,
    },

    // Search related APIs
    {
      name: 'search',
      description: 'Search for resources',
      method: 'search',
      schema: z.object({
        query: z.string().describe('Search query'),
        limit: z.number().optional().describe('Maximum number of results'),
        // Other parameters...
      }),
      readOnly: true,
      destructive: false,
      idempotent: true,
      responseTransformer: (response) => {
        // Transform search results to a more user-friendly format
        return {
          totalCount: response.totalCount,
          results: response.results.map((r: any) => ({
            title: r.title,
            snippet: r.snippet,
            url: r.url,
          })),
        };
      },
    },
    {
      name: 'webSearch',
      description: 'Search the web',
      method: 'webSearch',
      schema: z.object({
        query: z.string().describe('Search query'),
        limit: z.number().optional().describe('Maximum number of results'),
        // Other parameters...
      }),
      readOnly: true,
      destructive: false,
      idempotent: true,
    },
    {
      name: 'rerank',
      description: 'Rerank search results',
      method: 'rerank',
      schema: z.object({
        query: z.string().describe('Search query'),
        results: z.array(z.any()).describe('Search results to rerank'),
        topN: z.number().optional().describe('Number of top results to return'),
        relevanceThreshold: z.number().optional().describe('Relevance threshold'),
      }),
      readOnly: true,
      destructive: false,
      idempotent: true,
    },

    // Reference related APIs
    {
      name: 'addReferences',
      description: 'Add references to a resource',
      method: 'addReferences',
      schema: z.object({
        resourceId: z.string().describe('Resource ID'),
        references: z.array(z.string()).describe('Reference IDs to add'),
      }),
      readOnly: false,
      destructive: false,
      idempotent: false,
    },
    {
      name: 'deleteReferences',
      description: 'Delete references from a resource',
      method: 'deleteReferences',
      schema: z.object({
        resourceId: z.string().describe('Resource ID'),
        references: z.array(z.string()).describe('Reference IDs to delete'),
      }),
      readOnly: false,
      destructive: true,
      idempotent: true,
    },

    // Utility APIs
    {
      name: 'crawlUrl',
      description: 'Crawl a URL and get its content',
      method: 'crawlUrl',
      schema: z.object({
        url: z.string().describe('URL to crawl'),
      }),
      readOnly: true,
      destructive: false,
      idempotent: true,
    },
    {
      name: 'inMemorySearchWithIndexing',
      description: 'Search within provided content',
      method: 'inMemorySearchWithIndexing',
      schema: z.object({
        content: z.union([z.string(), z.any(), z.array(z.any())]).describe('Content to search in'),
        query: z.string().optional().describe('Search query'),
        k: z.number().optional().describe('Number of results to return'),
        needChunk: z.boolean().optional().describe('Whether to chunk the content'),
        // Other parameters...
      }),
      readOnly: true,
      destructive: false,
      idempotent: true,
    },

    // MCP server related APIs
    {
      name: 'listMcpServers',
      description: 'List all available MCP servers',
      method: 'listMcpServers',
      schema: z.object({
        enabled: z.boolean().optional().describe('Filter by enabled status'),
        page: z.number().optional().describe('Page number'),
        pageSize: z.number().optional().describe('Page size'),
      }),
      readOnly: true,
      destructive: false,
      idempotent: true,
    },
  ];
}
