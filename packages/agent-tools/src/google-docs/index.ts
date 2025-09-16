import { z } from 'zod/v3';
import { AgentBaseTool, AgentBaseToolset, AgentToolConstructor, ToolCallResult } from '../base';
import { ToolsetDefinition } from '@refly/openapi-schema';
import { google } from 'googleapis';
import { ToolParams } from '@langchain/core/tools';

export const GoogleDocsToolsetDefinition: ToolsetDefinition = {
  key: 'google_docs',
  domain: 'https://docs.google.com',
  labelDict: {
    en: 'Google Docs',
    'zh-CN': 'Google 文档',
  },
  descriptionDict: {
    en: 'Access and manage Google Docs documents. Create, read, update, export, and manage Google Docs.',
    'zh-CN': '访问和管理 Google 文档。创建、读取、更新、导出和管理 Google 文档。',
  },
  tools: [
    {
      name: 'create_document',
      descriptionDict: {
        en: 'Create a new Google Doc with specified title and content.',
        'zh-CN': '创建一个新的 Google 文档，包含指定的标题和内容。',
      },
    },
    {
      name: 'get_document',
      descriptionDict: {
        en: 'Get the content of a Google Doc by its ID.',
        'zh-CN': '通过 ID 获取 Google 文档的内容。',
      },
    },
    {
      name: 'update_document',
      descriptionDict: {
        en: 'Update the content of a Google Doc by appending or replacing text.',
        'zh-CN': '通过追加或替换文本来更新 Google 文档的内容。',
      },
    },
    {
      name: 'export_document',
      descriptionDict: {
        en: 'Export a Google Doc to various formats (PDF, Word, etc.).',
        'zh-CN': '将 Google 文档导出为各种格式（PDF、Word 等）。',
      },
    },
    {
      name: 'delete_document',
      descriptionDict: {
        en: 'Delete a Google Doc by its ID.',
        'zh-CN': '通过 ID 删除 Google 文档。',
      },
    },
    {
      name: 'search_documents',
      descriptionDict: {
        en: 'Search for Google Docs using query parameters.',
        'zh-CN': '使用查询参数搜索 Google 文档。',
      },
    },
  ],
  requiresAuth: true,
  authPatterns: [
    {
      type: 'oauth',
      provider: 'google',
      scope: ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/documents'],
    },
  ],
  configItems: [
    {
      key: 'redirectUri',
      inputMode: 'text',
      labelDict: {
        en: 'Redirect URI',
        'zh-CN': '重定向 URI',
      },
      descriptionDict: {
        en: 'The OAuth 2.0 redirect URI configured in Google Cloud Console',
        'zh-CN': '在 Google Cloud Console 中配置的 OAuth 2.0 重定向 URI',
      },
      defaultValue: 'http://localhost:3000/oauth2callback',
    },
  ],
};

//automatic assemble clientId, clientSecret, refreshToken, accessToken if authType is oauth
export interface GoogleDocsParams extends ToolParams {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  accessToken: string;
  redirectUri?: string;
}

// Helper function to create authenticated Docs service
function createDocsService(params: GoogleDocsParams) {
  const oauth2Client = new google.auth.OAuth2(
    params.clientId,
    params.clientSecret,
    params.redirectUri ?? 'http://localhost:3000/oauth2callback',
  );

  oauth2Client.setCredentials({
    refresh_token: params.refreshToken,
  });

  return google.docs({ version: 'v1', auth: oauth2Client });
}

// Helper function to create authenticated Drive service (for file operations)
function createDriveService(params: GoogleDocsParams) {
  const oauth2Client = new google.auth.OAuth2(
    params.clientId,
    params.clientSecret,
    params.redirectUri ?? 'http://localhost:3000/oauth2callback',
  );

  oauth2Client.setCredentials({
    refresh_token: params.refreshToken,
  });

  return google.drive({ version: 'v3', auth: oauth2Client });
}

export class GoogleDocsCreateDocument extends AgentBaseTool<GoogleDocsParams> {
  name = 'create_document';
  toolsetKey = GoogleDocsToolsetDefinition.key;

  schema = z.object({
    title: z.string().describe('Title of the document to create'),
    content: z.string().optional().describe('Initial content to add to the document'),
  });
  description = 'Create a new Google Doc with specified title and content.';

  protected params: GoogleDocsParams;

  constructor(params: GoogleDocsParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const drive = createDriveService(this.params);

      // Create the document file
      const fileMetadata = {
        name: input.title,
        mimeType: 'application/vnd.google-apps.document',
      };

      const response = await drive.files.create({
        requestBody: fileMetadata,
        fields: 'id,name,createdTime,webViewLink',
      });

      const file = response.data;
      const documentId = file.id;

      if (!documentId) {
        throw new Error('Failed to create document - no ID returned');
      }

      // If content is provided, add it to the document
      if (input.content) {
        const docs = createDocsService(this.params);

        await docs.documents.batchUpdate({
          documentId,
          requestBody: {
            requests: [
              {
                insertText: {
                  location: {
                    index: 1,
                  },
                  text: input.content,
                },
              },
            ],
          },
        });
      }

      const result = {
        message: 'Document created successfully',
        document: {
          id: documentId,
          name: file.name,
          createdTime: file.createdTime,
          webViewLink: file.webViewLink,
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully created Google Doc: "${file.name}" with ID: ${documentId}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error creating document',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while creating document',
      };
    }
  }
}

export class GoogleDocsGetDocument extends AgentBaseTool<GoogleDocsParams> {
  name = 'get_document';
  toolsetKey = GoogleDocsToolsetDefinition.key;

  schema = z.object({
    documentId: z.string().describe('The ID of the Google Doc to retrieve'),
  });
  description = 'Get the content of a Google Doc by its ID.';

  protected params: GoogleDocsParams;

  constructor(params: GoogleDocsParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const docs = createDocsService(this.params);

      const response = await docs.documents.get({
        documentId: input.documentId,
      });

      const document = response.data;

      // Extract text content from the document
      let content = '';
      if (document.body?.content) {
        for (const element of document.body.content) {
          if (element.paragraph?.elements) {
            for (const paragraphElement of element.paragraph.elements) {
              if (paragraphElement.textRun?.content) {
                content += paragraphElement.textRun.content;
              }
            }
            // Add newline after each paragraph
            content += '\n';
          }
        }
      }

      const result = {
        message: 'Document retrieved successfully',
        document: {
          id: document.documentId,
          title: document.title,
          content: content.trim(),
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully retrieved Google Doc: "${document.title}"`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error getting document',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while getting document',
      };
    }
  }
}

export class GoogleDocsUpdateDocument extends AgentBaseTool<GoogleDocsParams> {
  name = 'update_document';
  toolsetKey = GoogleDocsToolsetDefinition.key;

  schema = z.object({
    documentId: z.string().describe('The ID of the Google Doc to update'),
    content: z.string().describe('Content to append to the document'),
    mode: z
      .enum(['append', 'replace'])
      .optional()
      .describe('Update mode: append or replace entire content')
      .default('append'),
  });
  description = 'Update the content of a Google Doc by appending or replacing text.';

  protected params: GoogleDocsParams;

  constructor(params: GoogleDocsParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const docs = createDocsService(this.params);

      if (input.mode === 'replace') {
        // Get the current document to find the end position
        const docResponse = await docs.documents.get({
          documentId: input.documentId,
        });

        const document = docResponse.data;
        const endIndex = document.body?.content?.length ?? 1;

        // Replace all content
        await docs.documents.batchUpdate({
          documentId: input.documentId,
          requestBody: {
            requests: [
              {
                deleteContentRange: {
                  range: {
                    startIndex: 1,
                    endIndex: endIndex - 1,
                  },
                },
              },
              {
                insertText: {
                  location: {
                    index: 1,
                  },
                  text: input.content,
                },
              },
            ],
          },
        });
      } else {
        // Default: append mode
        // Get the document end position
        const docResponse = await docs.documents.get({
          documentId: input.documentId,
        });

        const document = docResponse.data;
        const endIndex = document.body?.content?.length ?? 1;

        // Append content at the end
        await docs.documents.batchUpdate({
          documentId: input.documentId,
          requestBody: {
            requests: [
              {
                insertText: {
                  location: {
                    index: endIndex - 1,
                  },
                  text: input.content,
                },
              },
            ],
          },
        });
      }

      // Get updated document info
      const drive = createDriveService(this.params);
      const fileResponse = await drive.files.get({
        fileId: input.documentId,
        fields: 'name,modifiedTime',
      });

      const file = fileResponse.data;

      const result = {
        message: 'Document updated successfully',
        document: {
          id: input.documentId,
          name: file.name,
          modifiedTime: file.modifiedTime,
          mode: input.mode,
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully updated Google Doc: "${file.name}" (${input.mode} mode)`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error updating document',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while updating document',
      };
    }
  }
}

export class GoogleDocsExportDocument extends AgentBaseTool<GoogleDocsParams> {
  name = 'export_document';
  toolsetKey = GoogleDocsToolsetDefinition.key;

  schema = z.object({
    documentId: z.string().describe('The ID of the Google Doc to export'),
    mimeType: z
      .enum([
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'text/html',
      ])
      .describe('Export format'),
  });
  description = 'Export a Google Doc to various formats (PDF, Word, etc.).';

  protected params: GoogleDocsParams;

  constructor(params: GoogleDocsParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const drive = createDriveService(this.params);

      // Get file metadata first
      const fileResponse = await drive.files.get({
        fileId: input.documentId,
        fields: 'name',
      });

      const file = fileResponse.data;

      // Export the document
      const exportResponse = await drive.files.export({
        fileId: input.documentId,
        mimeType: input.mimeType,
      });

      const result = {
        message: 'Document exported successfully',
        document: {
          id: input.documentId,
          name: file.name,
          exportedMimeType: input.mimeType,
          content: exportResponse.data,
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully exported Google Doc: "${file.name}" to ${input.mimeType}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error exporting document',
        summary:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while exporting document',
      };
    }
  }
}

export class GoogleDocsDeleteDocument extends AgentBaseTool<GoogleDocsParams> {
  name = 'delete_document';
  toolsetKey = GoogleDocsToolsetDefinition.key;

  schema = z.object({
    documentId: z.string().describe('The ID of the Google Doc to delete'),
  });
  description = 'Delete a Google Doc by its ID.';

  protected params: GoogleDocsParams;

  constructor(params: GoogleDocsParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const drive = createDriveService(this.params);

      // Get file info before deletion
      const fileResponse = await drive.files.get({
        fileId: input.documentId,
        fields: 'name',
      });

      const fileName = fileResponse.data.name;

      // Delete the document
      await drive.files.delete({
        fileId: input.documentId,
      });

      const result = {
        message: 'Document deleted successfully',
        deletedDocument: {
          id: input.documentId,
          name: fileName,
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully deleted Google Doc: "${fileName}" with ID: ${input.documentId}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error deleting document',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while deleting document',
      };
    }
  }
}

export class GoogleDocsSearchDocuments extends AgentBaseTool<GoogleDocsParams> {
  name = 'search_documents';
  toolsetKey = GoogleDocsToolsetDefinition.key;

  schema = z.object({
    query: z
      .string()
      .describe(
        'Search query (e.g., "name contains \'report\'", "mimeType = \'application/vnd.google-apps.document\'")',
      ),
    pageSize: z.number().optional().describe('Maximum number of results to return (default: 10)'),
    pageToken: z.string().optional().describe('Token for pagination'),
  });
  description = 'Search for Google Docs using query parameters.';

  protected params: GoogleDocsParams;

  constructor(params: GoogleDocsParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const drive = createDriveService(this.params);

      // Add mimeType filter for Google Docs if not specified
      const searchQuery = input.query.includes('mimeType')
        ? input.query
        : `${input.query} and mimeType = 'application/vnd.google-apps.document'`;

      const response = await drive.files.list({
        q: searchQuery,
        pageSize: input.pageSize ?? 10,
        pageToken: input.pageToken,
        fields: 'files(id,name,mimeType,createdTime,modifiedTime),nextPageToken',
      });

      const files = response.data.files ?? [];
      const nextPageToken = response.data.nextPageToken;

      if (files.length === 0) {
        return {
          status: 'success',
          data: {
            message: `No Google Docs found matching query: "${input.query}"`,
            query: input.query,
            count: 0,
          },
          summary: `No Google Docs found matching query: "${input.query}"`,
        };
      }

      const documentList = files.map((file) => ({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        createdTime: file.createdTime,
        modifiedTime: file.modifiedTime,
      }));

      const result = {
        message: `Search results for "${input.query}"`,
        query: input.query,
        count: files.length,
        documents: documentList,
        nextPageToken,
      };

      return {
        status: 'success',
        data: result,
        summary: `Search completed successfully. Found ${files.length} Google Docs matching query: "${input.query}"`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error searching documents',
        summary:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while searching documents',
      };
    }
  }
}

export class GoogleDocsToolset extends AgentBaseToolset<GoogleDocsParams> {
  toolsetKey = GoogleDocsToolsetDefinition.key;
  tools = [
    GoogleDocsCreateDocument,
    GoogleDocsGetDocument,
    GoogleDocsUpdateDocument,
    GoogleDocsExportDocument,
    GoogleDocsDeleteDocument,
    GoogleDocsSearchDocuments,
  ] satisfies readonly AgentToolConstructor<GoogleDocsParams>[];
}
