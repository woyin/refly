/**
 * HTTP adapter implementation
 * Handles HTTP-based API calls
 */

import type { AdapterRequest, AdapterResponse, HttpAdapterConfig } from '@refly/openapi-schema';
import { AxiosResponse } from 'axios';
import { AdapterType, HttpMethod } from '../../constant';
import { BaseAdapter } from '../../core/base';
import type { IHttpAdapter } from '../../core/interfaces';
import { AdapterError } from '../types';
import { HttpClient } from './client';

/**
 * HTTP adapter for making HTTP API calls
 */
export class HttpAdapter extends BaseAdapter implements IHttpAdapter {
  private readonly httpClient: HttpClient;

  constructor(config: HttpAdapterConfig = {}) {
    super({
      maxRetries: config.maxRetries,
      initialDelay: config.retryDelay,
    });

    this.httpClient = new HttpClient({
      baseURL: config.baseUrl,
      timeout: config.timeout,
      headers: config.defaultHeaders,
      proxy: config.proxy,
    });
  }

  /**
   * Get adapter type
   */
  getType(): typeof AdapterType.HTTP {
    return AdapterType.HTTP;
  }

  /**
   * Set default headers
   */
  setDefaultHeaders(headers: Record<string, string>): void {
    for (const [key, value] of Object.entries(headers)) {
      this.httpClient.setHeader(key, value);
    }
  }

  /**
   * Get default headers
   */
  getDefaultHeaders(): Record<string, string> {
    return this.httpClient.getHeaders();
  }

  /**
   * Execute HTTP request
   */
  protected async executeInternal(request: AdapterRequest): Promise<AdapterResponse> {
    this.validateRequest(request);

    try {
      // Prepare headers
      const headers = {
        ...this.httpClient.getHeaders(),
        ...request.headers,
      };

      // Add authentication headers from credentials
      if (request.credentials) {
        this.addAuthHeaders(headers, request.credentials);
      }
      // Prepare request data
      let requestData: unknown;
      const contentType = headers['Content-Type'] || headers['content-type'];

      if (request.useFormData) {
        // Use FormData for file uploads
        requestData = this.httpClient.createFormData(request.params);
        // Don't set Content-Type header for FormData, let axios set it with boundary
        headers['Content-Type'] = undefined;
      } else {
        // Use JSON for regular requests
        requestData = request.params;
        if (!contentType) {
          headers['Content-Type'] = 'application/json';
        }
      }

      // Execute request based on HTTP method
      const method = request.method?.toUpperCase() || HttpMethod.POST;
      let response: AxiosResponse;

      switch (method) {
        case 'GET':
          response = await this.httpClient.get(request.endpoint, {
            params: request.params,
            headers,
            timeout: request.timeout,
            responseType: 'arraybuffer',
          });
          break;

        case 'POST':
          response = await this.httpClient.post(request.endpoint, requestData, {
            headers,
            timeout: request.timeout,
            responseType: 'arraybuffer',
          });
          break;

        case 'PUT':
          response = await this.httpClient.put(request.endpoint, requestData, {
            headers,
            timeout: request.timeout,
            responseType: 'arraybuffer',
          });
          break;

        case 'DELETE':
          response = await this.httpClient.delete(request.endpoint, {
            headers,
            timeout: request.timeout,
            data: requestData,
            responseType: 'arraybuffer',
          });
          break;

        case 'PATCH':
          response = await this.httpClient.patch(request.endpoint, requestData, {
            headers,
            timeout: request.timeout,
            responseType: 'arraybuffer',
          });
          break;

        default:
          throw new AdapterError(`Unsupported HTTP method: ${method}`, 'UNSUPPORTED_METHOD');
      }
      // Process response based on content type
      const responseContentType = response.headers['content-type'] || '';
      const processedData = this.processResponseData(response.data, responseContentType, response);

      // Return adapter response
      return {
        data: processedData,
        status: response.status,
        headers: response.headers as Record<string, string>,
        raw: response,
      };
    } catch (error) {
      // Re-throw AdapterError as-is
      if (error instanceof AdapterError) {
        throw error;
      }
      // Wrap other errors
      throw this.wrapError(error as Error);
    }
  }

  /**
   * Process response data based on content type
   * Automatically detects binary responses and converts them to buffer objects
   * Handles arraybuffer responses for both JSON and binary data
   */
  private processResponseData(
    data: unknown,
    contentType: string,
    response: AxiosResponse,
  ): unknown {
    // Check if response is binary (non-JSON)
    if (this.isBinaryResponse(contentType)) {
      return this.handleBinaryResponse(data, contentType, response);
    }

    // If data is ArrayBuffer or Buffer but content-type is JSON, parse it
    if (
      contentType.includes('application/json') ||
      contentType.includes('text/json') ||
      !contentType
    ) {
      if (data instanceof ArrayBuffer || Buffer.isBuffer(data)) {
        try {
          const text = Buffer.from(data as ArrayBuffer).toString('utf-8');
          return JSON.parse(text);
        } catch (error) {
          this.logger.warn(
            `Failed to parse arraybuffer as JSON for content-type: ${contentType}`,
            error,
          );
          return data;
        }
      }
    }

    // Return data as-is for other content types
    return data;
  }

  /**
   * Check if content type indicates binary response
   */
  private isBinaryResponse(contentType: string): boolean {
    const binaryTypes = [
      'audio/',
      'video/',
      'image/',
      'application/octet-stream',
      'application/pdf',
    ];
    return binaryTypes.some((type) => contentType.includes(type));
  }

  private handleBinaryResponse(
    data: unknown,
    contentType: string,
    response: AxiosResponse,
  ): { buffer: Buffer; filename: string; mimetype: string } {
    const buffer = this.normalizeToBuffer(data);
    const filename = this.extractFilename(response) || this.generateFilename(contentType);

    return {
      buffer,
      filename,
      mimetype: contentType || 'application/octet-stream',
    };
  }

  private normalizeToBuffer(data: unknown): Buffer {
    if (Buffer.isBuffer(data)) {
      return data;
    }
    if (data instanceof ArrayBuffer) {
      return Buffer.from(data);
    }
    if (data instanceof Uint8Array) {
      return Buffer.from(data);
    }
    if (Array.isArray(data)) {
      return Buffer.from(data);
    }
    if (typeof data === 'string') {
      throw new Error('Expected binary response but got string. Check axios responseType.');
    }

    throw new Error(`Unsupported binary data type: ${typeof data}`);
  }

  /**
   * Extract filename from Content-Disposition header or URL
   */
  private extractFilename(response: AxiosResponse): string | null {
    // Try Content-Disposition header first
    const disposition = response.headers['content-disposition'];
    if (disposition) {
      const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (match?.[1]) {
        return match[1].replace(/['"]/g, '');
      }
    }

    // Try to extract from URL
    try {
      const url = response.config?.url;
      if (url) {
        const pathname = new URL(url, 'http://dummy').pathname;
        const filename = pathname.split('/').pop();
        if (filename?.includes('.')) {
          return filename;
        }
      }
    } catch {
      // Ignore URL parsing errors
    }

    return null;
  }

  /**
   * Generate filename from MIME type
   */
  private generateFilename(contentType: string): string {
    const ext = this.getExtensionFromMimeType(contentType);
    return `file-${Date.now()}.${ext}`;
  }

  /**
   * Get file extension from MIME type
   */
  private getExtensionFromMimeType(mimetype: string): string {
    const map: Record<string, string> = {
      'audio/mpeg': 'mp3',
      'audio/mp3': 'mp3',
      'audio/wav': 'wav',
      'audio/ogg': 'ogg',
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'application/pdf': 'pdf',
      'application/octet-stream': 'bin',
    };

    // Extract base type (remove charset, etc.)
    const baseType = mimetype.split(';')[0].trim().toLowerCase();
    return map[baseType] || 'bin';
  }

  /**
   * Add authentication headers based on credentials
   */
  private addAuthHeaders(
    headers: Record<string, string>,
    credentials: Record<string, unknown>,
  ): void {
    // API Key authentication
    if (credentials.apiKey) {
      headers.Authorization = `Bearer ${credentials.apiKey}`;
    }

    // Basic authentication
    if (credentials.username && credentials.password) {
      const auth = Buffer.from(`${credentials.username}:${credentials.password}`).toString(
        'base64',
      );
      headers.Authorization = `Basic ${auth}`;
    }

    // OAuth token
    if (credentials.accessToken) {
      headers.Authorization = `Bearer ${credentials.accessToken}`;
    }

    // Custom API key header
    if (credentials.apiKeyHeader && credentials.apiKey) {
      headers[credentials.apiKeyHeader as string] = credentials.apiKey as string;
    }
  }

  /**
   * Check if adapter is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      // Just check if we can make a simple request
      // Subclasses can override for more specific health checks
      return true;
    } catch {
      return false;
    }
  }
}
