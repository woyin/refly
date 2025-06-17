import { Injectable, Logger } from '@nestjs/common';
import { Tool, Context } from '@rekog/mcp-nest';
import { z } from 'zod';
import { Request } from 'express';
import { InternalMcpService } from '../internal-mcp.service';
import { User as UserModel } from '@/generated/client';
import { SearchService } from '@/modules/search/search.service';

@Injectable()
export class SearchTools {
  private readonly logger = new Logger(SearchTools.name);

  constructor(
    private readonly searchService: SearchService,
    private readonly internalMcpService: InternalMcpService,
  ) {}

  /**
   * Search internal resources, documents, and canvases
   */
  @Tool({
    name: 'search_internal',
    description: "Search user's internal resources, documents, and canvases",
    parameters: z.object({
      query: z.string().describe('Search query text'),
      limit: z.number().optional().describe('Maximum number of results to return (1-10)'),
      mode: z.enum(['keyword', 'vector', 'hybrid']).optional().describe('Search mode'),
      domains: z
        .array(z.enum(['resource', 'document', 'canvas']))
        .optional()
        .describe('Domains to search in'),
      projectId: z.string().optional().describe('Filter by project ID'),
      enableReranker: z.boolean().optional().describe('Enable result reranking'),
    }),
  })
  async searchInternal(
    params: {
      query: string;
      limit?: number;
      mode?: string;
      domains?: string[];
      projectId?: string;
      enableReranker?: boolean;
    },
    _context: Context,
    request: Request,
  ) {
    try {
      const user = request.user as UserModel;

      if (!user?.uid) {
        this.logger.error('User not found in request, MCP tool authentication may have failed');
        return {
          content: [{ type: 'text', text: 'Error: User authentication failed' }],
        };
      }

      this.logger.log(
        `Tool 'search_internal' called by user ${user.uid}, params: ${JSON.stringify(params)}`,
      );

      const searchRequest = {
        query: params.query,
        limit: Math.min(Math.max(params.limit || 5, 1), 10),
        mode: (params.mode as 'keyword' | 'vector' | 'hybrid') || 'keyword',
        domains: params.domains as ('resource' | 'document' | 'canvas')[] | undefined,
        projectId: params.projectId,
      };

      const results = await this.searchService.search(user, searchRequest, {
        enableReranker: params.enableReranker || false,
      });

      return this.internalMcpService.formatSuccessResponse({
        results,
        totalCount: results.length,
        query: params.query,
        searchMode: searchRequest.mode,
        domains: searchRequest.domains,
      });
    } catch (error) {
      this.logger.error(`Error in search_internal: ${error?.message || error}`);
      return this.internalMcpService.formatErrorResponse(error);
    }
  }

  /**
   * Search the web for information
   */
  @Tool({
    name: 'search_web',
    description: 'Search the web for information using external search engines',
    parameters: z.object({
      query: z.string().describe('Search query text'),
      limit: z.number().optional().describe('Maximum number of results to return'),
      locale: z.string().optional().describe('Search locale (e.g., en, zh-CN)'),
    }),
  })
  async searchWeb(
    params: { query: string; limit?: number; locale?: string },
    _context: Context,
    request: Request,
  ) {
    try {
      const user = request.user as UserModel;

      if (!user?.uid) {
        this.logger.error('User not found in request, MCP tool authentication may have failed');
        return {
          content: [{ type: 'text', text: 'Error: User authentication failed' }],
        };
      }

      this.logger.log(
        `Tool 'search_web' called by user ${user.uid}, params: ${JSON.stringify(params)}`,
      );

      const webSearchRequest = {
        queries: [
          {
            q: params.query,
            hl: params.locale || 'en',
          },
        ],
        limit: params.limit || 10,
      };

      const results = await this.searchService.webSearch(user, webSearchRequest);

      return this.internalMcpService.formatSuccessResponse({
        results,
        totalCount: results.length,
        query: params.query,
        locale: params.locale || 'en',
      });
    } catch (error) {
      this.logger.error(`Error in search_web: ${error?.message || error}`);
      return this.internalMcpService.formatErrorResponse(error);
    }
  }

  /**
   * Search the web with multiple languages and advanced options
   */
  @Tool({
    name: 'search_web_multilingual',
    description: 'Search the web with multiple languages, translation, and reranking capabilities',
    parameters: z.object({
      query: z.string().describe('Search query text'),
      searchLocaleList: z.array(z.string()).optional().describe('List of locales to search in'),
      displayLocale: z
        .string()
        .optional()
        .describe('Display locale for results (auto for auto-detection)'),
      searchLimit: z.number().optional().describe('Maximum number of search results'),
      enableRerank: z.boolean().optional().describe('Enable result reranking'),
      rerankLimit: z.number().optional().describe('Maximum number of results after reranking'),
      rerankRelevanceThreshold: z.number().optional().describe('Relevance threshold for reranking'),
    }),
  })
  async searchWebMultilingual(
    params: {
      query: string;
      searchLocaleList?: string[];
      displayLocale?: string;
      searchLimit?: number;
      enableRerank?: boolean;
      rerankLimit?: number;
      rerankRelevanceThreshold?: number;
    },
    _context: Context,
    request: Request,
  ) {
    try {
      const user = request.user as UserModel;

      if (!user?.uid) {
        this.logger.error('User not found in request, MCP tool authentication may have failed');
        return {
          content: [{ type: 'text', text: 'Error: User authentication failed' }],
        };
      }

      this.logger.log(
        `Tool 'search_web_multilingual' called by user ${user.uid}, params: ${JSON.stringify(params)}`,
      );

      const multilingualRequest = {
        query: params.query,
        searchLocaleList: params.searchLocaleList || ['en', 'zh-CN'],
        displayLocale: params.displayLocale || 'auto',
        searchLimit: params.searchLimit || 10,
        enableRerank: params.enableRerank || false,
        rerankLimit: params.rerankLimit,
        rerankRelevanceThreshold: params.rerankRelevanceThreshold || 0.1,
      };

      const result = await this.searchService.multiLingualWebSearch(user, multilingualRequest);

      return this.internalMcpService.formatSuccessResponse({
        sources: result.sources,
        searchSteps: result.searchSteps,
        totalCount: result.sources.length,
        query: params.query,
        searchLocales: params.searchLocaleList || ['en', 'zh-CN'],
        displayLocale: params.displayLocale || 'auto',
        enableRerank: params.enableRerank || false,
      });
    } catch (error) {
      this.logger.error(`Error in search_web_multilingual: ${error?.message || error}`);
      return this.internalMcpService.formatErrorResponse(error);
    }
  }
}
