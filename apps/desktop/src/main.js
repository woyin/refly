const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const isNumber = require('is-number');
const log = require('electron-log/main');

// Optional, initialize the logger for any renderer process
log.initialize();

log.info('Log from the main process');

const createWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  win.loadFile(path.join(__dirname, 'index.html'));
};

log.info('isNumber', isNumber('123'));

app.whenReady().then(() => {
  ipcMain.handle('ping', () => 'pong');
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
