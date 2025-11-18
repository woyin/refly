/**
 * HTTP Handler implementation
 * Main handler that orchestrates HTTP/SDK calls with pre/post processing
 */

import type {
  AdapterRequest,
  BillingConfig,
  HandlerConfig,
  HandlerRequest,
  HandlerResponse,
} from '@refly/openapi-schema';
import { BaseHandler } from '../core/base';
import type { IAdapter } from '../core/interfaces';
import { createBasePostHandler } from './post';
import { createBasePreHandler } from './pre';
import type { ResourceResolver, ResourceUploader } from './types';

/**
 * HTTP Handler configuration options
 */
export interface HttpHandlerOptions extends HandlerConfig {
  /** Resource resolver for input files */
  resourceResolver?: ResourceResolver;
  /** Resource uploader for output files */
  resourceUploader?: ResourceUploader;
  /** Billing configuration */
  billing?: BillingConfig;
  /** Whether to format response */
  formatResponse?: boolean;
}

/**
 * HTTP Handler class
 * Handles complete request lifecycle with automatic resource management
 */
export class HttpHandler extends BaseHandler {
  constructor(
    adapter: IAdapter,
    private readonly options: HttpHandlerOptions,
  ) {
    super(adapter, options);

    // Setup pre-handlers
    this.setupPreHandlers();

    // Setup post-handlers
    this.setupPostHandlers();
  }

  /**
   * Setup pre-handlers in order
   */
  private setupPreHandlers(): void {
    // Use base pre-handler that combines credential injection and resource resolution
    this.use(
      createBasePreHandler({
        credentials: this.options.credentials,
        resolver: this.options.resourceResolver,
      }),
    );
  }

  /**
   * Setup post-handlers in order
   */
  private setupPostHandlers(): void {
    // Use base post-handler that combines billing and resource upload
    this.usePost(
      createBasePostHandler({
        billing: this.options.billing,
        uploader: this.options.resourceUploader,
      }),
    );
  }

  /**
   * Execute the actual API request via adapter
   */
  protected async executeRequest(request: HandlerRequest): Promise<HandlerResponse> {
    try {
      // Build adapter request
      const adapterRequest: AdapterRequest = {
        endpoint: this.options.endpoint,
        method: this.options.method || 'POST',
        params: request.params,
        headers: this.options.headers,
        credentials: this.context.credentials,
        timeout: this.options.timeout,
        useFormData: this.options.useFormData,
      };

      // Execute via adapter
      const adapterResponse = await this.adapter.execute(adapterRequest);

      // Check if response indicates an error
      if (adapterResponse.status && adapterResponse.status >= 400) {
        return this.createErrorResponse(
          `HTTP_${adapterResponse.status}`,
          `Request failed with status ${adapterResponse.status}`,
        );
      }

      // Build success response
      return this.createSuccessResponse({
        ...(typeof adapterResponse.data === 'object' && adapterResponse.data !== null
          ? (adapterResponse.data as Record<string, unknown>)
          : { result: adapterResponse.data }),
      });
    } catch (error) {
      this.logger.error(
        `Request execution failed: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw error;
    }
  }
}
