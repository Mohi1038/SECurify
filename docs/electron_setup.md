# Electron.js Setup Guide

## Prerequisites Installation

### Installing Node.js

1. Download Node.js from [nodejs.org](https://nodejs.org/)
   - Choose LTS version for stability
   - The installer includes npm (Node Package Manager)

2. Verify installation:
```bash
node --version
npm --version
```

### Installing Development Tools

Windows users need additional build tools:
```bash
npm install --global windows-build-tools
```

## Project Initialization

### Creating the Electron Project

```bash
# Navigate to frontend directory
cd frontend

# Initialize Node.js project
npm init

# Install Electron
npm install electron --save-dev

# Install additional dependencies
npm install electron-store --save
npm install electron-builder --save-dev
```

### Project Structure

```
frontend/
├── src/
│   ├── main.js           # Main process
│   └── renderer.js       # Renderer process
├── public/
│   ├── index.html       # Main window
│   └── styles.css       # Styling
└── package.json         # Project configuration
```

## Configuration Files

### package.json Configuration

```json
{
  "name": "network-traffic-monitor",
  "version": "1.0.0",
  "main": "src/main.js",
  "scripts": {
    "start": "electron .",
    "dev": "electron . --debug",
    "build": "electron-builder",
    "pack": "electron-builder --dir",
    "dist": "electron-builder"
  },
  "build": {
    "appId": "com.yourapp.network-monitor",
    "directories": {
      "output": "dist"
    },
    "win": {
      "target": ["nsis", "portable"]
    },
    "mac": {
      "target": ["dmg", "zip"]
    },
    "linux": {
      "target": ["AppImage", "deb"]
    }
  }
}
```

### Basic Electron App Structure

1. Main Process (main.js):
```javascript
const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile('public/index.html');
  
  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    win.webContents.openDevTools();
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
```

2. Renderer Process (renderer.js):
```javascript
// Handle UI events and communicate with main process
const { ipcRenderer } = require('electron');

document.addEventListener('DOMContentLoaded', () => {
  // DOM manipulation and event handling
  const startButton = document.getElementById('start-capture');
  const stopButton = document.getElementById('stop-capture');

  startButton.addEventListener('click', () => {
    ipcRenderer.send('start-capture', { count: 100 });
    startButton.disabled = true;
    stopButton.disabled = false;
  });

  stopButton.addEventListener('click', () => {
    ipcRenderer.send('stop-capture');
    startButton.disabled = false;
    stopButton.disabled = true;
  });
});
```

## Development Workflow

1. Start the application:
```bash
npm start
```

2. Development with hot reload:
```bash
npm run dev
```

3. Building for distribution:
```bash
npm run build
```

## Debugging Tips

1. Enable Chrome DevTools:
```javascript
mainWindow.webContents.openDevTools();
```

2. Debug main process:
```bash
npm run dev
```

3. Common issues:
   - Module not found: Check your import paths
   - White screen: Check HTML file path
   - Security warnings: Review webPreferences settings

## Security Considerations

1. Content Security Policy in HTML:
```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self' 'unsafe-inline' 'unsafe-eval'">
```

2. IPC Communication:
   - Validate all IPC messages
   - Use channels specific to functionality
   - Avoid using remote module

3. Node Integration:
   - Only enable when necessary
   - Use contextBridge when possible
   - Implement proper security checks
