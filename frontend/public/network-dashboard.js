document.addEventListener('DOMContentLoaded', function() {
  // Tab navigation
  const tabs = document.querySelectorAll('.nav-tab');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active class from all tabs
      tabs.forEach(t => t.classList.remove('active-tab'));
      // Add active class to clicked tab
      tab.classList.add('active-tab');
      
      // Hide all tab contents
      tabContents.forEach(content => {
        content.classList.remove('active');
      });
      
      // Show the corresponding tab content
      const tabId = tab.dataset.tab;
      document.getElementById(`${tabId}-tab`).classList.add('active');
    });
  });
  
  // Initialize network adapter info
  loadNetworkInfo();
  
  // Traffic Rate Chart
  const trafficChartElement = document.getElementById('trafficChart');
  if (trafficChartElement) {
    const ctx = trafficChartElement.getContext('2d');
    const trafficChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [], // Will be populated with timestamps
        datasets: [
          {
            label: 'Incoming Traffic',
            backgroundColor: 'rgba(33, 150, 243, 0.5)', // Blue for incoming
            borderColor: 'rgba(33, 150, 243, 1)',
            data: [],
            fill: true
          },
          {
            label: 'Outgoing Traffic',
            backgroundColor: 'rgba(165, 42, 42, 0.5)', // Brown for outgoing
            borderColor: 'rgba(165, 42, 42, 1)',
            data: [],
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            labels: {
              color: '#ffffff'
            }
          },
          tooltip: {
            mode: 'index',
            intersect: false
          }
        },
        scales: {
          x: {
            ticks: {
              color: '#a0aec0'
            },
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            }
          },
          y: {
            ticks: {
              color: '#a0aec0'
            },
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            beginAtZero: true
          }
        },
        animation: {
          duration: 0 // Disable animation for performance
        }
      }
    });
    
    // Initialize sample data
    initializeSampleData(trafficChart);
    
    // Setup real-time updates
    setupRealTimeUpdates(trafficChart);
  }
  
  // Initialize service breakdown
  updateServiceBreakdown();
  
  // Initialize host list
  updateHostList();
});

// Load network interface information
async function loadNetworkInfo() {
  try {
    const networkAdapterElement = document.getElementById('network-adapter');
    if (!networkAdapterElement) return;
    
    const interfaces = await ipcRenderer.invoke('list-interfaces');
    if (interfaces && interfaces.length > 0) {
      const primaryInterface = interfaces[0];
      networkAdapterElement.textContent = `${primaryInterface.name} (${primaryInterface.ip})`;
    } else {
      networkAdapterElement.textContent = 'No interfaces detected';
    }
  } catch (error) {
    console.error('Failed to load interfaces:', error);
    const networkAdapterElement = document.getElementById('network-adapter');
    if (networkAdapterElement) {
      networkAdapterElement.textContent = 'Error loading interface info';
    }
  }
}

// Initialize with sample data
function initializeSampleData(chart) {
  const times = [];
  const inData = [];
  const outData = [];
  
  // Generate sample data for the last 10 minutes
  const now = Date.now();
  for (let i = 0; i < 10; i++) {
    const time = new Date(now - (10 - i) * 60000);
    times.push(time.toLocaleTimeString());
    inData.push(Math.floor(Math.random() * 500));
    outData.push(Math.floor(Math.random() * 300));
  }
  
  // Update chart with sample data
  chart.data.labels = times;
  chart.data.datasets[0].data = inData;
  chart.data.datasets[1].data = outData;
  chart.update();
}

// Setup real-time updates
function setupRealTimeUpdates(chart) {
  // Update every 2 seconds
  setInterval(() => {
    // Get current network stats
    ipcRenderer.invoke('get-network-stats')
      .then(stats => {
        const time = new Date().toLocaleTimeString();
        
        // Add new data point
        chart.data.labels.push(time);
        chart.data.datasets[0].data.push(stats.bytesReceived / 1024); // Convert to KB
        chart.data.datasets[1].data.push(stats.bytesSent / 1024); // Convert to KB
        
        // Remove old data point if we have more than 30 points
        if (chart.data.labels.length > 30) {
          chart.data.labels.shift();
          chart.data.datasets[0].data.shift();
          chart.data.datasets[1].data.shift();
        }
        
        // Update chart
        chart.update();
        
        // Update service breakdown and host list periodically
        if (Math.random() > 0.7) {
          updateServiceBreakdown();
          updateHostList();
        }
      })
      .catch(err => {
        console.error('Failed to get network stats:', err);
      });
  }, 2000);
}

// Format bytes to human-readable format
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Update service breakdown
function updateServiceBreakdown() {
  const serviceBreakdownEl = document.getElementById('service-breakdown');
  if (!serviceBreakdownEl) return;
  
  const services = [
    { name: 'HTTPS', value: Math.floor(Math.random() * 800) + 200, color: '#4CAF50' },
    { name: 'HTTP', value: Math.floor(Math.random() * 400) + 100, color: '#2196F3' },
    { name: 'DNS', value: Math.floor(Math.random() * 200) + 50, color: '#FFC107' },
    { name: 'SMTP', value: Math.floor(Math.random() * 100) + 20, color: '#9C27B0' },
    { name: 'Other', value: Math.floor(Math.random() * 150) + 30, color: '#607D8B' }
  ];
  
  // Calculate total for percentage
  const total = services.reduce((sum, service) => sum + service.value, 0);
  
  // Sort by value in descending order
  services.sort((a, b) => b.value - a.value);
  
  // Generate HTML
  serviceBreakdownEl.innerHTML = '';
  
  services.forEach(service => {
    const percentage = ((service.value / total) * 100).toFixed(1);
    const serviceHTML = `
      <div class="service-item">
        <div class="service-info">
          <span>${service.name}</span>
          <span class="usage-value">${formatBytes(service.value * 1024)}</span>
        </div>
        <div class="service-bar">
          <div class="service-bar-fill" style="width: ${percentage}%; background-color: ${service.color}"></div>
        </div>
      </div>
    `;
    serviceBreakdownEl.innerHTML += serviceHTML;
  });
}

// Update host list
function updateHostList() {
  const hostListEl = document.getElementById('host-list');
  if (!hostListEl) return;
  
  const hosts = [
    { name: 'GitHub', icon: 'https://github.githubassets.com/favicons/favicon.png', value: Math.floor(Math.random() * 500) + 100 },
    { name: 'Google', icon: 'https://www.google.com/favicon.ico', value: Math.floor(Math.random() * 400) + 200 },
    { name: 'YouTube', icon: 'https://www.youtube.com/favicon.ico', value: Math.floor(Math.random() * 800) + 300 },
    { name: 'Netflix', icon: 'https://assets.nflxext.com/us/ffe/siteui/common/icons/nficon2016.ico', value: Math.floor(Math.random() * 1000) + 500 },
    { name: 'Amazon', icon: 'https://www.amazon.com/favicon.ico', value: Math.floor(Math.random() * 300) + 100 }
  ];
  
  // Calculate total for percentage
  const total = hosts.reduce((sum, host) => sum + host.value, 0);
  
  // Sort by value in descending order
  hosts.sort((a, b) => b.value - a.value);
  
  // Generate HTML
  hostListEl.innerHTML = '';
  
  hosts.forEach(host => {
    const percentage = ((host.value / total) * 100).toFixed(1);
    const hostHTML = `
      <div class="host-item">
        <div class="host-info">
          <img src="${host.icon}" alt="${host.name}" class="host-icon" onerror="this.src='https://www.google.com/s2/favicons?domain=${host.name}.com'">
          <span>${host.name}</span>
        </div>
        <div class="host-usage">
          <span class="usage-value">${formatBytes(host.value * 1024)}</span>
          <div class="progress-bar">
            <div class="progress-bar-fill" style="width: ${percentage}%"></div>
          </div>
        </div>
      </div>
    `;
    hostListEl.innerHTML += hostHTML;
  });
}