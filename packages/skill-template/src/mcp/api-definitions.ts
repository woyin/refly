import { z } from 'zod';

/**
 * ApiDefinition - Interface for defining ReflyService API methods as MCP tools
 *
 * This interface provides a structured way to define how ReflyService APIs
 * should be exposed as MCP tools.
 */
export interface ApiDefinition {
  /** Unique name for the tool */
  name: string;

  /** Human-readable description of what the tool does */
  description: string;

  /** The corresponding method name in the ReflyService interface */
  method: string;

  /** Zod schema for validating input parameters */
  schema: z.ZodType<any>;

  /** Optional function to transform the API response */
  responseTransformer?: (response: any) => any;

  /** Whether this tool is read-only (doesn't modify state) */
  readOnly?: boolean;

  /** Whether this tool performs destructive operations */
  destructive?: boolean;

  /** Whether repeated calls with the same parameters have the same effect */
  idempotent?: boolean;
}
