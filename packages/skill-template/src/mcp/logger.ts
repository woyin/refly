/**
 * LogLevel - Enum for different log levels
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * McpLogger - A simple logger for MCP server
 *
 * This class provides logging functionality with different log levels
 * to help with debugging and monitoring the MCP server.
 */
export class McpLogger {
  private level: LogLevel;

  /**
   * Create a new McpLogger instance
   *
   * @param level - The minimum log level to output (default: INFO)
   */
  constructor(level: LogLevel = LogLevel.INFO) {
    this.level = level;
  }

  /**
   * Set the minimum log level
   *
   * @param level - The new minimum log level
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Log a debug message
   *
   * @param message - The message to log
   * @param args - Additional arguments to log
   */
  debug(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  }

  /**
   * Log an info message
   *
   * @param message - The message to log
   * @param args - Additional arguments to log
   */
  info(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(`[INFO] ${message}`, ...args);
    }
  }

  /**
   * Log a warning message
   *
   * @param message - The message to log
   * @param args - Additional arguments to log
   */
  warn(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }

  /**
   * Log an error message
   *
   * @param message - The message to log
   * @param args - Additional arguments to log
   */
  error(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  }

  /**
   * Check if a message with the given level should be logged
   *
   * @param level - The log level to check
   * @returns Whether the message should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }
}
