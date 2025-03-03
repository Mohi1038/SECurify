const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

// Keep a global reference of the window object
let mainWindow;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Load the index.html file
  mainWindow.loadFile(path.join(__dirname, '../public/index.html'));

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Communication with the Python backend
ipcMain.on('start-capture', (event, options) => {
  const pythonProcess = spawn('python', [
    path.join(__dirname, '../../backend/src/packet_capture.py'),
    '--count', options.count || 10
  ]);

  pythonProcess.stdout.on('data', (data) => {
    event.sender.send('capture-data', data.toString());
  });

  pythonProcess.stderr.on('data', (data) => {
    event.sender.send('capture-error', data.toString());
  });
});
