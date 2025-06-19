import { McpServerType } from '@refly/openapi-schema';
import type { CommunityMcpConfig } from './types';
import type { UpsertMcpServerRequest } from '@refly/openapi-schema';

// Map server type from universal format to Refly format or infer from other fields
export const mapServerType = (type: string, serverConfig?: any): McpServerType => {
  const typeMap: Record<string, McpServerType> = {
    sse: 'sse',
    streamable: 'streamable',
    streamableHttp: 'streamable',
    stdio: 'stdio',
    inMemory: 'sse', // Map inMemory to sse as a fallback
  };

  // If type is valid, use it directly
  if (type && typeMap[type]) {
    return typeMap[type];
  }

  // If type is missing or invalid, infer from other fields
  if (serverConfig) {
    // Check if it's a stdio type (has command)
    if (serverConfig.command) {
      return 'stdio';
    }

    // Check URL patterns
    const url = serverConfig.url || '';
    if (url) {
      // Check for SSE (URL contains 'sse')
      if (url.toLowerCase().includes('sse')) {
        return 'sse';
      }

      // Check for streamable (URL contains 'mcp')
      if (url.toLowerCase().includes('mcp')) {
        return 'streamable';
      }
    }
  }

  // Default fallback
  return 'streamable';
};

// Convert community MCP config to UpsertMcpServerRequest format
export const convertCommunityConfigToServerRequest = (
  config: CommunityMcpConfig,
): UpsertMcpServerRequest => {
  // Map the type using the existing logic
  const mappedType = mapServerType(config.type, config);

  // Convert config to UpsertMcpServerRequest format
  const serverRequest: UpsertMcpServerRequest = {
    name: config.name,
    type: mappedType,
    enabled: true, // Default to enabled for community installs
  };

  // Add type-specific fields
  if (mappedType === 'stdio') {
    if (config.command) {
      serverRequest.command = config.command;
    }
    if (config.args?.length) {
      serverRequest.args = config.args;
    }
    if (config.env && Object.keys(config.env).length > 0) {
      serverRequest.env = config.env;
    }
  } else {
    // For sse and streamable types
    if (config.url) {
      serverRequest.url = config.url;
    }
    if (config.headers && Object.keys(config.headers).length > 0) {
      serverRequest.headers = config.headers;
    }
  }

  // Add additional configuration if present
  if (config.config && Object.keys(config.config).length > 0) {
    serverRequest.config = config.config;
  }

  // Add default reconnection settings for non-stdio types
  if (mappedType !== 'stdio') {
    serverRequest.reconnect = {
      enabled: true,
      maxAttempts: 3,
      delayMs: 1000,
    };
  }

  return serverRequest;
};

// Check if a community config is already installed based on name
export const isConfigInstalled = (
  config: CommunityMcpConfig,
  installedServers: Array<{ name: string }>,
): boolean => {
  return installedServers.some((server) => server.name === config.name);
};

// Generate a unique name if there's a conflict
export const generateUniqueName = (
  baseName: string,
  installedServers: Array<{ name: string }>,
): string => {
  let uniqueName = baseName;
  let counter = 1;

  while (installedServers.some((server) => server.name === uniqueName)) {
    uniqueName = `${baseName} (${counter})`;
    counter++;
  }

  return uniqueName;
};
