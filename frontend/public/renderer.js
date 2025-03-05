const { ipcRenderer } = require('electron');

// Elements
const interfaceSelect = document.getElementById('interface-select');
const packetCount = document.getElementById('packet-count');
const startButton = document.getElementById('start-capture');
const stopButton = document.getElementById('stop-capture');
const packetData = document.getElementById('packet-data');
const packetDetails = document.getElementById('packet-details');

// Track current capture
let captureRunning = false;
let captureProcess = null;

// Load network interfaces
async function loadInterfaces() {
    try {
        const interfaces = await ipcRenderer.invoke('list-interfaces');
        console.log('Interfaces:', interfaces);
        
        if (interfaceSelect) {
            interfaceSelect.innerHTML = `
                <option value="">Select Interface</option>
                ${interfaces.map(iface => 
                    `<option value="${iface.name}">${iface.name} (${iface.ip})</option>`
                ).join('')}
            `;
        }
    } catch (error) {
        console.error('Failed to load interfaces:', error);
        showError(`Failed to load interfaces: ${error.message}`);
        if (interfaceSelect) {
            interfaceSelect.innerHTML = '<option value="">Error loading interfaces</option>';
        }
    }
}

// Start capture
if (startButton) {
    startButton.addEventListener('click', () => {
        const interface = interfaceSelect ? interfaceSelect.value : '';
        const count = packetCount ? parseInt(packetCount.value) : 10;
        
        if (!interface) {
            alert('Please select a network interface');
            return;
        }

        // Clear previous data
        if (packetData) packetData.innerHTML = '';
        if (packetDetails) packetDetails.textContent = 'Capture in progress...';
        
        // Update button states
        startButton.disabled = true;
        if (stopButton) stopButton.disabled = false;
        captureRunning = true;
        
        // Start capture
        console.log(`Starting capture on interface: ${interface}, count: ${count}`);
        ipcRenderer.send('start-capture', {
            interface: interface,
            count: count
        });
    });
}

// Stop capture
if (stopButton) {
    stopButton.addEventListener('click', () => {
        ipcRenderer.send('stop-capture');
        captureRunning = false;
        if (startButton) startButton.disabled = false;
        stopButton.disabled = true;
        if (packetDetails) packetDetails.textContent = 'Capture stopped.';
    });
}

// Handle capture data
ipcRenderer.on('capture-data', (event, data) => {
    console.log('Received packet data:', data);
    
    if (!packetData) return;
    
    try {
        // Parse the data if it's JSON
        const packetInfo = JSON.parse(data);
        
        // Create a new row for the packet
        const row = document.createElement('tr');
        
        // Format the timestamp
        const timestamp = new Date(packetInfo.time * 1000).toISOString();
        
        row.innerHTML = `
            <td>${timestamp}</td>
            <td>${packetInfo.src_ip || 'N/A'}</td>
            <td>${packetInfo.dst_ip || 'N/A'}</td>
            <td>${formatProtocol(packetInfo.protocol)}</td>
            <td>${packetInfo.length}</td>
        `;
        
        // Add click handler to show details
        row.addEventListener('click', () => {
            if (packetDetails) packetDetails.textContent = JSON.stringify(packetInfo, null, 2);
        });
        
        // Add to table
        packetData.appendChild(row);
        
    } catch (error) {
        console.log('Non-JSON data received:', data);
        // If it's not JSON, just log it
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="5">${data}</td>`;
        packetData.appendChild(row);
    }
});

// Format protocol numbers to names
function formatProtocol(proto) {
    const protocols = {
        1: 'ICMP',
        6: 'TCP',
        17: 'UDP'
    };
    return protocols[proto] || proto;
}

// Show error message
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `<h4>Error</h4>${message}`;
    
    const container = document.querySelector('.packet-list-container');
    if (container) {
        container.insertBefore(errorDiv, container.firstChild);
    } else {
        console.error('Error container not found:', message);
    }
    
    // Enable start button
    if (startButton) startButton.disabled = false;
    if (stopButton) stopButton.disabled = true;
}

// Handle capture errors
ipcRenderer.on('capture-error', (event, error) => {
    console.error('Capture error:', error);
    showError(error);
});

// Add system check and interface loading when the page loads
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Only run system check and load interfaces if we're on the Inspect tab
        if (document.getElementById('interface-select')) {
            await ipcRenderer.invoke('check-system');
            await loadInterfaces();
        }
    } catch (error) {
        console.error('System check failed:', error);
        showError(error.message || 'System check failed');
    }
});
