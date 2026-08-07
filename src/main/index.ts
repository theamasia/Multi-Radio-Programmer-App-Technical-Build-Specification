import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';
import { registerSerialIpc } from './ipc/serial.ipc.js';

const isDev = !app.isPackaged;

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // Required so the preload script can load CommonJS.
    },
  });

  window.once('ready-to-show', () => window.show());

  if (isDev) {
    void window.loadURL('http://localhost:5173');
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

// A second instance would contend for the same serial port and SQLite file.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  void app.whenReady().then(() => {
    registerSerialIpc();
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
