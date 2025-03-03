const { ipcRenderer } = require('electron');

class DataUsageMonitor {
    constructor() {
        this.bytesReceived = 0;
        this.bytesSent = 0;
        this.history = {
            timestamps: [],
            received: [],
            sent: []
        };
        this.updateInterval = 1000; // 1 second
    }

    start() {
        this.interval = setInterval(() => {
            ipcRenderer.invoke('get-network-stats').then(stats => {
                this.updateStats(stats);
            });
        }, this.updateInterval);
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
        }
    }

    updateStats(stats) {
        const timestamp = new Date();
        this.bytesReceived = stats.bytesReceived;
        this.bytesSent = stats.bytesSent;

        // Keep last 60 data points (1 minute)
        if (this.history.timestamps.length > 60) {
            this.history.timestamps.shift();
            this.history.received.shift();
            this.history.sent.shift();
        }

        this.history.timestamps.push(timestamp);
        this.history.received.push(this.bytesReceived);
        this.history.sent.push(this.bytesSent);

        // Emit update event
        window.dispatchEvent(new CustomEvent('data-usage-update', {
            detail: {
                current: {
                    bytesReceived: this.bytesReceived,
                    bytesSent: this.bytesSent
                },
                history: this.history
            }
        }));
    }

    formatBytes(bytes) {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;

        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }

        return `${size.toFixed(2)} ${units[unitIndex]}`;
    }
}

module.exports = DataUsageMonitor;
