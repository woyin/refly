import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/common/prisma.service';
import {
  Entity,
  ResourceMeta,
  ResourceType,
  SearchOptions,
  SearchRequest,
  SearchResult,
  User,
  WebSearchRequest,
  WebSearchResult,
  MultiLingualWebSearchRequest,
  BatchWebSearchRequest,
  Source,
  SearchStep,
  SearchDomain,
} from '@refly-packages/openapi-schema';
import { RAGService } from '@/rag/rag.service';
import { ElasticsearchService } from '@/common/elasticsearch.service';
import { ParamsError } from '@refly-packages/errors';
import { detectLanguage, TimeTracker } from '@refly-packages/utils';
import { searchResultsToSources, sourcesToSearchResults } from '@refly-packages/utils';

interface ProcessedSearchRequest extends SearchRequest {
  user?: User; // search user on behalf of
}

interface UserEntity extends Entity {
  user: User;
}

// Add interface for better type safety
interface SerperSearchResult {
  searchParameters: {
    q: string;
    hl: string;
    type: string;
    num: number;
    location: string;
    engine: string;
    gl: string;
  };
  organic: Array<{
    title: string;
    link: string;
    snippet: string;
    sitelinks?: { title: string; link: string }[];
    position: number;
  }>;
  knowledgeGraph?: {
    title: string;
    type: string;
    description?: string;
    descriptionUrl?: string;
    website?: string;
    imageUrl?: string;
    attributes?: Record<string, string>;
  };
  answerBox?: {
    title?: string;
    url?: string;
    snippet?: string;
    answer?: string;
  };
  peopleAlsoAsk?: Array<{
    question: string;
    link: string;
    snippet: string;
    title: string;
  }>;
  relatedSearches?: Array<{
    query: string;
  }>;
}

@Injectable()
export class SearchService {
  private logger = new Logger(SearchService.name);

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private elasticsearch: ElasticsearchService,
    private rag: RAGService,
  ) {}

  async preprocessSearchRequest(user: User, req: SearchRequest): Promise<ProcessedSearchRequest[]> {
    req.query = req.query?.trim() || '';

    if (!req.limit || req.limit <= 0) {
      req.limit = 5;
    }
    if (req.limit > 10) {
      req.limit = 10;
    }
    req.mode ??= 'keyword';

    if (req.mode === 'vector') {
      // Currently only resource and document are supported for vector search
      req.domains ??= ['resource', 'document'];
    } else {
      req.domains ??= ['resource', 'document', 'canvas'];
    }

    if (req.entities?.length > 0) {
      return this.groupSearchEntities(user, req);
    }

    return req.domains.map((domain) => ({ ...req, domains: [domain] }));
  }

  /**
   * Group search entities by user and domain
   */
  private async groupSearchEntities(
    user: User,
    req: SearchRequest,
  ): Promise<ProcessedSearchRequest[]> {
    if (req.entities.length > 20) {
      throw new ParamsError('Too many entities');
    }

    const entities = req.entities.filter((entity) =>
      ['resource', 'document'].includes(entity.entityType),
    );
    if (entities.length === 0) {
      return [];
    }

    const [resources, documents] = await Promise.all([
      this.processResourceEntities(user, entities),
      this.processDocumentEntities(user, entities),
    ]);
    const totalEntities = [...resources, ...documents];

    // Group entities by user.uid and entityType using generic type parameter
    const groupedEntities = totalEntities.reduce<Record<string, UserEntity[]>>((acc, entity) => {
      const key = `${entity.user.uid}-${entity.entityType}`;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(entity);
      return acc;
    }, {});

    // Convert grouped entities to ProcessedSearchRequest array
    return Object.values(groupedEntities).map((entities) => ({
      ...req,
      user: entities[0].user,
      domains: [entities[0].entityType as SearchDomain],
      entities: entities,
    }));
  }

  private async processResourceEntities(user: User, entities: Entity[]): Promise<UserEntity[]> {
    const resourceIds = entities
      .filter((entity) => entity.entityType === 'resource')
      .map((entity) => entity.entityId);

    if (resourceIds?.length === 0) {
      return [];
    }

    const resources = await this.prisma.resource.findMany({
      where: { resourceId: { in: resourceIds }, uid: user.uid, deletedAt: null },
    });

    return (resources ?? []).map((resource) => ({
      entityType: 'resource',
      entityId: resource.resourceId,
      user: user,
    }));
  }

  private async processDocumentEntities(user: User, entities: Entity[]): Promise<UserEntity[]> {
    const docIds = entities
      .filter((entity) => entity.entityType === 'document')
      .map((entity) => entity.entityId);

    if (docIds?.length === 0) {
      return [];
    }

    const documents = await this.prisma.document.findMany({
      where: {
        docId: { in: docIds },
        uid: user.uid,
        deletedAt: null,
      },
    });

    return (documents ?? []).map((document) => ({
      entityType: 'document',
      entityId: document.docId,
      user: { uid: document.uid },
    }));
  }

  async emptySearchResources(user: User, req: ProcessedSearchRequest): Promise<SearchResult[]> {
    const results = await this.prisma.resource.findMany({
      select: {
        resourceId: true,
        resourceType: true,
        title: true,
        contentPreview: true,
        createdAt: true,
        updatedAt: true,
      },
      where: {
        uid: user.uid,
        deletedAt: null,
      },
      orderBy: { updatedAt: 'desc' },
      take: req.limit || 5,
    });

    return results.map((result) => ({
      id: result.resourceId,
      domain: 'resource',
      title: result.title,
      highlightedTitle: result.title,
      contentPreview: result.contentPreview,
      snippets: [{ text: result.contentPreview, highlightedText: result.contentPreview }],
      metadata: {
        resourceType: result.resourceType as ResourceType,
      },
      createdAt: result.createdAt.toJSON(),
      updatedAt: result.updatedAt.toJSON(),
    }));
  }

  async searchResourcesByKeywords(
    user: User,
    req: ProcessedSearchRequest,
  ): Promise<SearchResult[]> {
    const hits = await this.elasticsearch.searchResources(req.user ?? user, req);

    return hits.map((hit) => ({
      id: hit._id,
      domain: 'resource',
      title: hit._source.title,
      highlightedTitle: hit.highlight?.title?.[0] || hit._source.title,
      contentPreview: `${hit._source.content?.slice(0, 500)}...`,
      snippets: [
        {
          text: hit._source.content,
          highlightedText: hit.highlight?.content?.[0] || hit._source.content,
        },
      ],
      metadata: {
        // TODO: confirm if metadata is used
        url: hit._source.url,
      },
      createdAt: hit._source.createdAt,
      updatedAt: hit._source.updatedAt,
    }));
  }

  async searchResourcesByVector(user: User, req: ProcessedSearchRequest): Promise<SearchResult[]> {
    const nodes = await this.rag.retrieve(req.user ?? user, {
      query: req.query,
      limit: req.limit,
      filter: {
        nodeTypes: ['resource'],
        resourceIds: req.entities?.map((entity) => entity.entityId),
        projectIds: req.projectId ? [req.projectId] : undefined,
      },
    });
    if (nodes.length === 0) {
      return [];
    }

    const resourceIds = [...new Set(nodes.map((node) => node.resourceId).filter((id) => !!id))];
    const resources = await this.prisma.resource.findMany({
      where: {
        resourceId: { in: resourceIds },
        deletedAt: null,
      },
    });
    const resourceMap = new Map(
      resources.map((resource) => [resource.resourceId, JSON.parse(resource.meta) as ResourceMeta]),
    );

    return nodes.map((node) => ({
      id: node.resourceId,
      domain: 'resource',
      title: node.title,
      highlightedTitle: node.title,
      contentPreview: `${node.content?.slice(0, 500)}...`,
      snippets: [{ text: node.content, highlightedText: node.content }],
      metadata: {
        url: node?.url,
        resourceMeta: resourceMap.get(node.resourceId),
        resourceType: node.resourceType,
      },
    }));
  }

  async searchResources(user: User, req: ProcessedSearchRequest): Promise<SearchResult[]> {
    if (req.query.length === 0) {
      return this.emptySearchResources(user, req);
    }

    switch (req.mode) {
      case 'keyword':
        return this.searchResourcesByKeywords(user, req);
      case 'vector':
        return this.searchResourcesByVector(user, req);
      case 'hybrid':
        throw new ParamsError('Not implemented');
      default:
        return this.searchResourcesByKeywords(user, req);
    }
  }

  async emptySearchDocuments(user: User, req: ProcessedSearchRequest): Promise<SearchResult[]> {
    const documents = await this.prisma.document.findMany({
      select: {
        docId: true,
        title: true,
        contentPreview: true,
        createdAt: true,
        updatedAt: true,
      },
      where: { uid: user.uid, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      take: req.limit || 5,
    });
    return documents.map((document) => ({
      id: document.docId,
      domain: 'document',
      title: document.title,
      highlightedTitle: document.title,
      contentPreview: document.contentPreview,
      snippets: [
        {
          text: document.contentPreview,
          highlightedText: document.contentPreview,
        },
      ],
      createdAt: document.createdAt.toJSON(),
      updatedAt: document.updatedAt.toJSON(),
    }));
  }

  async searchDocumentsByKeywords(
    user: User,
    req: ProcessedSearchRequest,
  ): Promise<SearchResult[]> {
    const hits = await this.elasticsearch.searchDocuments(req.user ?? user, req);

    return hits.map((hit) => ({
      id: hit._id,
      domain: 'document',
      title: hit._source.title,
      highlightedTitle: hit.highlight?.title?.[0] || hit._source.title,
      contentPreview: `${hit._source.content?.slice(0, 500)}...`,
      snippets: [
        {
          text: hit._source.content,
          highlightedText: hit.highlight?.content?.[0] || hit._source.content,
        },
      ],
      createdAt: hit._source.createdAt,
      updatedAt: hit._source.updatedAt,
    }));
  }

  async searchDocumentsByVector(user: User, req: ProcessedSearchRequest): Promise<SearchResult[]> {
    const nodes = await this.rag.retrieve(req.user ?? user, {
      query: req.query,
      limit: req.limit,
      filter: {
        nodeTypes: ['document'],
        docIds: req.entities?.map((entity) => entity.entityId),
        projectIds: req.projectId ? [req.projectId] : undefined,
      },
    });
    if (nodes.length === 0) {
      return [];
    }

    return nodes.map((node) => ({
      id: node.docId,
      domain: 'document',
      title: node.title,
      highlightedTitle: node.title,
      contentPreview: `${node.content?.slice(0, 500)}...`,
      snippets: [{ text: node.content, highlightedText: node.content }],
    }));
  }

  async searchDocuments(user: User, req: ProcessedSearchRequest): Promise<SearchResult[]> {
    if (req.query.length === 0) {
      return this.emptySearchDocuments(user, req);
    }

    switch (req.mode) {
      case 'keyword':
        return this.searchDocumentsByKeywords(user, req);
      case 'vector':
        return this.searchDocumentsByVector(user, req);
      case 'hybrid':
        throw new ParamsError('Not implemented');
      default:
        return this.searchDocumentsByKeywords(user, req);
    }
  }

  async emptySearchCanvases(user: User, req: ProcessedSearchRequest): Promise<SearchResult[]> {
    const canvases = await this.prisma.canvas.findMany({
      select: {
        canvasId: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
      where: { uid: user.uid, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      take: req.limit ?? 5,
    });

    return canvases.map((canvas) => ({
      id: canvas.canvasId,
      domain: 'canvas',
      title: canvas.title ?? '',
      highlightedTitle: canvas.title ?? '',
      contentPreview: '',
      snippets: [],
      createdAt: canvas.createdAt.toJSON(),
      updatedAt: canvas.updatedAt.toJSON(),
    }));
  }

  async searchCanvasesByKeywords(user: User, req: ProcessedSearchRequest): Promise<SearchResult[]> {
    const hits = await this.elasticsearch.searchCanvases(req.user ?? user, req);

    return hits.map((hit) => ({
      id: hit._id,
      domain: 'canvas',
      title: hit._source.title ?? '',
      highlightedTitle: hit.highlight?.title?.[0] ?? hit._source.title ?? '',
      contentPreview: '',
      snippets: [],
      createdAt: hit._source.createdAt,
      updatedAt: hit._source.updatedAt,
    }));
  }

  async searchCanvases(user: User, req: ProcessedSearchRequest): Promise<SearchResult[]> {
    if (!req.query?.length) {
      return this.emptySearchCanvases(user, req);
    }

    return this.searchCanvasesByKeywords(user, req);
  }

  async webSearch(
    _user: User,
    req: WebSearchRequest | BatchWebSearchRequest,
  ): Promise<WebSearchResult[]> {
    const limit = req?.limit || 10;

    try {
      const queries = 'queries' in req ? req.queries : [req];
      const queryPayload = queries.map((query) => ({
        ...query,
        num: limit,
        gl: 'us', // TODO: support multiple locales
        location: 'United States', // TODO: support multiple locations
      }));

      const res = await fetch('https://google.serper.dev/search', {
        method: 'post',
        headers: {
          'X-API-KEY': this.configService.get('credentials.serper'),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(queryPayload),
      });

      const jsonContent = await res.json();
      const results = this.parseSearchResults(jsonContent);

      return 'queries' in req ? results : results?.slice(0, limit);
    } catch (e) {
      this.logger.error(`Batch web search error: ${e}`);
      return [];
    }
  }

  // Helper to parse results consistently
  private parseSearchResults(jsonContent: any): WebSearchResult[] {
    const contexts: WebSearchResult[] = [];

    if (Array.isArray(jsonContent)) {
      // Handle batch results
      for (const result of jsonContent) {
        contexts.push(...this.parseSingleSearchResult(result));
      }
    } else {
      // Handle single result
      contexts.push(...this.parseSingleSearchResult(jsonContent));
    }

    return contexts;
  }

  private parseSingleSearchResult(result: SerperSearchResult): WebSearchResult[] {
    const contexts: WebSearchResult[] = [];
    const searchLocale = result.searchParameters?.hl || 'unknown';

    if (result.knowledgeGraph) {
      const url = result.knowledgeGraph.descriptionUrl || result.knowledgeGraph.website;
      const snippet = result.knowledgeGraph.description;
      if (url && snippet) {
        contexts.push({
          name: result.knowledgeGraph.title || '',
          url,
          snippet,
          locale: searchLocale,
        });
      }
    }

    if (result.answerBox) {
      const url = result.answerBox.url;
      const snippet = result.answerBox.snippet || result.answerBox.answer;
      if (url && snippet) {
        contexts.push({
          name: result.answerBox.title || '',
          url,
          snippet,
          locale: searchLocale,
        });
      }
    }

    if (result.organic) {
      for (const c of result.organic) {
        contexts.push({
          name: c.title,
          url: c.link,
          snippet: c.snippet || '',
          locale: searchLocale,
        });
      }
    }

    return contexts;
  }

  async search(user: User, req: SearchRequest, options?: SearchOptions): Promise<SearchResult[]> {
    const reqList = await this.preprocessSearchRequest(user, req);
    this.logger.log(`preprocessed search request: ${JSON.stringify(reqList)}`);

    const results = await Promise.all(
      reqList.map((req) => {
        switch (req.domains[0]) {
          case 'resource':
            return this.searchResources(user, req);
          case 'document':
            return this.searchDocuments(user, req);
          case 'canvas':
            return this.searchCanvases(user, req);
          default:
            return [] as SearchResult[];
        }
      }),
    );

    if (options?.enableReranker) {
      this.logger.log(`Reranker enabled for query: ${req.query}`);
      const rerankedResults = await this.rag.rerank(req.query, results.flat());
      this.logger.log(`Reranked results: ${JSON.stringify(rerankedResults)}`);

      return rerankedResults;
    }

    return results.flat();
  }

  async multiLingualWebSearch(
    user: User,
    req: MultiLingualWebSearchRequest,
  ): Promise<{ sources: Source[]; searchSteps: SearchStep[] }> {
    const {
      query,
      searchLocaleList = ['en', 'zh-CN'],
      displayLocale = 'auto',
      searchLimit = 10,
      enableRerank = false,
      rerankLimit,
      rerankRelevanceThreshold = 0.1,
    } = req;

    const timeTracker = new TimeTracker();
    let finalResults: Source[] = [];
    const searchSteps: SearchStep[] = [];

    try {
      const translatedDisplayLocale =
        displayLocale === 'auto' ? await detectLanguage(query) : displayLocale;

      // Step 1: Prepare queries for each locale
      const queries = searchLocaleList.map((locale) => ({
        q: query,
        hl: locale,
      }));

      // Step 2: Perform web search
      timeTracker.startStep('webSearch');
      const searchResults = await this.webSearch(user, {
        queries,
        limit: searchLimit,
      });
      const webSearchDuration = timeTracker.endStep('webSearch');
      this.logger.log(`Web search completed in ${webSearchDuration}ms`);

      searchSteps.push({
        step: 'webSearch',
        duration: webSearchDuration,
        result: {
          length: searchResults?.length,
          localeLength: searchLocaleList?.length,
        },
      });

      // Convert to Source format
      finalResults = searchResults.map((result) => ({
        url: result.url,
        title: result.name,
        pageContent: result.snippet,
        metadata: {
          originalLocale: result?.locale || 'unknown',
          translatedDisplayLocale,
        },
      }));

      if (enableRerank) {
        // Step 3: Rerank results if enabled
        timeTracker.startStep('rerank');
        try {
          const rerankResults = sourcesToSearchResults(finalResults);

          const rerankResponse = await this.rag.rerank(query, rerankResults, {
            topN: rerankLimit || rerankResults.length,
            relevanceThreshold: rerankRelevanceThreshold,
          });

          finalResults = searchResultsToSources(rerankResponse);

          this.logger.log(`Reranked results count: ${finalResults.length}`);
        } catch (error) {
          this.logger.error(`Error in reranking: ${error.stack}`);
          // Fallback to non-reranked results
        }
        const rerankDuration = timeTracker.endStep('rerank');
        this.logger.log(`Rerank completed in ${rerankDuration}ms`);

        searchSteps.push({
          step: 'rerank',
          duration: rerankDuration,
          result: {
            length: finalResults?.length,
          },
        });
      }

      const stepSummary = timeTracker.getSummary();
      const totalDuration = stepSummary.totalDuration;
      this.logger.log(`Total duration: ${totalDuration}ms`);

      searchSteps.push({
        step: 'finish',
        duration: totalDuration,
        result: {},
      });

      return {
        sources: finalResults,
        searchSteps,
      };
    } catch (error) {
      this.logger.error(`Error in multilingual web search: ${error.stack}`);
      throw error;
    }
  }
}
