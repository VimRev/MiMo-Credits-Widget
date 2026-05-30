const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const config = require('./config');
const logger = require('./logger');

app.disableHardwareAcceleration();

let mainWindow = null;

function roundedRectShape(width, height, radius) {
  const rects = [];
  const step = 2;

  for (let y = 0; y < height; y += step) {
    const top = y < radius;
    const bottom = y >= height - radius;
    let inset = 0;

    if (top || bottom) {
      const dy = top ? radius - y - 0.5 : y - (height - radius) + 0.5;
      inset = Math.ceil(radius - Math.sqrt(Math.max(radius * radius - dy * dy, 0)));
    }

    rects.push({
      x: inset,
      y,
      width: Math.max(width - inset * 2, 0),
      height: Math.min(step, height - y),
    });
  }
  return rects;
}

function createWindow() {
  logger.info('main', 'createWindow() called');

  const { width: sw } = screen.getPrimaryDisplay().workAreaSize;
  const { width: w, height: h, yOffset } = config.window;

  mainWindow = new BrowserWindow({
    title: '',
    width: w,
    height: h,
    x: Math.round((sw - w) / 2),
    y: yOffset,
    useContentSize: true,
    frame: false,
    transparent: false,
    resizable: false,
    movable: true,
    skipTaskbar: true,
    autoHideMenuBar: true,
    alwaysOnTop: true,
    show: false,
    hasShadow: false,
    backgroundColor: '#111217',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.setBackgroundColor('#111217');
  mainWindow.setShape(roundedRectShape(w, h, 14));

  mainWindow.on('page-title-updated', (event) => {
    event.preventDefault();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setTitle('');
    }
  });

  mainWindow.once('ready-to-show', () => {
    logger.info('main', 'ready-to-show');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setTitle('');
      mainWindow.showInactive();
    }
  });

  mainWindow.loadFile('index.html').then(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setTitle('');
    }
  });

  mainWindow.on('blur', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
    }
  });

  mainWindow.on('closed', () => {
    logger.info('main', 'window closed');
    mainWindow = null;
  });
}

ipcMain.on('window:close', () => {
  logger.info('main', 'window:close IPC received');
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
  }
  app.quit();
});

ipcMain.handle('config:get', () => ({
  build: config.build,
  serviceUrl: config.serviceUrl,
  refreshInterval: config.refreshInterval,
  requestTimeout: config.requestTimeout,
}));

ipcMain.on('log', (_event, level, message, meta) => {
  logger.logFromRenderer(level, message, meta);
});

app.whenReady().then(() => {
  logger.info('main', 'app.whenReady');
  createWindow();
});

app.on('window-all-closed', () => {
  logger.info('main', 'window-all-closed, quitting');
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
