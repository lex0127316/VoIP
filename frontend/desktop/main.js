const { app, BrowserWindow, nativeImage, Tray, Menu, Notification } = require('electron');
const path = require('path');

let tray;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });

  const url = process.env.DESKTOP_APP_URL || 'http://localhost:3000';
  win.loadURL(url);
}

app.whenReady().then(() => {
  createWindow();

  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open', click: () => createWindow() },
    { label: 'Quit', click: () => app.quit() }
  ]);
  tray.setToolTip('VoIP Desktop');
  tray.setContextMenu(contextMenu);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});


