import { Logger } from '@nestjs/common';
import { ERROR_MESSAGES } from './constants';

/**
 * 错误信息接口
 */
export interface ErrorInfo {
  type:
    | 'VALIDATION'
    | 'LLM_SERVICE'
    | 'DATABASE'
    | 'CANVAS_SERVICE'
    | 'PROVIDER_SERVICE'
    | 'NETWORK'
    | 'UNKNOWN';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  originalError?: Error;
  context?: Record<string, unknown>;
  canRetry: boolean;
  canFallback: boolean;
}

/**
 * 错误类型枚举
 */
export const ErrorType = {
  VALIDATION: 'VALIDATION',
  LLM_SERVICE: 'LLM_SERVICE',
  DATABASE: 'DATABASE',
  CANVAS_SERVICE: 'CANVAS_SERVICE',
  PROVIDER_SERVICE: 'PROVIDER_SERVICE',
  NETWORK: 'NETWORK',
  UNKNOWN: 'UNKNOWN',
} as const;

/**
 * 错误严重程度枚举
 */
export const ErrorSeverity = {
  LOW: 'LOW', // 可以降级处理
  MEDIUM: 'MEDIUM', // 需要重试
  HIGH: 'HIGH', // 需要立即处理
  CRITICAL: 'CRITICAL', // 服务不可用
} as const;

const logger = new Logger('VariableExtractionErrorHandler');

/**
 * 分析错误并返回错误信息
 */
export function analyzeError(error: Error, context?: Record<string, unknown>): ErrorInfo {
  const errorMessage = error.message.toLowerCase();

  // 分析错误类型和严重程度
  if (errorMessage.includes('llm') || errorMessage.includes('provider')) {
    return {
      type: 'LLM_SERVICE',
      severity: 'MEDIUM',
      message: error.message,
      originalError: error,
      context,
      canRetry: true,
      canFallback: true,
    };
  }

  if (errorMessage.includes('database') || errorMessage.includes('prisma')) {
    return {
      type: 'DATABASE',
      severity: 'HIGH',
      message: error.message,
      originalError: error,
      context,
      canRetry: true,
      canFallback: false,
    };
  }

  if (errorMessage.includes('canvas') || errorMessage.includes('workflow')) {
    return {
      type: 'CANVAS_SERVICE',
      severity: 'MEDIUM',
      message: error.message,
      originalError: error,
      context,
      canRetry: true,
      canFallback: true,
    };
  }

  if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
    return {
      type: 'NETWORK',
      severity: 'MEDIUM',
      message: error.message,
      originalError: error,
      context,
      canRetry: true,
      canFallback: true,
    };
  }

  if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
    return {
      type: 'VALIDATION',
      severity: 'LOW',
      message: error.message,
      originalError: error,
      context,
      canRetry: false,
      canFallback: true,
    };
  }

  // 默认未知错误
  return {
    type: 'UNKNOWN',
    severity: 'HIGH',
    message: error.message,
    originalError: error,
    context,
    canRetry: false,
    canFallback: false,
  };
}

/**
 * 处理错误并决定是否抛出
 */
export function handleError(
  error: Error,
  context: Record<string, unknown>,
  shouldThrow = false,
): void {
  const errorInfo = analyzeError(error, context);

  // 记录错误日志
  logError(errorInfo);

  // 根据配置决定是否抛出错误
  if (shouldThrow || errorInfo.severity === 'CRITICAL') {
    throw error;
  }
}

/**
 * 记录错误日志
 */
function logError(errorInfo: ErrorInfo): void {
  const { type, severity, message, context } = errorInfo;

  const logMessage = `[${type}] [${severity}] ${message}`;
  const logContext = context ? ` Context: ${JSON.stringify(context)}` : '';

  switch (severity) {
    case 'CRITICAL':
      logger.error(logMessage + logContext);
      break;
    case 'HIGH':
      logger.error(logMessage + logContext);
      break;
    case 'MEDIUM':
      logger.warn(logMessage + logContext);
      break;
    case 'LOW':
      logger.log(logMessage + logContext);
      break;
  }
}

/**
 * 创建标准化的错误消息
 */
export function createErrorMessage(
  errorType: keyof typeof ERROR_MESSAGES,
  context?: Record<string, unknown>,
): string {
  const baseMessage = ERROR_MESSAGES[errorType];

  if (context) {
    const contextStr = Object.entries(context)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
    return `${baseMessage} (${contextStr})`;
  }

  return baseMessage;
}

/**
 * 判断错误是否可以重试
 */
export function canRetry(error: Error): boolean {
  const errorInfo = analyzeError(error);
  return errorInfo.canRetry;
}

/**
 * 判断错误是否可以降级处理
 */
export function canFallback(error: Error): boolean {
  const errorInfo = analyzeError(error);
  return errorInfo.canFallback;
}
