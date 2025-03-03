const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const os = require('os');
const fs = require('fs');
const { execSync } = require('child_process');

// Check if app is running as administrator (Windows only)
function isRunningAsAdmin() {
  if (process.platform === 'win32') {
    try {
      // Create a test file in a protected directory
      const testPath = 'C:\\Windows\\Temp\\admin_test';
      fs.writeFileSync(testPath, '');
      fs.unlinkSync(testPath);
      return true;
    } catch (e) {
      return false;
    }
  }
  return process.getuid && process.getuid() === 0;
}

// Request admin privileges by relaunching with runas
function requestAdminPrivileges() {
  if (process.platform === 'win32') {
    const appPath = process.execPath;
    const args = process.argv.slice(1);
    
    // Use the run_as_admin.bat script
    const batchPath = path.join(app.getAppPath(), '..', 'run_as_admin.bat');
    exec(`start "" "${batchPath}"`, (error) => {
      if (error) {
        dialog.showErrorBox(
          'Error',
          'Failed to restart with admin privileges. Please run the application as administrator manually.'
        );
      }
      app.quit();
    });
    return true;
  }
  return false;
}

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

app.whenReady().then(async () => {
  // Check admin privileges at startup
  if (!isRunningAsAdmin()) {
    const response = await dialog.showMessageBox({
      type: 'warning',
      title: 'Administrator Privileges Required',
      message: 'This application requires administrator privileges to capture network traffic.',
      buttons: ['Run as Administrator', 'Exit'],
      defaultId: 0,
      cancelId: 1
    });

    if (response.response === 0) {
      requestAdminPrivileges();
      return;
    } else {
      app.quit();
      return;
    }
  }

  createWindow();
});

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

// System check handler
ipcMain.handle('check-system', async () => {
  const pythonProcess = spawn('python', [
    path.join(__dirname, '../../backend/src/system_check.py')
  ]);

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (chunk) => {
      stdout += chunk;
    });

    pythonProcess.stderr.on('data', (chunk) => {
      stderr += chunk;
    });

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, message: stdout });
      } else {
        reject(new Error(`System check failed:\n${stdout}\n${stderr}`));
      }
    });

    pythonProcess.on('error', (error) => {
      reject(new Error(`Failed to start Python: ${error.message}`));
    });
  });
});

// Network statistics tracking
let previousStats = {
  bytesReceived: 0,
  bytesSent: 0,
  timestamp: Date.now()
};

ipcMain.handle('get-network-stats', async () => {
  const interfaces = os.networkInterfaces();
  let currentStats = {
    bytesReceived: 0,
    bytesSent: 0,
    timestamp: Date.now()
  };

  // Sum up statistics from all interfaces
  Object.values(interfaces).flat().forEach(interface => {
    if (interface.internal) return; // Skip loopback interface
    
    try {
      const stats = fs.readFileSync(`/sys/class/net/${interface.name}/statistics/rx_bytes`);
      currentStats.bytesReceived += parseInt(stats);
      
      const txStats = fs.readFileSync(`/sys/class/net/${interface.name}/statistics/tx_bytes`);
      currentStats.bytesSent += parseInt(txStats);
    } catch (error) {
      // Fallback for Windows using netstat
      const netstat = execSync('netstat -e').toString();
      const lines = netstat.split('\n');
      if (lines.length > 2) {
        const stats = lines[2].trim().split(/\s+/);
        currentStats.bytesReceived = parseInt(stats[1]);
        currentStats.bytesSent = parseInt(stats[2]);
      }
    }
  });

  // Calculate rates
  const timeDiff = (currentStats.timestamp - previousStats.timestamp) / 1000; // in seconds
  const rates = {
    bytesReceived: (currentStats.bytesReceived - previousStats.bytesReceived) / timeDiff,
    bytesSent: (currentStats.bytesSent - previousStats.bytesSent) / timeDiff
  };

  previousStats = currentStats;
  return rates;
});

// Interface listing handler
ipcMain.handle('list-interfaces', async () => {
  const pythonProcess = spawn('python', [
    path.join(__dirname, '../../backend/src/test_capture.py'),
    '--list-interfaces'
  ]);

  return new Promise((resolve, reject) => {
    let data = '';
    pythonProcess.stdout.on('data', (chunk) => {
      data += chunk;
    });
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        try {
          // Parse the interface list from the output
          const interfaces = data
            .split('\n')
            .filter(line => line.match(/^\d+\./))
            .map(line => {
              const match = line.match(/^(\d+)\.\s+(.+?)\s+\(IP: (.+?)\)/);
              if (match) {
                return {
                  id: parseInt(match[1]),
                  name: match[2].trim(),
                  ip: match[3]
                };
              }
              return null;
            })
            .filter(Boolean);
          resolve(interfaces);
        } catch (error) {
          reject(new Error('Failed to parse interface list'));
        }
      } else {
        reject(new Error('Failed to get interface list'));
      }
    });
  });
});

// Keep track of active capture processes
let captureProcess = null;

// Stop capture handler
ipcMain.on('stop-capture', (event) => {
  if (captureProcess) {
    try {
      // On Windows
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', captureProcess.pid, '/f', '/t']);
      } else {
        // On Unix
        captureProcess.kill();
      }
    } catch (e) {
      console.error('Failed to kill process:', e);
    }
    captureProcess = null;
  }
});

// Communication with the Python backend
ipcMain.on('start-capture', async (event, options) => {
  try {
    // Run system check
    const checkResult = await new Promise((resolve, reject) => {
      const pythonProcess = spawn('python', [
        path.join(__dirname, '../../backend/src/system_check.py')
      ]);

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (chunk) => stdout += chunk);
      pythonProcess.stderr.on('data', (chunk) => stderr += chunk);

      pythonProcess.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, message: stdout });
        } else {
          reject(new Error(`System check failed:\n${stdout}\n${stderr}`));
        }
      });

      pythonProcess.on('error', (error) => {
        reject(new Error(`Failed to start Python: ${error.message}`));
      });
    });

    // Stop any existing capture
    if (captureProcess) {
      event.sender.send('capture-error', 'Stopping previous capture...');
      ipcMain.emit('stop-capture');
    }

    // Start capture if system check passes
    captureProcess = spawn('python', [
      path.join(__dirname, '../../backend/src/packet_capture.py'),
      '--count', options.count || 10,
      '--interface', options.interface || ''
    ]);

    // Show PID for debugging
    console.log(`Started capture process with PID: ${captureProcess.pid}`);

    captureProcess.stdout.on('data', (data) => {
      const lines = data.toString().trim().split('\n');
      lines.forEach(line => {
        if (line.trim()) {
          event.sender.send('capture-data', line.trim());
        }
      });
    });

    captureProcess.stderr.on('data', (data) => {
      event.sender.send('capture-error', data.toString());
    });

    captureProcess.on('close', (code) => {
      if (code !== 0) {
        event.sender.send('capture-error', `Process exited with code ${code}`);
      }
      captureProcess = null;
    });

    captureProcess.on('error', (err) => {
      event.sender.send('capture-error', `Failed to start capture: ${err.message}`);
      captureProcess = null;
    });

  } catch (error) {
    event.sender.send('capture-error', `Setup Error: ${error.message}\n\nPlease ensure:\n1. Python 3.8+ is installed\n2. Npcap/libpcap is installed\n3. Running with admin privileges`);
  }
});

// Storage handling
ipcMain.handle('list-captures', async () => {
  const pythonProcess = spawn('python', [
    path.join(__dirname, '../../backend/src/packet_capture.py'),
    '--list-captures'
  ]);

  return new Promise((resolve, reject) => {
    let data = '';
    pythonProcess.stdout.on('data', (chunk) => {
      data += chunk;
    });
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        resolve(JSON.parse(data));
      } else {
        reject(new Error('Failed to list captures'));
      }
    });
  });
});

ipcMain.handle('load-capture', async (event, filename) => {
  const pythonProcess = spawn('python', [
    path.join(__dirname, '../../backend/src/packet_capture.py'),
    '--load', filename
  ]);

  return new Promise((resolve, reject) => {
    let data = '';
    pythonProcess.stdout.on('data', (chunk) => {
      data += chunk;
    });
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        resolve(JSON.parse(data));
      } else {
        reject(new Error('Failed to load capture'));
      }
    });
  });
});
