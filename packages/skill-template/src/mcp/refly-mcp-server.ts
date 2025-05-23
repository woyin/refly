import { McpServer } from '@modelcontextprotocol/sdk';
import { StreamableHttpServerTransport } from '@modelcontextprotocol/sdk';
import { User } from '@refly/openapi-schema';
import { registerReflyTools } from './tools-registry';
import { McpLogger, LogLevel } from './logger';

/**
 * ReflyMcpServer - A class that wraps the MCP server implementation for ReflyService
 *
 * This class provides methods to create and manage an MCP server that exposes
 * ReflyService APIs as MCP tools.
 */
export class ReflyMcpServer {
  private server: McpServer;
  private transport: StreamableHttpServerTransport | null = null;
  private logger: McpLogger;

  /**
   * Create a new ReflyMcpServer instance
   *
   * @param reflyService - The ReflyService instance to wrap
   * @param defaultUser - The default user to use for API calls
   * @param options - Optional configuration options
   */
  constructor(
    private reflyService: any, // 使用 any 类型来避免类型错误
    private defaultUser: User,
    private options: {
      name?: string;
      version?: string;
      description?: string;
      logLevel?: LogLevel;
    } = {},
  ) {
    // Initialize logger
    this.logger = new McpLogger(options.logLevel || LogLevel.INFO);

    // Create MCP server
    this.server = new McpServer({
      name: options.name || 'ReflyService',
      version: options.version || '1.0.0',
      description: options.description || 'Refly Service API tools for AI agents',
    });

    // Register all Refly tools
    this.registerTools();

    this.logger.info('ReflyMcpServer initialized');
  }

  /**
   * Register all ReflyService tools with the MCP server
   */
  private registerTools(): void {
    registerReflyTools(this.server, this.reflyService, this.defaultUser, this.logger);
  }

  /**
   * Start the MCP server on the specified port
   *
   * @param port - The port to listen on (default: 3000)
   * @param corsOptions - CORS configuration options
   * @returns A promise that resolves when the server is started
   */
  async start(
    port = 3000,
    corsOptions: {
      origin?: string | string[];
      methods?: string[];
    } = { origin: '*', methods: ['GET', 'POST'] },
  ): Promise<void> {
    // Create transport
    this.transport = new StreamableHttpServerTransport({
      port,
      cors: corsOptions,
    });

    // Connect server to transport
    await this.server.connect(this.transport);

    this.logger.info(`ReflyMcpServer running on http://localhost:${port}/sse`);
  }

  /**
   * Stop the MCP server
   *
   * @returns A promise that resolves when the server is stopped
   */
  async stop(): Promise<void> {
    if (this.transport) {
      await this.transport.close();
      this.transport = null;
      this.logger.info('ReflyMcpServer stopped');
    }
  }

  /**
   * Get the underlying MCP server instance
   *
   * @returns The McpServer instance
   */
  getServer(): McpServer {
    return this.server;
  }

  /**
   * Get the logger instance
   *
   * @returns The McpLogger instance
   */
  getLogger(): McpLogger {
    return this.logger;
  }
}
