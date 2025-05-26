import log from 'electron-log/main';
import { app } from 'electron';
import path from 'node:path';

// Configure the logger
export const setupLogger = () => {
  // Initialize logger for renderer processes
  log.initialize();

  // Set log file path to user data directory
  log.transports.file.resolvePathFn = () => {
    return path.join(app.getPath('userData'), 'logs', 'main.log');
  };

  // Configure console transport
  log.transports.console.level = 'info';
  log.transports.console.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';

  // Configure file transport
  log.transports.file.level = 'debug';
  log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';

  // Enable error catching
  log.errorHandler.startCatching({
    showDialog: false,
    onError: (error) => {
      log.error('Unhandled error:', error);
      return false; // Don't prevent default error handling
    },
  });

  // Enable electron events logging
  log.eventLogger.startLogging({
    events: {
      app: {
        'certificate-error': true,
        'child-process-gone': true,
        'render-process-gone': true,
      },
      webContents: {
        crashed: true,
        'gpu-process-crashed': true,
        'did-fail-load': true,
        'did-fail-provisional-load': true,
        'plugin-crashed': true,
        'preload-error': true,
      },
    },
  });

  return log;
};

// Create scoped loggers for different services
export const createServiceLogger = (serviceName: string) => {
  return log.scope(serviceName);
};

// Export the main logger
export const logger = log;
export default logger;
