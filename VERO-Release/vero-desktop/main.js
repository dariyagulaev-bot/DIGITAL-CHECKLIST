// VERO desktop shell — a fully offline Windows application.
//
// It loads ONLY the local app bundle (resources/VERO.html) and nothing else:
//   • no network access, no external URL, no localhost, no auto-update;
//   • no Microsoft Edge / Internet Explorer / Chrome — VERO renders inside
//     Electron's own bundled Chromium, which ships with the app;
//   • all navigation away from the local file and all new windows are blocked;
//   • all runtime permission requests (camera, mic, geolocation, …) are denied.
//
// User data (IndexedDB: forms, signatures, images, users, certifications,
// exams) is stored permanently under the app's userData folder
// (%APPDATA%\VERO on Windows) and survives restarts and updates.

const { app, BrowserWindow, Menu, session } = require('electron');
const path = require('path');

// A single instance is enough for a kiosk-style station.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  let win = null;

  function createWindow() {
    win = new BrowserWindow({
      width: 1280,
      height: 800,
      show: false,
      backgroundColor: '#0f2b52',
      autoHideMenuBar: true,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        spellcheck: false,
        devTools: false, // set true only for IT debugging builds
        webviewTag: false,
      },
    });

    Menu.setApplicationMenu(null);
    win.loadFile(path.join(__dirname, 'resources', 'VERO.html'));
    win.once('ready-to-show', () => {
      win.maximize();
      win.show();
    });

    // Block ANY navigation away from the local bundle and any popup/new window.
    win.webContents.on('will-navigate', (e) => e.preventDefault());
    win.webContents.on('will-redirect', (e) => e.preventDefault());
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  }

  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    // Deny every permission request — VERO needs none of them offline.
    session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
    // Belt-and-braces: refuse any attempt to open an external protocol.
    session.defaultSession.setPermissionCheckHandler(() => false);

    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => app.quit());
}
