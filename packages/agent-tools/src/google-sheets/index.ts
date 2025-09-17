import { z } from 'zod/v3';
import { AgentBaseTool, AgentBaseToolset, AgentToolConstructor, ToolCallResult } from '../base';
import { ToolsetDefinition } from '@refly/openapi-schema';
import { google } from 'googleapis';
import { ToolParams } from '@langchain/core/tools';

export const GoogleSheetsToolsetDefinition: ToolsetDefinition = {
  key: 'google_sheets',
  domain: 'https://sheets.google.com',
  labelDict: {
    en: 'Google Sheets',
    'zh-CN': 'Google 表格',
  },
  descriptionDict: {
    en: 'Access and manage Google Sheets spreadsheets. Create, read, update spreadsheets and worksheets.',
    'zh-CN': '访问和管理 Google 表格。创建、读取、更新表格和工作表。',
  },
  tools: [
    {
      name: 'create_spreadsheet',
      descriptionDict: {
        en: 'Create a new Google Sheets spreadsheet with specified title.',
        'zh-CN': '创建一个新的 Google 表格，包含指定的标题。',
      },
    },
    {
      name: 'get_spreadsheet',
      descriptionDict: {
        en: 'Get detailed information about a Google Sheets spreadsheet.',
        'zh-CN': '获取 Google 表格的详细信息。',
      },
    },
    {
      name: 'get_values',
      descriptionDict: {
        en: 'Get values from a specific range in a Google Sheets spreadsheet.',
        'zh-CN': '从 Google 表格中的特定范围获取值。',
      },
    },
    {
      name: 'update_values',
      descriptionDict: {
        en: 'Update values in a specific range in a Google Sheets spreadsheet.',
        'zh-CN': '更新 Google 表格中特定范围的值。',
      },
    },
    {
      name: 'append_values',
      descriptionDict: {
        en: 'Append values to the end of a range in a Google Sheets spreadsheet.',
        'zh-CN': '在 Google 表格中的范围末尾追加值。',
      },
    },
    {
      name: 'create_worksheet',
      descriptionDict: {
        en: 'Create a new worksheet in an existing Google Sheets spreadsheet.',
        'zh-CN': '在现有的 Google 表格中创建一个新的工作表。',
      },
    },
    {
      name: 'delete_worksheet',
      descriptionDict: {
        en: 'Delete a worksheet from a Google Sheets spreadsheet.',
        'zh-CN': '从 Google 表格中删除工作表。',
      },
    },
    {
      name: 'list_worksheets',
      descriptionDict: {
        en: 'List all worksheets in a Google Sheets spreadsheet.',
        'zh-CN': '列出 Google 表格中的所有工作表。',
      },
    },
  ],
  requiresAuth: true,
  authPatterns: [
    {
      type: 'oauth',
      provider: 'google',
      scope: [
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/spreadsheets',
      ],
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
export interface GoogleSheetsParams extends ToolParams {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  accessToken: string;
  redirectUri?: string;
}

// Helper function to create authenticated Sheets service
function createSheetsService(params: GoogleSheetsParams) {
  const oauth2Client = new google.auth.OAuth2(
    params.clientId,
    params.clientSecret,
    params.redirectUri ?? 'http://localhost:3000/oauth2callback',
  );

  oauth2Client.setCredentials({
    refresh_token: params.refreshToken,
  });

  return google.sheets({ version: 'v4', auth: oauth2Client });
}

export class GoogleSheetsCreateSpreadsheet extends AgentBaseTool<GoogleSheetsParams> {
  name = 'create_spreadsheet';
  toolsetKey = GoogleSheetsToolsetDefinition.key;

  schema = z.object({
    title: z.string().describe('Title of the spreadsheet to create'),
    sheetTitle: z.string().optional().describe('Title of the initial sheet (default: Sheet1)'),
  });
  description = 'Create a new Google Sheets spreadsheet with specified title.';

  protected params: GoogleSheetsParams;

  constructor(params: GoogleSheetsParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const sheets = createSheetsService(this.params);

      const request = {
        requestBody: {
          properties: {
            title: input.title,
          },
          sheets: input.sheetTitle
            ? [
                {
                  properties: {
                    title: input.sheetTitle,
                  },
                },
              ]
            : undefined,
        },
      };

      const response = await sheets.spreadsheets.create(request);
      const spreadsheet = response.data;

      const result = {
        message: 'Spreadsheet created successfully',
        spreadsheet: {
          spreadsheetId: spreadsheet.spreadsheetId,
          title: spreadsheet.properties?.title,
          sheets: spreadsheet.sheets?.map((sheet: any) => ({
            sheetId: sheet.properties?.sheetId,
            title: sheet.properties?.title,
            index: sheet.properties?.index,
          })),
          spreadsheetUrl: spreadsheet.spreadsheetUrl,
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully created Google Sheets spreadsheet: "${spreadsheet.properties?.title}"`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error creating spreadsheet',
        summary:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while creating spreadsheet',
      };
    }
  }
}

export class GoogleSheetsGetSpreadsheet extends AgentBaseTool<GoogleSheetsParams> {
  name = 'get_spreadsheet';
  toolsetKey = GoogleSheetsToolsetDefinition.key;

  schema = z.object({
    spreadsheetId: z.string().describe('The ID of the spreadsheet to retrieve'),
    includeGridData: z
      .boolean()
      .optional()
      .describe('Whether to include grid data in the response')
      .default(false),
  });
  description = 'Get detailed information about a Google Sheets spreadsheet.';

  protected params: GoogleSheetsParams;

  constructor(params: GoogleSheetsParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const sheets = createSheetsService(this.params);

      const response = await sheets.spreadsheets.get({
        spreadsheetId: input.spreadsheetId,
        includeGridData: input.includeGridData,
      });

      const spreadsheet = response.data;

      const result = {
        message: 'Spreadsheet retrieved successfully',
        spreadsheet: {
          spreadsheetId: spreadsheet.spreadsheetId,
          title: spreadsheet.properties?.title,
          locale: spreadsheet.properties?.locale,
          timeZone: spreadsheet.properties?.timeZone,
          sheets: spreadsheet.sheets?.map((sheet) => ({
            sheetId: sheet.properties?.sheetId,
            title: sheet.properties?.title,
            index: sheet.properties?.index,
            sheetType: sheet.properties?.sheetType,
            gridProperties: sheet.properties?.gridProperties,
          })),
          spreadsheetUrl: spreadsheet.spreadsheetUrl,
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully retrieved Google Sheets spreadsheet: "${spreadsheet.properties?.title}"`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error getting spreadsheet',
        summary:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while getting spreadsheet',
      };
    }
  }
}

export class GoogleSheetsGetValues extends AgentBaseTool<GoogleSheetsParams> {
  name = 'get_values';
  toolsetKey = GoogleSheetsToolsetDefinition.key;

  schema = z.object({
    spreadsheetId: z.string().describe('The ID of the spreadsheet'),
    range: z
      .string()
      .describe('The A1 notation of the range to retrieve values from (e.g., "Sheet1!A1:B10")'),
    valueRenderOption: z
      .enum(['FORMATTED_VALUE', 'UNFORMATTED_VALUE', 'FORMULA'])
      .optional()
      .describe('How values should be rendered in the output')
      .default('FORMATTED_VALUE'),
    dateTimeRenderOption: z
      .enum(['SERIAL_NUMBER', 'FORMATTED_STRING'])
      .optional()
      .describe('How dates and times should be rendered')
      .default('FORMATTED_STRING'),
  });
  description = 'Get values from a specific range in a Google Sheets spreadsheet.';

  protected params: GoogleSheetsParams;

  constructor(params: GoogleSheetsParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const sheets = createSheetsService(this.params);

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: input.spreadsheetId,
        range: input.range,
        valueRenderOption: input.valueRenderOption,
        dateTimeRenderOption: input.dateTimeRenderOption,
      });

      const values = response.data.values ?? [];
      const range = response.data.range;

      const result = {
        message: 'Values retrieved successfully',
        range,
        values,
        rowCount: values.length,
        colCount: values.length > 0 ? values[0].length : 0,
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully retrieved ${values.length} rows from range: ${range}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error getting values',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while getting values',
      };
    }
  }
}

export class GoogleSheetsUpdateValues extends AgentBaseTool<GoogleSheetsParams> {
  name = 'update_values';
  toolsetKey = GoogleSheetsToolsetDefinition.key;

  schema = z.object({
    spreadsheetId: z.string().describe('The ID of the spreadsheet'),
    range: z.string().describe('The A1 notation of the range to update (e.g., "Sheet1!A1:B10")'),
    values: z.array(z.array(z.any())).describe('The values to update, as a 2D array'),
    valueInputOption: z
      .enum(['RAW', 'USER_ENTERED'])
      .optional()
      .describe('How the input data should be interpreted')
      .default('USER_ENTERED'),
  });
  description = 'Update values in a specific range in a Google Sheets spreadsheet.';

  protected params: GoogleSheetsParams;

  constructor(params: GoogleSheetsParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const sheets = createSheetsService(this.params);

      const response = await sheets.spreadsheets.values.update({
        spreadsheetId: input.spreadsheetId,
        range: input.range,
        valueInputOption: input.valueInputOption,
        requestBody: {
          values: input.values,
        },
      });

      const result = {
        message: 'Values updated successfully',
        spreadsheetId: input.spreadsheetId,
        updatedRange: response.data.updatedRange,
        updatedRows: response.data.updatedRows,
        updatedColumns: response.data.updatedColumns,
        updatedCells: response.data.updatedCells,
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully updated ${response.data.updatedCells} cells in range: ${response.data.updatedRange}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error updating values',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while updating values',
      };
    }
  }
}

export class GoogleSheetsAppendValues extends AgentBaseTool<GoogleSheetsParams> {
  name = 'append_values';
  toolsetKey = GoogleSheetsToolsetDefinition.key;

  schema = z.object({
    spreadsheetId: z.string().describe('The ID of the spreadsheet'),
    range: z.string().describe('The A1 notation of the range to append to (e.g., "Sheet1!A1:B1")'),
    values: z.array(z.array(z.any())).describe('The values to append, as a 2D array'),
    valueInputOption: z
      .enum(['RAW', 'USER_ENTERED'])
      .optional()
      .describe('How the input data should be interpreted')
      .default('USER_ENTERED'),
    insertDataOption: z
      .enum(['OVERWRITE', 'INSERT_ROWS'])
      .optional()
      .describe('How the input data should be inserted')
      .default('INSERT_ROWS'),
  });
  description = 'Append values to the end of a range in a Google Sheets spreadsheet.';

  protected params: GoogleSheetsParams;

  constructor(params: GoogleSheetsParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const sheets = createSheetsService(this.params);

      const response = await sheets.spreadsheets.values.append({
        spreadsheetId: input.spreadsheetId,
        range: input.range,
        valueInputOption: input.valueInputOption,
        insertDataOption: input.insertDataOption,
        requestBody: {
          values: input.values,
        },
      });

      const result = {
        message: 'Values appended successfully',
        spreadsheetId: input.spreadsheetId,
        updatedRange: response.data.updates?.updatedRange,
        updatedRows: response.data.updates?.updatedRows,
        updatedColumns: response.data.updates?.updatedColumns,
        updatedCells: response.data.updates?.updatedCells,
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully appended ${response.data.updates?.updatedCells} cells to spreadsheet`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error appending values',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while appending values',
      };
    }
  }
}

export class GoogleSheetsCreateWorksheet extends AgentBaseTool<GoogleSheetsParams> {
  name = 'create_worksheet';
  toolsetKey = GoogleSheetsToolsetDefinition.key;

  schema = z.object({
    spreadsheetId: z.string().describe('The ID of the spreadsheet'),
    title: z.string().describe('The title of the new worksheet'),
    rowCount: z
      .number()
      .optional()
      .describe('The number of rows in the new worksheet')
      .default(1000),
    columnCount: z
      .number()
      .optional()
      .describe('The number of columns in the new worksheet')
      .default(26),
  });
  description = 'Create a new worksheet in an existing Google Sheets spreadsheet.';

  protected params: GoogleSheetsParams;

  constructor(params: GoogleSheetsParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const sheets = createSheetsService(this.params);

      const request = {
        spreadsheetId: input.spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: input.title,
                  gridProperties: {
                    rowCount: input.rowCount,
                    columnCount: input.columnCount,
                  },
                },
              },
            },
          ],
        },
      };

      const response = await sheets.spreadsheets.batchUpdate(request);
      const addSheetResponse = response.data.replies?.[0]?.addSheet;

      const result = {
        message: 'Worksheet created successfully',
        spreadsheetId: input.spreadsheetId,
        sheet: {
          sheetId: addSheetResponse?.properties?.sheetId,
          title: addSheetResponse?.properties?.title,
          index: addSheetResponse?.properties?.index,
          gridProperties: addSheetResponse?.properties?.gridProperties,
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully created worksheet: "${input.title}" in spreadsheet`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error creating worksheet',
        summary:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while creating worksheet',
      };
    }
  }
}

export class GoogleSheetsDeleteWorksheet extends AgentBaseTool<GoogleSheetsParams> {
  name = 'delete_worksheet';
  toolsetKey = GoogleSheetsToolsetDefinition.key;

  schema = z.object({
    spreadsheetId: z.string().describe('The ID of the spreadsheet'),
    sheetId: z.number().describe('The ID of the worksheet to delete'),
  });
  description = 'Delete a worksheet from a Google Sheets spreadsheet.';

  protected params: GoogleSheetsParams;

  constructor(params: GoogleSheetsParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const sheets = createSheetsService(this.params);

      const request = {
        spreadsheetId: input.spreadsheetId,
        requestBody: {
          requests: [
            {
              deleteSheet: {
                sheetId: input.sheetId,
              },
            },
          ],
        },
      };

      await sheets.spreadsheets.batchUpdate(request);

      const result = {
        message: 'Worksheet deleted successfully',
        spreadsheetId: input.spreadsheetId,
        deletedSheetId: input.sheetId,
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully deleted worksheet with ID: ${input.sheetId}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error deleting worksheet',
        summary:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while deleting worksheet',
      };
    }
  }
}

export class GoogleSheetsListWorksheets extends AgentBaseTool<GoogleSheetsParams> {
  name = 'list_worksheets';
  toolsetKey = GoogleSheetsToolsetDefinition.key;

  schema = z.object({
    spreadsheetId: z.string().describe('The ID of the spreadsheet'),
  });
  description = 'List all worksheets in a Google Sheets spreadsheet.';

  protected params: GoogleSheetsParams;

  constructor(params: GoogleSheetsParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const sheets = createSheetsService(this.params);

      const response = await sheets.spreadsheets.get({
        spreadsheetId: input.spreadsheetId,
      });

      const spreadsheet = response.data;
      const sheetsList = spreadsheet.sheets ?? [];

      const worksheets = sheetsList.map((sheet) => ({
        sheetId: sheet.properties?.sheetId,
        title: sheet.properties?.title,
        index: sheet.properties?.index,
        sheetType: sheet.properties?.sheetType,
        gridProperties: sheet.properties?.gridProperties,
      }));

      const result = {
        message: 'Worksheets listed successfully',
        spreadsheetId: input.spreadsheetId,
        spreadsheetTitle: spreadsheet.properties?.title,
        count: worksheets.length,
        worksheets,
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully listed ${worksheets.length} worksheets from spreadsheet: "${spreadsheet.properties?.title}"`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error listing worksheets',
        summary:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while listing worksheets',
      };
    }
  }
}

export class GoogleSheetsToolset extends AgentBaseToolset<GoogleSheetsParams> {
  toolsetKey = GoogleSheetsToolsetDefinition.key;
  tools = [
    GoogleSheetsCreateSpreadsheet,
    GoogleSheetsGetSpreadsheet,
    GoogleSheetsGetValues,
    GoogleSheetsUpdateValues,
    GoogleSheetsAppendValues,
    GoogleSheetsCreateWorksheet,
    GoogleSheetsDeleteWorksheet,
    GoogleSheetsListWorksheets,
  ] satisfies readonly AgentToolConstructor<GoogleSheetsParams>[];
}
