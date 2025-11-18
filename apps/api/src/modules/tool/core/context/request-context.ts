/**
 * Request context management using AsyncLocalStorage
 * Provides thread-safe access to current request's user information
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import type { HandlerRequestUser } from '@refly/openapi-schema';

export interface RequestContext {
  /**
   * Current user making the request
   */
  user?: HandlerRequestUser;

  /**
   * Request ID for tracking
   */
  requestId?: string;

  /**
   * Additional metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Global AsyncLocalStorage instance for request context
 */
const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

/**
 * Run a function with a specific request context
 */
export function runInContext<T>(context: RequestContext, fn: () => T): T {
  return asyncLocalStorage.run(context, fn);
}

/**
 * Get the current request context
 */
export function getContext(): RequestContext | undefined {
  return asyncLocalStorage.getStore();
}

/**
 * Get the current user from context
 */
export function getCurrentUser(): HandlerRequestUser | undefined {
  return asyncLocalStorage.getStore()?.user;
}

/**
 * Set user in current context (if context exists)
 */
export function setCurrentUser(user: HandlerRequestUser | undefined): void {
  const context = asyncLocalStorage.getStore();
  if (context) {
    context.user = user;
  }
}

/**
 * Get request ID from context
 */
export function getRequestId(): string | undefined {
  return asyncLocalStorage.getStore()?.requestId;
}

/**
 * Check if we're currently in a request context
 */
export function hasContext(): boolean {
  return asyncLocalStorage.getStore() !== undefined;
}

/**
 * @deprecated Use individual functions instead. This namespace will be removed in a future version.
 * - Use `runInContext()` instead of `RequestContextManager.run()`
 * - Use `getContext()` instead of `RequestContextManager.getContext()`
 * - Use `getCurrentUser()` instead of `RequestContextManager.getCurrentUser()`
 * - Use `setCurrentUser()` instead of `RequestContextManager.setCurrentUser()`
 * - Use `getRequestId()` instead of `RequestContextManager.getRequestId()`
 * - Use `hasContext()` instead of `RequestContextManager.hasContext()`
 */
export namespace RequestContextManager {
  /** @deprecated Use `runInContext()` instead */
  export function run<T>(context: RequestContext, fn: () => T): T {
    return asyncLocalStorage.run(context, fn);
  }

  /** @deprecated Use `getContext()` instead */
  export function getContext(): RequestContext | undefined {
    return asyncLocalStorage.getStore();
  }

  /** @deprecated Use `getCurrentUser()` instead */
  export function getCurrentUser(): HandlerRequestUser | undefined {
    return asyncLocalStorage.getStore()?.user;
  }

  /** @deprecated Use `setCurrentUser()` instead */
  export function setCurrentUser(user: HandlerRequestUser | undefined): void {
    const context = asyncLocalStorage.getStore();
    if (context) {
      context.user = user;
    }
  }

  /** @deprecated Use `getRequestId()` instead */
  export function getRequestId(): string | undefined {
    return asyncLocalStorage.getStore()?.requestId;
  }

  /** @deprecated Use `hasContext()` instead */
  export function hasContext(): boolean {
    return asyncLocalStorage.getStore() !== undefined;
  }
}
