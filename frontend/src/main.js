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
  startRealTrafficCapture();
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

// Initialize network stats history
const networkStatsHistory = {
  timestamps: [],
  bytesReceived: [],
  bytesSent: []
};

// Real traffic capture process
let realTrafficCaptureProcess = null;
let realConnectionsData = [];
let lastConnectionUpdate = Date.now();

// Start real traffic capture
function startRealTrafficCapture() {
  if (realTrafficCaptureProcess) {
    console.log('Real traffic capture already running');
    return;
  }

  const scriptPath = path.join(__dirname, '../../backend/src/real_traffic_capture.py');
  
  try {
    // Set a specific port for the HTTP server
    const serverPort = 8000;
    
    realTrafficCaptureProcess = spawn('python', [
      scriptPath,
      '--serve',
      '--port', serverPort.toString(),
      '--debug',
      '--simulate' // Add simulation flag to generate test data if no real connections
    ]);

    console.log(`Started real traffic capture with PID: ${realTrafficCaptureProcess.pid}`);

    realTrafficCaptureProcess.stdout.on('data', (data) => {
      console.log(`Capture output: ${data}`);
    });

    realTrafficCaptureProcess.stderr.on('data', (data) => {
      console.error(`Capture error: ${data}`);
    });

    realTrafficCaptureProcess.on('close', (code) => {
      console.log(`Capture process exited with code ${code}`);
      realTrafficCaptureProcess = null;
      
      // If it crashed and code is non-zero, try to restart after a delay
      if (code !== 0 && code !== null) {
        console.log('Attempting to restart capture process in 5 seconds...');
        setTimeout(() => {
          if (!realTrafficCaptureProcess) {
            startRealTrafficCapture();
          }
        }, 5000);
      }
    });

    realTrafficCaptureProcess.on('error', (err) => {
      console.error(`Failed to start capture process: ${err.message}`);
      realTrafficCaptureProcess = null;
    });

    // Wait a bit for the server to start before polling
    setTimeout(() => {
      pollRealConnectionData(serverPort);
    }, 2000);
  } catch (error) {
    console.error('Failed to start real traffic capture:', error);
  }
}

// Stop real traffic capture
function stopRealTrafficCapture() {
  if (realTrafficCaptureProcess) {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', realTrafficCaptureProcess.pid, '/f', '/t']);
    } else {
      realTrafficCaptureProcess.kill();
    }
    realTrafficCaptureProcess = null;
    console.log('Stopped real traffic capture');
  }
}

// Poll for real connection data
function pollRealConnectionData(port = 8000) {
  const http = require('http');
  let connectionFailures = 0;
  const maxFailures = 5; // After this many consecutive failures, try alternative approach
  
  function fetchData() {
    // Try IPv4 address explicitly (127.0.0.1) instead of localhost or ::1
    const options = {
      hostname: '127.0.0.1',
      port: port,
      path: '/connections',
      method: 'GET',
      timeout: 2000, // 2 second timeout
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const responseData = JSON.parse(data);
            
            // Handle the case where we get diagnostics along with connections
            if (responseData.connections) {
              realConnectionsData = responseData.connections;
              
              // Log diagnostics if available
              if (responseData.diagnostics) {
                console.log('Capture diagnostics:', responseData.diagnostics);
              }
            } else {
              // Standard format with just connections array
              realConnectionsData = responseData;
            }
            
            lastConnectionUpdate = Date.now();
            connectionFailures = 0; // Reset failure counter on success
            console.log(`Updated connections data: ${realConnectionsData.length} connections`);
          } else {
            console.error(`HTTP error: ${res.statusCode}`);
            connectionFailures++;
          }
        } catch (error) {
          console.error('Error parsing connections data:', error);
          connectionFailures++;
        }
        
        // Schedule next poll
        setTimeout(fetchData, 2000);
      });
    });
    
    req.on('error', (err) => {
      console.error('Error fetching connections data:', err);
      connectionFailures++;
      
      // After several failures, try restarting the capture process
      if (connectionFailures >= maxFailures) {
        console.log(`${maxFailures} consecutive connection failures. Attempting to restart capture...`);
        stopRealTrafficCapture();
        setTimeout(startRealTrafficCapture, 2000);
        connectionFailures = 0;
      } else {
        // Otherwise, retry after a delay
        setTimeout(fetchData, 5000);
      }
    });
    
    req.end();
  }
  
  // Start polling
  fetchData();
}

// IPC handlers for real traffic data
ipcMain.handle('start-real-traffic-capture', async () => {
  startRealTrafficCapture();
  return { success: true };
});

ipcMain.handle('stop-real-traffic-capture', async () => {
  stopRealTrafficCapture();
  return { success: true };
});

ipcMain.handle('get-real-connections', async () => {
  return {
    connections: realConnectionsData,
    lastUpdate: lastConnectionUpdate
  };
});

// Updated network stats handler with improved platform support
ipcMain.handle('get-network-stats', async () => {
  let currentStats = {
    bytesReceived: 0,
    bytesSent: 0,
    timestamp: Date.now()
  };

  try {
    const interfaces = os.networkInterfaces();
    
    if (process.platform === 'win32') {
      // Windows implementation using netstat
      const netstat = execSync('netstat -e').toString();
      const lines = netstat.split('\n');
      
      // Parse the output based on the format
      if (lines.length > 4) {
        const stats = lines[4].trim().split(/\s+/);
        if (stats.length >= 2) {
          currentStats.bytesReceived = parseInt(stats[1].replace(/,/g, ''));
          currentStats.bytesSent = parseInt(stats[2].replace(/,/g, ''));
        }
      }
    } else {
      // Linux/Unix implementation using /sys/class/net
      for (const [name, netInterfaces] of Object.entries(interfaces)) {
        // Skip loopback and inactive interfaces
        if (name === 'lo' || netInterfaces.every(i => !i.internal)) continue;
        
        try {
          const rxBytes = fs.readFileSync(`/sys/class/net/${name}/statistics/rx_bytes`);
          const txBytes = fs.readFileSync(`/sys/class/net/${name}/statistics/tx_bytes`);
          
          currentStats.bytesReceived += parseInt(rxBytes);
          currentStats.bytesSent += parseInt(txBytes);
        } catch (err) {
          // Silently skip this interface if files don't exist
        }
      }
    }
  } catch (err) {
    console.error('Error getting network stats:', err);
    
    // Fallback to random data for demo purposes
    currentStats.bytesReceived = Math.random() * 1024 * 50; // Random up to 50KB/s
    currentStats.bytesSent = Math.random() * 1024 * 30;     // Random up to 30KB/s
  }

  // Calculate rates
  const timeDiff = (currentStats.timestamp - previousStats.timestamp) / 1000; // in seconds
  const rates = {
    bytesReceived: Math.max(0, (currentStats.bytesReceived - previousStats.bytesReceived) / timeDiff),
    bytesSent: Math.max(0, (currentStats.bytesSent - previousStats.bytesSent) / timeDiff)
  };

  // Store current stats for next calculation
  previousStats = currentStats;
  
  // Add to history (keep last 30 points)
  if (networkStatsHistory.timestamps.length >= 30) {
    networkStatsHistory.timestamps.shift();
    networkStatsHistory.bytesReceived.shift();
    networkStatsHistory.bytesSent.shift();
  }
  
  networkStatsHistory.timestamps.push(new Date().toISOString());
  networkStatsHistory.bytesReceived.push(rates.bytesReceived);
  networkStatsHistory.bytesSent.push(rates.bytesSent);

  return rates;
});

// New handler to get historical network stats
ipcMain.handle('get-network-stats-history', async () => {
  return networkStatsHistory;
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

app.on('will-quit', () => {
  stopRealTrafficCapture();
});

// Add a handler for blocking connections
ipcMain.handle('block-connection', async (event, connectionDetails) => {
  try {
    // Run the Python script to block the connection
    const pythonProcess = spawn('python', [
      path.join(__dirname, '../../backend/src/block_connection.py'),
      '--source-ip', connectionDetails.sourceIp || 'any',
      '--source-port', connectionDetails.sourcePort.toString() || 'any',
      '--dest-ip', connectionDetails.destIp || 'any',
      '--dest-port', connectionDetails.destPort.toString() || 'any',
      '--protocol', connectionDetails.protocol || 'TCP'
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
          try {
            const result = JSON.parse(stdout);
            resolve(result);
          } catch (error) {
            resolve({ success: false, error: 'Failed to parse response' });
          }
        } else {
          resolve({
            success: false,
            error: `Block connection failed with code ${code}\n${stderr}`
          });
        }
      });

      pythonProcess.on('error', (error) => {
        resolve({
          success: false,
          error: `Failed to start Python script: ${error.message}`
        });
      });
    });
  } catch (error) {
    return {
      success: false,
      error: `Block connection error: ${error.message}`
    };
  }
});

// Add a handler for unblocking connections
ipcMain.handle('unblock-connection', async (event, ruleId) => {
  try {
    // Run the Python script to unblock the connection
    const pythonProcess = spawn('python', [
      path.join(__dirname, '../../backend/src/block_connection.py'),
      '--unblock',
      '--rule-id', ruleId
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
          try {
            const result = JSON.parse(stdout);
            resolve(result);
          } catch (error) {
            resolve({ success: false, error: 'Failed to parse response' });
          }
        } else {
          resolve({
            success: false, 
            error: `Unblock connection failed with code ${code}\n${stderr}`
          });
        }
      });

      pythonProcess.on('error', (error) => {
        resolve({
          success: false,
          error: `Failed to start Python script: ${error.message}`
        });
      });
    });
  } catch (error) {
    return {
      success: false,
      error: `Unblock connection error: ${error.message}`
    };
  }
});

// Add a handler for listing blocked connections
ipcMain.handle('list-blocked-connections', async () => {
  try {
    // Run the Python script to list blocked connections
    const pythonProcess = spawn('python', [
      path.join(__dirname, '../../backend/src/block_connection.py'),
      '--list'
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
          try {
            const result = JSON.parse(stdout);
            resolve(result);
          } catch (error) {
            resolve({ success: false, error: 'Failed to parse response', blockedConnections: [] });
          }
        } else {
          resolve({
            success: false,
            error: `List blocked connections failed with code ${code}\n${stderr}`,
            blockedConnections: []
          });
        }
      });

      pythonProcess.on('error', (error) => {
        resolve({
          success: false,
          error: `Failed to start Python script: ${error.message}`,
          blockedConnections: []
        });
      });
    });
  } catch (error) {
    return {
      success: false,
      error: `List blocked connections error: ${error.message}`,
      blockedConnections: []
    };
  }
});
