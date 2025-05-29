import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import log from 'electron-log/main';
import { startApiServerForElectron, shutdownApiServer } from '@refly/api';

// Optional, initialize the logger for any renderer process
log.initialize();

process.env.APP_ROOT = __dirname;
process.env.MODE = 'desktop';

export const VITE_DEV_SERVER_URL = 'http://localhost:5173';
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'renderer');

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST;

log.info(`Starting Refly Desktop Application, app root: ${process.env.APP_ROOT}`);

let servicesStarted = false;

async function startServices() {
  if (servicesStarted) {
    log.info('Services already started, skipping');
    return;
  }

  try {
    log.info('Starting API server...');
    await Promise.race([
      startApiServerForElectron(app.getPath('userData'), log),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('API server startup timeout')), 60000),
      ),
    ]);
    log.info('API server started successfully');

    servicesStarted = true;
    log.info('All services started successfully');
  } catch (error) {
    log.error('Critical error starting services:', error);

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
      log.info('User chose to retry service startup');
      servicesStarted = false;
      return startServices();
    } else {
      // Exit
      log.info('User chose to exit after service startup failure');
      app.quit();
    }
  }
}

const createWindow = async () => {
  // Start services before creating window
  await startServices();

  const win = new BrowserWindow({
    width: 1920,
    height: 1080,
    icon: path.join(process.env.VITE_PUBLIC, 'logo.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (process.env.NODE_ENV === 'development') {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'));
  }
};

app.whenReady().then(() => {
  ipcMain.handle('ping', () => 'pong');
  createWindow().catch((error) => {
    log.error('Failed to create window when ready:', error);
    app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0)
      createWindow().catch((error) => {
        log.error('Failed to create window when ready:', error);
        app.quit();
      });
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Clean up on app quit
app.on('quit', async () => {
  await shutdownApiServer(log);
});
