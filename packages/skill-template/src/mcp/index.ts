export * from './refly-mcp-server';
export * from './api-definitions';
export * from './error-handler';
export * from './logger';
export * from './tools-registry';

import { ReflyService, User } from '@refly/openapi-schema';
import { ReflyMcpServer } from './refly-mcp-server';
import { LogLevel } from './logger';

/**
 * Create and start a ReflyMcpServer instance
 *
 * This is a convenience function to quickly create and start a ReflyMcpServer.
 *
 * @param reflyService - The ReflyService instance to wrap
 * @param defaultUser - The default user to use for API calls
 * @param options - Optional configuration options
 * @returns A promise that resolves to the ReflyMcpServer instance
 */
export async function createAndStartReflyMcpServer(
  reflyService: ReflyService,
  defaultUser: User,
  options: {
    name?: string;
    version?: string;
    description?: string;
    logLevel?: LogLevel;
    port?: number;
    cors?: {
      origin?: string | string[];
      methods?: string[];
    };
  } = {},
): Promise<ReflyMcpServer> {
  const server = new ReflyMcpServer(reflyService, defaultUser, {
    name: options.name,
    version: options.version,
    description: options.description,
    logLevel: options.logLevel,
  });

  await server.start(options.port, options.cors);

  return server;
}
