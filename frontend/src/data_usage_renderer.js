const DataUsageMonitor = require('./data_usage');

// Initialize Chart.js - make sure Chart is available globally
let usageChart;
const monitor = new DataUsageMonitor();

function initializeChart() {
    if (!window.Chart) {
        console.error('Chart.js not loaded');
        return;
    }
    
    const ctx = document.getElementById('usageChart').getContext('2d');
    usageChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Download Rate',
                    borderColor: '#2196F3',
                    data: [],
                    fill: false
                },
                {
                    label: 'Upload Rate',
                    borderColor: '#4CAF50',
                    data: [],
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'category', // Changed from 'time' to 'category' for better compatibility
                    title: {
                        display: true,
                        text: 'Time'
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Bytes per second'
                    }
                }
            },
            animation: {
                duration: 0
            }
        }
    });
}

function updateDisplay(data) {
    // Update current stats
    const downloadRateElement = document.getElementById('downloadRate');
    if (downloadRateElement) {
        downloadRateElement.textContent = monitor.formatBytes(data.current.bytesReceived) + '/s';
    }
    
    const uploadRateElement = document.getElementById('uploadRate');
    if (uploadRateElement) {
        uploadRateElement.textContent = monitor.formatBytes(data.current.bytesSent) + '/s';
    }
    
    // Update total stats
    const totalDownloadedElement = document.getElementById('totalDownloaded');
    if (totalDownloadedElement) {
        totalDownloadedElement.textContent = monitor.formatBytes(data.history.received.reduce((a, b) => a + b, 0));
    }
    
    const totalUploadedElement = document.getElementById('totalUploaded');
    if (totalUploadedElement) {
        totalUploadedElement.textContent = monitor.formatBytes(data.history.sent.reduce((a, b) => a + b, 0));
    }
    
    // Update chart if it exists
    if (usageChart) {
        // Format timestamps for display
        const formattedLabels = data.history.timestamps.map(timestamp => {
            if (typeof timestamp === 'string') {
                const date = new Date(timestamp);
                return date.toLocaleTimeString();
            }
            return timestamp;
        });
        
        usageChart.data.labels = formattedLabels;
        usageChart.data.datasets[0].data = data.history.received;
        usageChart.data.datasets[1].data = data.history.sent;
        usageChart.update();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    try {
        initializeChart();
        monitor.start();

        window.addEventListener('data-usage-update', (event) => {
            updateDisplay(event.detail);
        });
        
        // Log for debugging
        console.log('Data usage renderer initialized successfully');
    } catch (error) {
        console.error('Error initializing data usage renderer:', error);
    }
});

window.addEventListener('beforeunload', () => {
    monitor.stop();
});
