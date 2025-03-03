const DataUsageMonitor = require('./data_usage');

// Initialize Chart.js
let usageChart;
const monitor = new DataUsageMonitor();

function initializeChart() {
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
                    type: 'time',
                    time: {
                        unit: 'second'
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
    document.getElementById('downloadRate').textContent = 
        monitor.formatBytes(data.current.bytesReceived) + '/s';
    document.getElementById('uploadRate').textContent = 
        monitor.formatBytes(data.current.bytesSent) + '/s';
    
    // Update total stats
    document.getElementById('totalDownloaded').textContent = 
        monitor.formatBytes(data.history.received.reduce((a, b) => a + b, 0));
    document.getElementById('totalUploaded').textContent = 
        monitor.formatBytes(data.history.sent.reduce((a, b) => a + b, 0));
    
    // Update chart
    usageChart.data.labels = data.history.timestamps;
    usageChart.data.datasets[0].data = data.history.received;
    usageChart.data.datasets[1].data = data.history.sent;
    usageChart.update();
}

document.addEventListener('DOMContentLoaded', () => {
    initializeChart();
    monitor.start();

    window.addEventListener('data-usage-update', (event) => {
        updateDisplay(event.detail);
    });
});

window.addEventListener('beforeunload', () => {
    monitor.stop();
});
