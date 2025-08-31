import { z } from 'zod/v3';
import { ToolParams } from '@langchain/core/tools';
import { FirecrawlClient } from './client';
import { AgentBaseTool, AgentBaseToolset, AgentToolConstructor, ToolCallResult } from '../base';
import { ToolsetDefinition } from '@refly/openapi-schema';

export const FirecrawlToolsetDefinition: ToolsetDefinition = {
  key: 'firecrawl',
  domain: 'https://firecrawl.dev',
  labelDict: {
    en: 'Firecrawl',
    'zh-CN': 'Firecrawl',
  },
  descriptionDict: {
    en: 'Firecrawl is a powerful API service that takes URLs, crawls them, and converts them into clean markdown or structured data. Features advanced scraping, crawling, and AI-powered data extraction capabilities.',
    'zh-CN':
      'Firecrawl 是一个强大的 API 服务，可以抓取 URL，爬取内容，并将其转换为干净的 markdown 或结构化数据。具有高级抓取、爬取和 AI 驱动的数据提取功能。',
  },
  tools: [
    {
      name: 'scrape',
      descriptionDict: {
        en: 'Scrapes a single URL and returns content in LLM-ready formats (markdown, HTML, structured data, screenshots). Supports dynamic content, PDFs, and custom actions like clicking and scrolling.',
        'zh-CN':
          '抓取单个 URL 并以 LLM 就绪的格式返回内容（markdown、HTML、结构化数据、截图）。支持动态内容、PDF 和自定义操作，如点击和滚动。',
      },
    },
    {
      name: 'search',
      descriptionDict: {
        en: 'Searches the web and returns full content from results. Useful for answering questions about current events and getting comprehensive information from multiple sources.',
        'zh-CN':
          '搜索网络并从结果中返回完整内容。适用于回答有关当前事件的问题和从多个来源获取全面信息。',
      },
    },
    {
      name: 'crawl',
      descriptionDict: {
        en: 'Crawls a URL and all accessible subpages, returning content in LLM-ready format. Supports custom depth limits, path filtering, and batch processing for comprehensive website analysis.',
        'zh-CN':
          '爬取 URL 和所有可访问的子页面，以 LLM 就绪的格式返回内容。支持自定义深度限制、路径过滤和批处理，用于全面的网站分析。',
      },
    },
    {
      name: 'map',
      descriptionDict: {
        en: 'Maps a website to discover all URLs and links. Extremely fast for getting a complete overview of website structure without scraping content.',
        'zh-CN':
          '映射网站以发现所有 URL 和链接。非常快速地获取网站结构的完整概览，而无需抓取内容。',
      },
    },
    {
      name: 'extract',
      descriptionDict: {
        en: 'Uses AI to extract structured data from single pages, multiple pages, or entire websites. Supports custom schemas and natural language prompts for intelligent data extraction.',
        'zh-CN':
          '使用 AI 从单个页面、多个页面或整个网站提取结构化数据。支持自定义模式和自然语言提示，用于智能数据提取。',
      },
    },
  ],
  requiresAuth: true,
  authPatterns: [
    {
      type: 'credentials',
      credentialItems: [
        {
          key: 'apiKey',
          inputMode: 'text',
          inputProps: {
            passwordType: true,
          },
          labelDict: {
            en: 'API Key',
            'zh-CN': 'API 密钥',
          },
          descriptionDict: {
            en: 'The API key for Firecrawl',
            'zh-CN': 'Firecrawl 的 API 密钥',
          },
          required: true,
        },
      ],
    },
  ],
  configItems: [
    {
      key: 'baseUrl',
      inputMode: 'text',
      labelDict: {
        en: 'Base URL',
        'zh-CN': '基础 URL',
      },
      descriptionDict: {
        en: 'The base URL of Firecrawl service',
        'zh-CN': 'Firecrawl 服务的 URL',
      },
      defaultValue: 'https://api.firecrawl.dev/v1',
    },
  ],
};

interface FirecrawlToolParams extends ToolParams {
  apiKey: string;
  baseUrl?: string;
}

export class FirecrawlScrape extends AgentBaseTool<FirecrawlToolParams> {
  name = 'scrape';
  toolsetKey = FirecrawlToolsetDefinition.key;

  schema = z.object({
    url: z.string().describe('The URL to scrape'),
    formats: z
      .array(
        z.enum([
          'markdown',
          'html',
          'rawHtml',
          'links',
          'screenshot',
          'screenshot@fullPage',
          'json',
          'changeTracking',
        ]),
      )
      .describe('Output formats to return')
      .default(['markdown']),
    onlyMainContent: z.boolean().describe('Whether to extract only main content').default(true),
    includeTags: z.array(z.string()).describe('HTML tags to include').optional(),
    excludeTags: z.array(z.string()).describe('HTML tags to exclude').optional(),
    maxAge: z.number().describe('Maximum age of cached content in seconds').optional(),
    waitFor: z.number().describe('Time to wait for dynamic content in milliseconds').optional(),
    mobile: z.boolean().describe('Whether to use mobile user agent').default(false),
    parsePDF: z.boolean().describe('Whether to parse PDF content').default(false),
  });

  description =
    'Scrapes a single URL and returns content in LLM-ready formats (markdown, HTML, structured data, screenshots). Supports dynamic content, PDFs, and custom actions like clicking and scrolling.';

  protected params: FirecrawlToolParams;

  constructor(params: FirecrawlToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const client = new FirecrawlClient({
        apiKey: this.params.apiKey,
        baseUrl: this.params.baseUrl,
      });

      const data = await client.scrape({
        url: input.url,
        formats: input.formats,
        onlyMainContent: input.onlyMainContent,
        includeTags: input.includeTags,
        excludeTags: input.excludeTags,
        maxAge: input.maxAge,
        waitFor: input.waitFor,
        mobile: input.mobile,
        parsePDF: input.parsePDF,
      });

      // Return markdown if available, otherwise return the full response
      if (input.formats.includes('markdown') && data.data?.markdown) {
        return {
          status: 'success',
          data: { content: data.data.markdown, fullResponse: data.data },
          summary: `Successfully scraped URL: ${input.url} and extracted markdown content`,
        };
      }

      // Return structured data for other formats
      return {
        status: 'success',
        data: data.data,
        summary: `Successfully scraped URL: ${input.url} in requested formats`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error scraping URL',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while scraping URL',
      };
    }
  }
}

export class FirecrawlSearch extends AgentBaseTool<FirecrawlToolParams> {
  name = 'search';
  toolsetKey = FirecrawlToolsetDefinition.key;

  schema = z.object({
    query: z.string().describe('The search query to execute'),
    limit: z.number().describe('The number of results to return').default(5),
    tbs: z.string().describe('Time-based search filter (e.g., "qdr:d" for last day)').optional(),
    location: z.string().describe('Geographic location for search results').optional(),
    timeout: z.number().describe('Timeout for search operation in seconds').default(30),
    ignoreInvalidURLs: z
      .boolean()
      .describe('Whether to ignore invalid URLs in results')
      .default(false),
  });

  description =
    'Searches the web and returns full content from results. Useful for answering questions about current events and getting comprehensive information from multiple sources.';

  protected params: FirecrawlToolParams;

  constructor(params: FirecrawlToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const client = new FirecrawlClient({
        apiKey: this.params.apiKey,
      });

      const data = await client.search({
        query: input.query,
        limit: input.limit,
        tbs: input.tbs,
        location: input.location,
        timeout: input.timeout,
        ignoreInvalidURLs: input.ignoreInvalidURLs,
      });

      return {
        status: 'success',
        data: data,
        summary: `Successfully performed web search for query: "${input.query}" and found ${data.data?.length ?? 0} results`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error performing web search',
        summary:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while performing web search',
      };
    }
  }
}

export class FirecrawlCrawl extends AgentBaseTool<FirecrawlToolParams> {
  name = 'crawl';
  toolsetKey = FirecrawlToolsetDefinition.key;

  schema = z.object({
    url: z.string().describe('The starting URL to crawl'),
    maxDepth: z.number().describe('Maximum depth of crawling').default(2),
    maxDiscoveryDepth: z.number().describe('Maximum depth for discovering new URLs').default(3),
    limit: z.number().describe('Maximum number of pages to crawl').default(10),
    excludePaths: z.array(z.string()).describe('Paths to exclude from crawling').optional(),
    includePaths: z.array(z.string()).describe('Paths to include in crawling').optional(),
    delay: z.number().describe('Delay between requests in milliseconds').default(1000),
    ignoreSitemap: z.boolean().describe('Whether to ignore sitemap.xml').default(false),
    ignoreQueryParameters: z
      .boolean()
      .describe('Whether to ignore query parameters in URLs')
      .default(false),
    allowBackwardLinks: z
      .boolean()
      .describe('Whether to allow crawling backward links')
      .default(false),
    allowExternalLinks: z
      .boolean()
      .describe('Whether to allow crawling external links')
      .default(false),
  });

  description =
    'Crawls a URL and all accessible subpages, returning content in LLM-ready format. Supports custom depth limits, path filtering, and batch processing for comprehensive website analysis.';

  protected params: FirecrawlToolParams;

  constructor(params: FirecrawlToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const client = new FirecrawlClient({
        apiKey: this.params.apiKey,
        baseUrl: this.params.baseUrl,
      });

      const crawlResponse = await client.crawl({
        url: input.url,
        maxDepth: input.maxDepth,
        maxDiscoveryDepth: input.maxDiscoveryDepth,
        limit: input.limit,
        excludePaths: input.excludePaths,
        includePaths: input.includePaths,
        delay: input.delay,
        ignoreSitemap: input.ignoreSitemap,
        ignoreQueryParameters: input.ignoreQueryParameters,
        allowBackwardLinks: input.allowBackwardLinks,
        allowExternalLinks: input.allowExternalLinks,
      });

      // Return the crawl ID and instructions for checking status
      return {
        status: 'success',
        data: {
          crawlId: crawlResponse.id,
          message:
            'Crawl started successfully. Use the crawl ID to check status and retrieve results.',
          statusUrl: `https://api.firecrawl.dev/v1/crawl/${crawlResponse.id}`,
        },
        summary: `Successfully started crawling website: ${input.url} with max depth ${input.maxDepth}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error crawling website',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while crawling website',
      };
    }
  }
}

export class FirecrawlMap extends AgentBaseTool<FirecrawlToolParams> {
  name = 'map';
  toolsetKey = FirecrawlToolsetDefinition.key;

  schema = z.object({
    url: z.string().describe('The URL to map'),
    limit: z.number().describe('Maximum number of links to discover').default(100),
    includeSubdomains: z.boolean().describe('Whether to include subdomains').default(false),
    search: z.string().describe('Search term to filter links').optional(),
    ignoreSitemap: z.boolean().describe('Whether to ignore sitemap.xml').default(false),
    sitemapOnly: z.boolean().describe('Whether to only use sitemap for mapping').default(false),
    timeout: z.number().describe('Timeout for the mapping operation in seconds').default(30),
  });

  description =
    'Maps a website to discover all URLs and links. Extremely fast for getting a complete overview of website structure without scraping content.';

  protected params: FirecrawlToolParams;

  constructor(params: FirecrawlToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const client = new FirecrawlClient({
        apiKey: this.params.apiKey,
        baseUrl: this.params.baseUrl,
      });

      const data = await client.map({
        url: input.url,
        limit: input.limit,
        includeSubdomains: input.includeSubdomains,
        search: input.search,
        ignoreSitemap: input.ignoreSitemap,
        sitemapOnly: input.sitemapOnly,
        timeout: input.timeout,
      });

      return {
        status: 'success',
        data: data,
        summary: `Successfully mapped website: ${input.url} and discovered ${data.links?.length ?? 0} links`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error mapping website',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while mapping website',
      };
    }
  }
}

export class FirecrawlExtract extends AgentBaseTool<FirecrawlToolParams> {
  name = 'extract';
  toolsetKey = FirecrawlToolsetDefinition.key;

  schema = z.object({
    urls: z.array(z.string()).describe('Array of URLs to extract data from'),
    prompt: z.string().describe('Natural language prompt describing what to extract').optional(),
    schema: z
      .record(z.any())
      .describe('JSON schema defining the structure of data to extract')
      .optional(),
    enableWebSearch: z
      .boolean()
      .describe('Whether to enable web search for additional context')
      .default(false),
    showSources: z
      .boolean()
      .describe('Whether to include source URLs in the response')
      .default(true),
    ignoreSitemap: z.boolean().describe('Whether to ignore sitemap.xml').default(false),
    includeSubdomains: z.boolean().describe('Whether to include subdomains').default(false),
    ignoreInvalidURLs: z.boolean().describe('Whether to ignore invalid URLs').default(false),
  });

  description =
    'Uses AI to extract structured data from single pages, multiple pages, or entire websites. Supports custom schemas and natural language prompts for intelligent data extraction.';

  protected params: FirecrawlToolParams;

  constructor(params: FirecrawlToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const client = new FirecrawlClient({
        apiKey: this.params.apiKey,
        baseUrl: this.params.baseUrl,
      });

      const extractResponse = await client.extract({
        urls: input.urls,
        prompt: input.prompt,
        schema: input.schema,
        enableWebSearch: input.enableWebSearch,
        showSources: input.showSources,
        ignoreSitemap: input.ignoreSitemap,
        includeSubdomains: input.includeSubdomains,
        ignoreInvalidURLs: input.ignoreInvalidURLs,
      });

      // Return the extract ID and instructions for checking status
      return {
        status: 'success',
        data: {
          extractId: extractResponse.id,
          message:
            'Data extraction started successfully. Use the extract ID to check status and retrieve results.',
          statusUrl: `https://api.firecrawl.dev/v1/extract/${extractResponse.id}`,
        },
        summary: `Successfully started data extraction from ${input.urls.length} URLs using AI extraction`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error extracting data',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while extracting data',
      };
    }
  }
}

export class FirecrawlToolset extends AgentBaseToolset<FirecrawlToolParams> {
  toolsetKey = FirecrawlToolsetDefinition.key;
  tools = [
    FirecrawlScrape,
    FirecrawlSearch,
    FirecrawlCrawl,
    FirecrawlMap,
    FirecrawlExtract,
  ] satisfies readonly AgentToolConstructor<FirecrawlToolParams>[];
}
