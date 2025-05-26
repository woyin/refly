import '../register-aliases';

import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';

import { setupLogger, createServiceLogger } from './logger';
import { shutdownRedisServer, startRedisServer } from './services/redis';
import { startQdrantServer, shutdownQdrantServer } from './services/qdrant';
import { shutdownApiServer, startApiServer } from './services/api';
import { runDiagnostics, logDiagnosticsSummary } from './diagnostics';

// Initialize logger
setupLogger();
const mainLogger = createServiceLogger('main');

mainLogger.info('Starting Refly Desktop Application');

// Add comprehensive error handling for unhandled rejections and exceptions
process.on('uncaughtException', (error) => {
  mainLogger.error('Uncaught Exception - App will not quit automatically:', error);
  // Don't exit automatically - let the user see the error
});

process.on('unhandledRejection', (reason, promise) => {
  mainLogger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit automatically - let the user see the error
});

// Add warning handler
process.on('warning', (warning) => {
  mainLogger.warn('Node.js Warning:', {
    name: warning.name,
    message: warning.message,
    stack: warning.stack,
  });
});

// Log when the process is about to exit
process.on('beforeExit', (code) => {
  mainLogger.info('Process beforeExit event with code:', code);
});

process.on('exit', (code) => {
  mainLogger.info('Process exit event with code:', code);
});

// Handle SIGINT and SIGTERM gracefully
process.on('SIGINT', () => {
  mainLogger.info('Received SIGINT, shutting down gracefully');
  app.quit();
});

process.on('SIGTERM', () => {
  mainLogger.info('Received SIGTERM, shutting down gracefully');
  app.quit();
});

process.env.APP_ROOT = path.join(__dirname, '..');

export const VITE_DEV_SERVER_URL = 'http://localhost:5173';
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'renderer');

process.env.VITE_PUBLIC = RENDERER_DIST || path.join(process.env.APP_ROOT, 'public');

let win: BrowserWindow | null;
let servicesStarted = false;

async function startServices() {
  if (servicesStarted) {
    mainLogger.info('Services already started, skipping');
    return;
  }

  // Run diagnostics first
  mainLogger.info('Running system diagnostics...');
  try {
    const diagnosticResults = await runDiagnostics();
    const summary = logDiagnosticsSummary(diagnosticResults);

    if (summary.hasErrors) {
      const errorMessages = diagnosticResults
        .filter((r) => r.status === 'error')
        .map((r) => r.message)
        .join('\n');

      throw new Error(`System diagnostics failed:\n${errorMessages}`);
    }

    if (summary.hasWarnings) {
      mainLogger.warn('System diagnostics completed with warnings, but continuing startup');
    } else {
      mainLogger.info('System diagnostics passed successfully');
    }
  } catch (error) {
    mainLogger.error('Diagnostics failed:', error);
    throw error;
  }

  try {
    mainLogger.info('Starting services...');

    // Start Redis with timeout and retry logic
    mainLogger.info('Starting Redis server...');
    const redisPort = await Promise.race([
      startRedisServer(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Redis startup timeout')), 30000),
      ),
    ]);
    process.env.REDIS_PORT = String(redisPort);
    mainLogger.info(`Redis server started successfully on port ${redisPort}`);

    // Start Qdrant with timeout and retry logic
    mainLogger.info('Starting Qdrant server...');
    const { httpPort: qdrantPort } = await Promise.race([
      startQdrantServer(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Qdrant startup timeout')), 30000),
      ),
    ]);
    process.env.QDRANT_PORT = String(qdrantPort);
    mainLogger.info(`Qdrant server started successfully on port ${qdrantPort}`);

    // Start API server with timeout
    mainLogger.info('Starting API server...');
    await Promise.race([
      startApiServer(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('API server startup timeout')), 60000),
      ),
    ]);
    mainLogger.info('API server started successfully');

    servicesStarted = true;
    mainLogger.info('All services started successfully');
  } catch (error) {
    mainLogger.error('Critical error starting services:', error);

    // Show error dialog to user instead of silent quit
    const { dialog } = require('electron');
    const result = await dialog.showMessageBox({
      type: 'error',
      title: 'Service Startup Error',
      message: 'Failed to start required services',
      detail: `Error: ${error instanceof Error ? error.message : String(error)}\n\nThe application cannot continue without these services. Would you like to retry or exit?`,
      buttons: ['Retry', 'Exit'],
      defaultId: 0,
      cancelId: 1,
    });

    if (result.response === 0) {
      // Retry
      mainLogger.info('User chose to retry service startup');
      servicesStarted = false;
      return startServices();
    } else {
      // Exit
      mainLogger.info('User chose to exit after service startup failure');
      app.quit();
    }
  }
}

async function createWindow() {
  mainLogger.info('App starting up', {
    appPath: app.getPath('userData'),
    systemLocale: app.getSystemLocale(),
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    electronVersion: process.versions.electron,
  });

  // Start services before creating window
  await startServices();

  win = new BrowserWindow({
    height: 1080,
    width: 1920,
    icon: path.join(process.env.VITE_PUBLIC, 'logo.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true,
      allowRunningInsecureContent: false,
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false, // Don't show until ready
  });

  // Handle window events
  win.on('closed', () => {
    mainLogger.info('Main window closed');
    win = null;
  });

  win.on('unresponsive', () => {
    mainLogger.warn('Main window became unresponsive');
  });

  win.on('responsive', () => {
    mainLogger.info('Main window became responsive again');
  });

  // Handle web contents events
  // win.webContents.on('destroyed', (event, killed) => {
  //   mainLogger.error('Renderer process crashed', { killed });
  // });

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    mainLogger.error('Failed to load page', {
      errorCode,
      errorDescription,
      validatedURL,
    });
  });

  win.webContents.on(
    'did-fail-provisional-load',
    (_event, errorCode, errorDescription, validatedURL) => {
      mainLogger.error('Failed provisional load', {
        errorCode,
        errorDescription,
        validatedURL,
      });
    },
  );

  win.webContents.session.setPermissionRequestHandler((webContents, _permission, callback) => {
    const url = webContents.getURL();
    if (url.startsWith('http://localhost:') || url.startsWith('https://localhost:')) {
      callback(true);
      return;
    }

    callback(false);
  });

  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          `connect-src 'self' ${process.env.RF_API_BASE_URL} ws: wss: http://localhost:* https://localhost:*`,
        ],
      },
    });
  });

  ipcMain.handle('getRedisUrl', () => {
    return process.env.REDIS_URL;
  });

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    mainLogger.debug('Renderer process finished loading');
    win?.webContents.send('main-process-message', new Date().toLocaleString());

    // Show window after everything is loaded
    if (win && !win.isDestroyed()) {
      win.show();
      mainLogger.info('Main window shown to user');
    }
  });

  try {
    if (VITE_DEV_SERVER_URL) {
      mainLogger.info(`Loading development server: ${VITE_DEV_SERVER_URL}`);
      await win.loadURL(VITE_DEV_SERVER_URL);
    } else {
      const indexPath = path.join(RENDERER_DIST, 'index.html');
      mainLogger.info(`Loading production build: ${indexPath}`);
      await win.loadFile(indexPath);
    }
  } catch (error) {
    mainLogger.error('Failed to load application:', error);

    // Show error to user
    const { dialog } = require('electron');
    await dialog.showErrorBox(
      'Application Load Error',
      `Failed to load the application: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

app.commandLine.appendSwitch('ignore-certificate-errors');

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    mainLogger.info('All windows closed, quitting application');
    app.quit();
    win = null;
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    mainLogger.info('App activated, creating new window');
    createWindow().catch((error) => {
      mainLogger.error('Failed to create window on activate:', error);
    });
  }
});

app.on('before-quit', () => {
  mainLogger.info('App before-quit event triggered');
});

app.on('will-quit', () => {
  mainLogger.info('App will-quit event triggered');
});

app
  .whenReady()
  .then(() => {
    mainLogger.info('Electron app is ready, creating window');
    createWindow().catch((error) => {
      mainLogger.error('Failed to create window when ready:', error);
      app.quit();
    });
  })
  .catch((error) => {
    mainLogger.error('Error in app.whenReady():', error);
    app.quit();
  });

// Clean up on app quit
app.on('quit', async () => {
  mainLogger.info('App is quitting, shutting down services');

  try {
    shutdownRedisServer();
    shutdownQdrantServer();
    await shutdownApiServer();
    mainLogger.info('All services shut down successfully');
  } catch (error) {
    mainLogger.error('Error during service shutdown:', error);
  }
});
