/**
 * Base pre-handler
 * Combines authentication injection and resource resolution in a single unified handler
 */

import { Logger } from '@nestjs/common';
import type { HandlerContext, HandlerRequest } from '@refly/openapi-schema';
import type { ResourceResolver } from '../types';
import {
  getValueByPath,
  injectCredentials,
  resolveResourceItem,
  resolveResourceItems,
  setValueByPath,
} from '../../utils';

/**
 * Configuration for base pre-handler
 */
export interface BasePreHandlerConfig {
  /**
   * Authentication credentials to inject
   */
  credentials?: Record<string, unknown>;

  /**
   * Resource resolver for input file resolution
   */
  resolver?: ResourceResolver;
}

/**
 * Create base pre-handler
 * Handles both credential injection and resource resolution in correct order:
 * 1. Inject credentials (if configured)
 * 2. Resolve input resources (if configured)
 */
export function createBasePreHandler(
  config: BasePreHandlerConfig = {},
): (request: HandlerRequest, context: HandlerContext) => Promise<HandlerRequest> {
  const logger = new Logger('BasePreHandler');

  return async (request: HandlerRequest, context: HandlerContext): Promise<HandlerRequest> => {
    let processedRequest = request;
    let processedContext = context;

    // Step 1: Inject credentials
    if (config.credentials) {
      processedContext = injectCredentials(processedContext, config.credentials);
      logger.debug('Injected authentication credentials into context');
    }

    // Step 2: Resolve input resources
    if (config.resolver) {
      processedRequest = await processResourceResolution(
        processedRequest,
        processedContext,
        config.resolver,
        logger,
      );
    }

    return processedRequest;
  };
}

/**
 * Process resource resolution for input parameters
 */
async function processResourceResolution(
  request: HandlerRequest,
  context: HandlerContext,
  resolver: ResourceResolver,
  logger: Logger,
): Promise<HandlerRequest> {
  // Skip if no resource fields configured
  if (!context.inputResourceFields || context.inputResourceFields.length === 0) {
    return request;
  }

  const processedParams = { ...request.params };

  // Process each resource field
  for (const resourceField of context.inputResourceFields) {
    try {
      const value = getValueByPath(processedParams, resourceField.fieldPath);

      if (!value) {
        continue;
      }

      if (resourceField.isArray) {
        // Handle array of resources
        if (!Array.isArray(value)) {
          logger.warn(
            `Expected array for resource field ${resourceField.fieldPath}, got ${typeof value}`,
          );
          continue;
        }

        const processedArray = await resolveResourceItems(
          value,
          resourceField.fieldPath,
          resolver,
          logger,
        );

        setValueByPath(processedParams, resourceField.fieldPath, processedArray);
      } else {
        // Handle single resource
        const processed = await resolveResourceItem(
          value,
          resourceField.fieldPath,
          resolver,
          logger,
        );

        setValueByPath(processedParams, resourceField.fieldPath, processed);
      }
    } catch (error) {
      logger.error(
        `Failed to resolve resource field ${resourceField.fieldPath}: ${(error as Error).message}`,
      );
      // Continue processing other fields even if one fails
    }
  }

  return {
    ...request,
    params: processedParams,
  };
}
