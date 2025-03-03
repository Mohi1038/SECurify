const { app, BrowserWindow } = require('electron');
const path = require('path');

function createTestWindow() {
    // Create the browser window
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    // Create a simple HTML content
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Network Monitor Test</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    padding: 20px;
                    background-color: #f0f0f0;
                }
                .container {
                    background-color: white;
                    padding: 20px;
                    border-radius: 5px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                button {
                    padding: 10px 20px;
                    background-color: #4CAF50;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                }
                button:hover {
                    background-color: #45a049;
                }
                #status {
                    margin-top: 20px;
                    padding: 10px;
                    border-radius: 4px;
                }
                .success {
                    background-color: #dff0d8;
                    color: #3c763d;
                }
                .error {
                    background-color: #f2dede;
                    color: #a94442;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Network Monitor Test Window</h1>
                <button id="testBtn">Test Connection</button>
                <div id="status"></div>
            </div>
            <script>
                document.getElementById('testBtn').addEventListener('click', () => {
                    const status = document.getElementById('status');
                    status.textContent = 'Electron.js is working correctly!';
                    status.className = 'success';
                });
            </script>
        </body>
        </html>
    `;

    // Create a temporary HTML file
    const fs = require('fs');
    const tempPath = path.join(__dirname, 'temp.html');
    fs.writeFileSync(tempPath, htmlContent);

    // Load the HTML file
    win.loadFile(tempPath);

    // Clean up the temporary file when the window is closed
    win.on('closed', () => {
        try {
            fs.unlinkSync(tempPath);
        } catch (err) {
            console.error('Error cleaning up:', err);
        }
    });

    // Open DevTools in development
    if (process.env.NODE_ENV === 'development') {
        win.webContents.openDevTools();
    }
}

app.whenReady().then(createTestWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createTestWindow();
    }
});
