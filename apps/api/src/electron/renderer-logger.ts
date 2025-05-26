import log from 'electron-log/renderer';

// Configure renderer logger
log.transports.console.level = 'info';
log.transports.console.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] (renderer) › {text}';

// Create scoped loggers for different parts of the renderer
export const createRendererLogger = (scope: string) => {
  return log.scope(scope);
};

// Export the main renderer logger
export const rendererLogger = log;
export default log;
