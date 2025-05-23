import { McpLogger } from './logger';

/**
 * Error handling wrapper for MCP tool handlers
 *
 * This function wraps a tool handler function with error handling logic
 * to ensure that errors are properly caught, logged, and formatted.
 *
 * @param fn - The tool handler function to wrap
 * @param logger - The logger instance
 * @returns A wrapped function with error handling
 */
export function withErrorHandling(
  fn: (...args: any[]) => Promise<any>,
  logger: McpLogger,
): (...args: any[]) => Promise<any> {
  return async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      // Log the error
      logger.error('Error executing MCP tool:', error);

      // Format error message
      let errorMessage = 'Operation failed';

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else {
        errorMessage = JSON.stringify(error);
      }

      // Return error response in MCP format
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${errorMessage}`,
          },
        ],
      };
    }
  };
}
