import { z } from 'zod/v3';
import { AgentBaseTool, AgentBaseToolset, AgentToolConstructor, ToolCallResult } from '../base';
import { ToolsetDefinition } from '@refly/openapi-schema';
import notion from '@notionhq/client';

export const NotionToolsetDefinition: ToolsetDefinition = {
  key: 'notion',
  domain: 'https://notion.so',
  labelDict: {
    en: 'Notion',
    'zh-CN': 'Notion',
  },
  descriptionDict: {
    en: 'Access and manage pages, databases, and content in Notion. Create, read, update, and organize your workspace.',
    'zh-CN': '访问和管理 Notion 中的页面、数据库和内容。创建、读取、更新和组织您的工作空间。',
  },
  tools: [
    {
      name: 'create_page',
      descriptionDict: {
        en: 'Create a new page in Notion with specified content and properties.',
        'zh-CN': '在 Notion 中创建一个新页面，包含指定的内容和属性。',
      },
    },
    {
      name: 'retrieve_page',
      descriptionDict: {
        en: 'Get detailed information about a specific page including its content and properties.',
        'zh-CN': '获取特定页面的详细信息，包括其内容和属性。',
      },
    },
    {
      name: 'update_page',
      descriptionDict: {
        en: 'Update page properties, content, or metadata.',
        'zh-CN': '更新页面属性、内容或元数据。',
      },
    },
    {
      name: 'search_pages',
      descriptionDict: {
        en: 'Search for pages in Notion workspace using query parameters.',
        'zh-CN': '使用查询参数在 Notion 工作空间中搜索页面。',
      },
    },
    {
      name: 'create_database',
      descriptionDict: {
        en: 'Create a new database with specified schema and properties.',
        'zh-CN': '创建一个新数据库，包含指定的模式和属性。',
      },
    },
    {
      name: 'query_database',
      descriptionDict: {
        en: 'Query a database with filters, sorts, and pagination.',
        'zh-CN': '使用过滤器、排序和分页查询数据库。',
      },
    },
    {
      name: 'retrieve_database',
      descriptionDict: {
        en: 'Get detailed information about a specific database including its schema.',
        'zh-CN': '获取特定数据库的详细信息，包括其模式。',
      },
    },
    {
      name: 'append_block',
      descriptionDict: {
        en: 'Append content blocks to an existing page or block.',
        'zh-CN': '向现有页面或块追加内容块。',
      },
    },
    {
      name: 'retrieve_block',
      descriptionDict: {
        en: 'Get detailed information about a specific block.',
        'zh-CN': '获取特定块的详细信息。',
      },
    },
    {
      name: 'update_block',
      descriptionDict: {
        en: 'Update the content or properties of a block.',
        'zh-CN': '更新块的内容或属性。',
      },
    },
    {
      name: 'list_users',
      descriptionDict: {
        en: 'List all users in the Notion workspace.',
        'zh-CN': '列出 Notion 工作空间中的所有用户。',
      },
    },
  ],
  requiresAuth: true,
  authPatterns: [
    {
      type: 'oauth',
      provider: 'notion',
      scope: ['read_content', 'update_content', 'insert_content'],
    },
  ],
  configItems: [],
};

// OAuth2 parameters will be automatically injected
export interface NotionParams {
  accessToken: string;
}

// Helper function to create authenticated Notion client
function createNotionClient(params: NotionParams): any {
  // @ts-ignore
  return new notion.Client({
    auth: params.accessToken,
    notionVersion: '2025-09-03',
  });
}

export class NotionCreatePage extends AgentBaseTool<NotionParams> {
  name = 'create_page';
  toolsetKey = NotionToolsetDefinition.key;

  schema = z.object({
    parentId: z.string().describe('The ID of the parent page or database'),
    title: z.string().describe('Title of the new page'),
    content: z.string().optional().describe('Page content in Markdown format'),
    properties: z.record(z.any()).optional().describe('Page properties as JSON object'),
  });

  description = 'Create a new page in Notion with specified content and properties.';

  protected params: NotionParams;

  constructor(params: NotionParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const notion = createNotionClient(this.params);

      const pageData: any = {
        parent: {
          page_id: input.parentId,
        },
        properties: {
          title: {
            title: [
              {
                text: {
                  content: input.title,
                },
              },
            ],
          },
          ...(input.properties || {}),
        },
      };

      // Add content blocks if provided
      if (input.content) {
        const blocks = this.markdownToBlocks(input.content);
        if (blocks.length > 0) {
          pageData.children = blocks;
        }
      }

      const response = await notion.pages.create(pageData);

      const result = {
        message: 'Page created successfully',
        page: {
          id: response.id,
          title: input.title,
          url: (response as any).url,
          created_time: (response as any).created_time,
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully created page: ${input.title}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error creating page',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while creating page',
      };
    }
  }

  private markdownToBlocks(markdown: string): any[] {
    // Simple markdown to Notion blocks conversion
    // This is a basic implementation - in production you'd want more comprehensive parsing
    const lines = markdown.split('\n');
    const blocks: any[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith('# ')) {
        blocks.push({
          type: 'heading_1',
          heading_1: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: trimmed.substring(2),
                },
              },
            ],
          },
        });
      } else if (trimmed.startsWith('## ')) {
        blocks.push({
          type: 'heading_2',
          heading_2: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: trimmed.substring(3),
                },
              },
            ],
          },
        });
      } else if (trimmed.startsWith('- ')) {
        blocks.push({
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: trimmed.substring(2),
                },
              },
            ],
          },
        });
      } else {
        blocks.push({
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: trimmed,
                },
              },
            ],
          },
        });
      }
    }

    return blocks;
  }
}

export class NotionRetrievePage extends AgentBaseTool<NotionParams> {
  name = 'retrieve_page';
  toolsetKey = NotionToolsetDefinition.key;

  schema = z.object({
    pageId: z.string().describe('The ID of the page to retrieve'),
  });

  description =
    'Get detailed information about a specific page including its content and properties.';

  protected params: NotionParams;

  constructor(params: NotionParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const notion = createNotionClient(this.params);

      const response = await notion.pages.retrieve({
        page_id: input.pageId,
      });

      const result = {
        message: 'Page retrieved successfully',
        page: {
          id: response.id,
          title: this.extractTitle(response),
          url: (response as any).url,
          created_time: (response as any).created_time,
          last_edited_time: (response as any).last_edited_time,
          properties: (response as any).properties,
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully retrieved page: ${result.page.title}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error retrieving page',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while retrieving page',
      };
    }
  }

  private extractTitle(page: any): string {
    const titleProperty = Object.values(page.properties).find(
      (prop: any) => prop.type === 'title',
    ) as any;

    if (titleProperty?.title?.[0]?.plain_text) {
      return titleProperty.title[0].plain_text;
    }

    return 'Untitled';
  }
}

export class NotionUpdatePage extends AgentBaseTool<NotionParams> {
  name = 'update_page';
  toolsetKey = NotionToolsetDefinition.key;

  schema = z.object({
    pageId: z.string().describe('The ID of the page to update'),
    title: z.string().optional().describe('New title for the page'),
    properties: z.record(z.any()).optional().describe('Properties to update'),
    archived: z.boolean().optional().describe('Whether to archive the page'),
  });

  description = 'Update page properties, content, or metadata.';

  protected params: NotionParams;

  constructor(params: NotionParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const notion = createNotionClient(this.params);

      const updateData: any = {};

      if (input.title) {
        updateData.properties = {
          title: {
            title: [
              {
                text: {
                  content: input.title,
                },
              },
            ],
          },
        };
      }

      if (input.properties) {
        updateData.properties = {
          ...updateData.properties,
          ...input.properties,
        };
      }

      if (input.archived !== undefined) {
        updateData.archived = input.archived;
      }

      const response = await notion.pages.update({
        page_id: input.pageId,
        ...updateData,
      });

      const result = {
        message: 'Page updated successfully',
        page: {
          id: response.id,
          title: this.extractTitle(response),
          last_edited_time: (response as any).last_edited_time,
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully updated page: ${result.page.title}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error updating page',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while updating page',
      };
    }
  }

  private extractTitle(page: any): string {
    const titleProperty = Object.values(page.properties).find(
      (prop: any) => prop.type === 'title',
    ) as any;

    if (titleProperty?.title?.[0]?.plain_text) {
      return titleProperty.title[0].plain_text;
    }

    return 'Untitled';
  }
}

export class NotionSearchPages extends AgentBaseTool<NotionParams> {
  name = 'search_pages';
  toolsetKey = NotionToolsetDefinition.key;

  schema = z.object({
    query: z.string().optional().describe('Search query string'),
    filter: z.record(z.any()).optional().describe('Filter criteria as JSON object'),
    sort: z.record(z.any()).optional().describe('Sort criteria as JSON object'),
    pageSize: z.number().optional().describe('Maximum number of results to return (default: 10)'),
  });

  description = 'Search for pages in Notion workspace using query parameters.';

  protected params: NotionParams;

  constructor(params: NotionParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const notion = createNotionClient(this.params);

      const searchParams: any = {
        page_size: input.pageSize ?? 10,
      };

      if (input.query) {
        searchParams.query = input.query;
      }

      if (input.filter) {
        searchParams.filter = input.filter;
      }

      if (input.sort) {
        searchParams.sort = input.sort;
      }

      const response = await notion.search(searchParams);

      const pages = response.results.map((page: any) => ({
        id: page.id,
        title: this.extractTitle(page),
        url: page.url,
        object: page.object,
        created_time: page.created_time,
        last_edited_time: page.last_edited_time,
      }));

      const result = {
        message: `Found ${pages.length} pages`,
        count: pages.length,
        pages,
        has_more: response.has_more,
        next_cursor: response.next_cursor,
      };

      return {
        status: 'success',
        data: result,
        summary: `Search completed successfully. Found ${pages.length} pages.`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error searching pages',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while searching pages',
      };
    }
  }

  private extractTitle(page: any): string {
    if (page.object === 'database') {
      const titleProperty = page.title?.[0]?.plain_text;
      return titleProperty || 'Untitled Database';
    }

    const titleProperty = Object.values(page.properties || {}).find(
      (prop: any) => prop.type === 'title',
    ) as any;

    if (titleProperty?.title?.[0]?.plain_text) {
      return titleProperty.title[0].plain_text;
    }

    return 'Untitled';
  }
}

export class NotionCreateDatabase extends AgentBaseTool<NotionParams> {
  name = 'create_database';
  toolsetKey = NotionToolsetDefinition.key;

  schema = z.object({
    parentId: z.string().describe('The ID of the parent page'),
    title: z.string().describe('Title of the new database'),
    properties: z.record(z.any()).describe('Database properties schema as JSON object'),
  });

  description = 'Create a new database with specified schema and properties.';

  protected params: NotionParams;

  constructor(params: NotionParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const notion = createNotionClient(this.params);

      const databaseData: any = {
        parent: {
          type: 'page_id',
          page_id: input.parentId,
        },
        title: [
          {
            type: 'text',
            text: {
              content: input.title,
            },
          },
        ],
        properties: input.properties,
      };

      const response = await notion.databases.create(databaseData);

      const result = {
        message: 'Database created successfully',
        database: {
          id: response.id,
          title: input.title,
          url: (response as any).url,
          created_time: (response as any).created_time,
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully created database: ${input.title}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error creating database',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while creating database',
      };
    }
  }
}

export class NotionQueryDatabase extends AgentBaseTool<NotionParams> {
  name = 'query_database';
  toolsetKey = NotionToolsetDefinition.key;

  schema = z.object({
    databaseId: z.string().describe('The ID of the database to query'),
    filter: z.record(z.any()).optional().describe('Filter criteria as JSON object'),
    sorts: z.array(z.record(z.any())).optional().describe('Sort criteria as array of JSON objects'),
    pageSize: z.number().optional().describe('Maximum number of results to return (default: 10)'),
    startCursor: z.string().optional().describe('Cursor for pagination'),
  });

  description = 'Query a database with filters, sorts, and pagination.';

  protected params: NotionParams;

  constructor(params: NotionParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const notion = createNotionClient(this.params);

      const queryParams: any = {
        database_id: input.databaseId,
        page_size: input.pageSize ?? 10,
      };

      if (input.filter) {
        queryParams.filter = input.filter;
      }

      if (input.sorts) {
        queryParams.sorts = input.sorts;
      }

      if (input.startCursor) {
        queryParams.start_cursor = input.startCursor;
      }

      const response = await (notion.databases as any).query(queryParams);

      const results = response.results.map((item: any) => ({
        id: item.id,
        title: this.extractTitle(item),
        url: item.url,
        created_time: item.created_time,
        last_edited_time: item.last_edited_time,
        properties: item.properties,
      }));

      const result = {
        message: `Found ${results.length} items`,
        count: results.length,
        items: results,
        has_more: response.has_more,
        next_cursor: response.next_cursor,
      };

      return {
        status: 'success',
        data: result,
        summary: `Query completed successfully. Found ${results.length} items.`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error querying database',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while querying database',
      };
    }
  }

  private extractTitle(item: any): string {
    const titleProperty = Object.values(item.properties).find(
      (prop: any) => prop.type === 'title',
    ) as any;

    if (titleProperty?.title?.[0]?.plain_text) {
      return titleProperty.title[0].plain_text;
    }

    return 'Untitled';
  }
}

export class NotionRetrieveDatabase extends AgentBaseTool<NotionParams> {
  name = 'retrieve_database';
  toolsetKey = NotionToolsetDefinition.key;

  schema = z.object({
    databaseId: z.string().describe('The ID of the database to retrieve'),
  });

  description = 'Get detailed information about a specific database including its schema.';

  protected params: NotionParams;

  constructor(params: NotionParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const notion = createNotionClient(this.params);

      const response = await notion.databases.retrieve({
        database_id: input.databaseId,
      });

      const result = {
        message: 'Database retrieved successfully',
        database: {
          id: response.id,
          title: response.title?.[0]?.plain_text || 'Untitled Database',
          url: response.url,
          created_time: response.created_time,
          last_edited_time: response.last_edited_time,
          properties: response.properties,
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully retrieved database: ${result.database.title}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error retrieving database',
        summary:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while retrieving database',
      };
    }
  }
}

export class NotionAppendBlock extends AgentBaseTool<NotionParams> {
  name = 'append_block';
  toolsetKey = NotionToolsetDefinition.key;

  schema = z.object({
    parentId: z.string().describe('The ID of the parent page or block'),
    content: z.string().describe('Content to append in Markdown format'),
  });

  description = 'Append content blocks to an existing page or block.';

  protected params: NotionParams;

  constructor(params: NotionParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const notion = createNotionClient(this.params);

      const blocks = this.markdownToBlocks(input.content);

      if (blocks.length === 0) {
        return {
          status: 'success',
          data: { message: 'No content to append' },
          summary: 'No content to append',
        };
      }

      await notion.blocks.children.append({
        block_id: input.parentId,
        children: blocks,
      });

      const result = {
        message: 'Blocks appended successfully',
        block_count: blocks.length,
        parent_id: input.parentId,
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully appended ${blocks.length} blocks`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error appending blocks',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while appending blocks',
      };
    }
  }

  private markdownToBlocks(markdown: string): any[] {
    const lines = markdown.split('\n');
    const blocks: any[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith('# ')) {
        blocks.push({
          type: 'heading_1',
          heading_1: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: trimmed.substring(2),
                },
              },
            ],
          },
        });
      } else if (trimmed.startsWith('## ')) {
        blocks.push({
          type: 'heading_2',
          heading_2: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: trimmed.substring(3),
                },
              },
            ],
          },
        });
      } else if (trimmed.startsWith('- ')) {
        blocks.push({
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: trimmed.substring(2),
                },
              },
            ],
          },
        });
      } else {
        blocks.push({
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: trimmed,
                },
              },
            ],
          },
        });
      }
    }

    return blocks;
  }
}

export class NotionRetrieveBlock extends AgentBaseTool<NotionParams> {
  name = 'retrieve_block';
  toolsetKey = NotionToolsetDefinition.key;

  schema = z.object({
    blockId: z.string().describe('The ID of the block to retrieve'),
  });

  description = 'Get detailed information about a specific block.';

  protected params: NotionParams;

  constructor(params: NotionParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const notion = createNotionClient(this.params);

      const response = await notion.blocks.retrieve({
        block_id: input.blockId,
      });

      const result = {
        message: 'Block retrieved successfully',
        block: {
          id: response.id,
          type: response.type,
          has_children: response.has_children,
          created_time: response.created_time,
          last_edited_time: response.last_edited_time,
          [response.type]: response[response.type as keyof typeof response],
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully retrieved ${response.type} block`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error retrieving block',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while retrieving block',
      };
    }
  }
}

export class NotionUpdateBlock extends AgentBaseTool<NotionParams> {
  name = 'update_block';
  toolsetKey = NotionToolsetDefinition.key;

  schema = z.object({
    blockId: z.string().describe('The ID of the block to update'),
    content: z.string().describe('New content for the block'),
    type: z.string().optional().describe('Block type (paragraph, heading_1, etc.)'),
  });

  description = 'Update the content or properties of a block.';

  protected params: NotionParams;

  constructor(params: NotionParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const notion = createNotionClient(this.params);

      const blockType = input.type || 'paragraph';

      const updateData: any = {
        [blockType]: {
          rich_text: [
            {
              type: 'text',
              text: {
                content: input.content,
              },
            },
          ],
        },
      };

      const response = await notion.blocks.update({
        block_id: input.blockId,
        ...updateData,
      });

      const result = {
        message: 'Block updated successfully',
        block: {
          id: response.id,
          type: response.type,
          last_edited_time: response.last_edited_time,
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully updated ${response.type} block`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error updating block',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while updating block',
      };
    }
  }
}

export class NotionListUsers extends AgentBaseTool<NotionParams> {
  name = 'list_users';
  toolsetKey = NotionToolsetDefinition.key;

  schema = z.object({});

  description = 'List all users in the Notion workspace.';

  protected params: NotionParams;

  constructor(params: NotionParams) {
    super(params);
    this.params = params;
  }

  async _call(_input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const notion = createNotionClient(this.params);

      const response = await notion.users.list({});

      const users = response.results.map((user: any) => ({
        id: user.id,
        name: user.name,
        type: user.type,
        avatar_url: user.avatar_url,
      }));

      const result = {
        message: `Found ${users.length} users`,
        count: users.length,
        users,
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully retrieved ${users.length} users from workspace`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error listing users',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while listing users',
      };
    }
  }
}

export class NotionToolset extends AgentBaseToolset<NotionParams> {
  toolsetKey = NotionToolsetDefinition.key;
  tools = [
    NotionCreatePage,
    NotionRetrievePage,
    NotionUpdatePage,
    NotionSearchPages,
    NotionCreateDatabase,
    NotionQueryDatabase,
    NotionRetrieveDatabase,
    NotionAppendBlock,
    NotionRetrieveBlock,
    NotionUpdateBlock,
    NotionListUsers,
  ] satisfies readonly AgentToolConstructor<NotionParams>[];
}
