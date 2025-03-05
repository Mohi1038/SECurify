document.addEventListener('DOMContentLoaded', function() {
  // Check if we're on the page with connections table
  if (document.getElementById('connection-table')) {
    // Initialize connection inspector
    const connectionInspector = new ConnectionInspector();
    connectionInspector.init();
  }
});

class ConnectionInspector {
  constructor() {
    // DOM elements - add null checks to avoid errors if elements don't exist
    this.connectionTable = document.getElementById('connection-table');
    this.connectionData = document.getElementById('connection-data');
    this.detailsPanel = document.getElementById('connection-details-panel');
    this.closeDetailsBtn = document.getElementById('close-details');
    this.favoriteBtn = document.getElementById('favorite-connection');
    this.blockBtn = document.getElementById('block-connection');
    
    // Pagination elements
    this.prevPageBtn = document.getElementById('prev-page');
    this.nextPageBtn = document.getElementById('next-page');
    this.pageNumbers = document.getElementById('page-numbers');
    this.showingStart = document.getElementById('showing-start');
    this.showingEnd = document.getElementById('showing-end');
    this.totalConnections = document.getElementById('total-connections');
    
    // Filter elements
    this.hostFilter = document.getElementById('host-filter');
    this.favoritesOnly = document.getElementById('favorites-only');
    this.countryFilter = document.getElementById('country-filter');
    this.asnFilter = document.getElementById('asn-filter');
    this.protocolFilter = document.getElementById('protocol-filter');
    this.applyFiltersBtn = document.getElementById('apply-filters');
    this.resetFiltersBtn = document.getElementById('reset-filters');
    this.activeFilterCount = document.getElementById('active-filter-count');
    
    // History clearing elements
    this.historyPeriod = document.getElementById('history-period');
    this.clearHistoryBtn = document.getElementById('clear-history');
    this.lastClearedSpan = document.getElementById('last-cleared');
    
    // State
    this.connections = [];
    this.filteredConnections = [];
    this.currentPage = 1;
    this.rowsPerPage = 20;
    this.currentSort = { column: 'bytes', direction: 'desc' };
    this.currentFilters = {};
    this.selectedConnectionId = null;
    this.favorites = new Set(this.loadFavorites());
    
    // Add history state tracking
    this.lastCleared = localStorage.getItem('lastHistoryCleared') || null;
    if (this.lastCleared) {
      const lastClearedDate = new Date(parseInt(this.lastCleared));
      this.lastClearedSpan.textContent = `Last cleared: ${lastClearedDate.toLocaleString()}`;
    }
    
    // Bind methods
    this.handleTableClick = this.handleTableClick.bind(this);
    this.handleSortClick = this.handleSortClick.bind(this);
    this.handleCloseDetails = this.handleCloseDetails.bind(this);
    this.handleFavorite = this.handleFavorite.bind(this);
    this.handleBlock = this.handleBlock.bind(this);
    this.handlePrevPage = this.handlePrevPage.bind(this);
    this.handleNextPage = this.handleNextPage.bind(this);
    this.handlePageClick = this.handlePageClick.bind(this);
    this.handleApplyFilters = this.handleApplyFilters.bind(this);
    this.handleResetFilters = this.handleResetFilters.bind(this);
    this.handleClearHistory = this.handleClearHistory.bind(this);
  }
  
  init() {
    // Only add event listeners if the elements exist
    if (this.connectionTable) {
      this.connectionTable.addEventListener('click', this.handleTableClick);
    }
    
    if (this.closeDetailsBtn) {
      this.closeDetailsBtn.addEventListener('click', this.handleCloseDetails);
    }
    
    if (this.favoriteBtn) {
      this.favoriteBtn.addEventListener('click', this.handleFavorite);
    }
    
    if (this.blockBtn) {
      this.blockBtn.addEventListener('click', this.handleBlock);
    }
    
    if (this.prevPageBtn) {
      this.prevPageBtn.addEventListener('click', this.handlePrevPage);
    }
    
    if (this.nextPageBtn) {
      this.nextPageBtn.addEventListener('click', this.handleNextPage);
    }
    
    if (this.pageNumbers) {
      this.pageNumbers.addEventListener('click', this.handlePageClick);
    }
    
    if (this.applyFiltersBtn) {
      this.applyFiltersBtn.addEventListener('click', this.handleApplyFilters);
    }
    
    if (this.resetFiltersBtn) {
      this.resetFiltersBtn.addEventListener('click', this.handleResetFilters);
    }
    
    // Add history clearing event listener
    if (this.clearHistoryBtn) {
      this.clearHistoryBtn.addEventListener('click', this.handleClearHistory);
    }
    
    // Load real connection data
    this.loadRealConnections();
    
    // Start real-time updates
    this.startRealTimeUpdates();
  }
  
  // Load favorites from localStorage
  loadFavorites() {
    try {
      const favoritesJson = localStorage.getItem('connectionFavorites');
      return favoritesJson ? new Set(JSON.parse(favoritesJson)) : new Set();
    } catch (error) {
      console.error('Error loading favorites:', error);
      return new Set();
    }
  }
  
  // Save favorites to localStorage
  saveFavorites() {
    try {
      localStorage.setItem('connectionFavorites', JSON.stringify([...this.favorites]));
    } catch (error) {
      console.error('Error saving favorites:', error);
    }
  }
  
  // Load real connection data from backend
  async loadRealConnections() {
    try {
      const { connections } = await ipcRenderer.invoke('get-real-connections');
      
      if (connections && Array.isArray(connections) && connections.length > 0) {
        this.connections = connections;
        console.log(`Loaded ${connections.length} real connections`);
      } else {
        console.log('No real connections available, using sample data temporarily');
        // Fall back to sample data if no real connections yet
        this.connections = this.generateSampleData(10);
      }
      
      // Apply initial filters and sorting
      this.filterConnections();
      this.sortConnections();
      
      // Render the table
      this.renderTable();
      this.updatePagination();
    } catch (error) {
      console.error('Error loading real connections:', error);
      // Fall back to sample data if loading fails
      this.connections = this.generateSampleData(20);
      this.filterConnections();
      this.sortConnections();
      this.renderTable();
      this.updatePagination();
    }
  }
  
  // Generate sample connection data (used as fallback only)
  generateSampleData(count) {
    const protocols = ['TCP', 'UDP', 'ICMP', 'TCP', 'TCP', 'UDP']; // More TCP to be realistic
    const services = ['HTTP', 'HTTPS', 'DNS', 'SMTP', 'SSH', 'FTP', 'IMAP', 'POP3', 'Unknown'];
    const localIPs = ['192.168.1.100', '192.168.1.101', '192.168.1.102', '192.168.1.103'];
    const externalDomains = [
      { domain: 'google.com', ip: '142.250.190.78', country: 'US', asn: 'AS15169 - Google LLC' },
      { domain: 'facebook.com', ip: '157.240.3.35', country: 'US', asn: 'AS32934 - Facebook, Inc.' },
      { domain: 'amazon.com', ip: '176.32.103.205', country: 'US', asn: 'AS16509 - Amazon.com, Inc.' },
      { domain: 'netflix.com', ip: '54.237.226.164', country: 'US', asn: 'AS16509 - Amazon.com, Inc.' },
      { domain: 'microsoft.com', ip: '20.112.250.133', country: 'US', asn: 'AS8075 - Microsoft Corporation' },
      { domain: 'apple.com', ip: '17.253.144.10', country: 'US', asn: 'AS714 - Apple Inc.' },
      { domain: 'github.com', ip: '140.82.121.4', country: 'US', asn: 'AS36459 - GitHub, Inc.' },
      { domain: 'youtube.com', ip: '142.250.190.110', country: 'US', asn: 'AS15169 - Google LLC' },
      { domain: 'baidu.com', ip: '39.156.69.79', country: 'CN', asn: 'AS23724 - Baidu, Inc.' },
      { domain: 'wikipedia.org', ip: '208.80.154.224', country: 'US', asn: 'AS14907 - Wikimedia Foundation Inc.' }
    ];
    
    const connections = [];
    
    for (let i = 1; i <= count; i++) {
      const isOutgoing = Math.random() > 0.5;
      const protocol = protocols[Math.floor(Math.random() * protocols.length)];
      const service = protocol === 'ICMP' ? 'ICMP' : services[Math.floor(Math.random() * services.length)];
      
      // Determine common ports based on service
      let port;
      switch(service) {
        case 'HTTP': port = 80; break;
        case 'HTTPS': port = 443; break;
        case 'DNS': port = 53; break;
        case 'SMTP': port = 25; break;
        case 'SSH': port = 22; break;
        case 'FTP': port = 21; break;
        case 'IMAP': port = 143; break;
        case 'POP3': port = 110; break;
        default: port = Math.floor(Math.random() * 60000) + 1024;
      }
      
      const localIP = localIPs[Math.floor(Math.random() * localIPs.length)];
      const externalDomain = externalDomains[Math.floor(Math.random() * externalDomains.length)];
      
      const bytes = Math.floor(Math.random() * 10000000); // Up to 10MB
      const packets = Math.floor(bytes / (Math.random() * 1000 + 500)); // Average packet size between 500B and 1500B
      
      // Calculate first and last seen times
      const now = new Date();
      const minutesAgo = Math.floor(Math.random() * 60);
      const firstSeen = new Date(now.getTime() - (minutesAgo * 60000));
      const lastSeen = minutesAgo > 10 ? new Date(now.getTime() - (Math.floor(Math.random() * 10) * 60000)) : now;
      
      connections.push({
        id: i,
        srcAddr: isOutgoing ? localIP : externalDomain.ip,
        srcPort: isOutgoing ? Math.floor(Math.random() * 60000) + 1024 : port,
        dstAddr: isOutgoing ? externalDomain.ip : localIP,
        dstPort: isOutgoing ? port : Math.floor(Math.random() * 60000) + 1024,
        protocol: protocol,
        service: service,
        bytes: bytes,
        packets: packets,
        domain: externalDomain.domain,
        country: externalDomain.country,
        asn: externalDomain.asn,
        firstSeen: firstSeen,
        lastSeen: lastSeen,
        active: Math.random() > 0.3 // 70% chance of being active
      });
    }
    
    return connections;
  }
  
  // Filter connections based on current filters
  filterConnections() {
    this.filteredConnections = this.connections.filter(conn => {
      // Filter by host/domain
      if (this.currentFilters.host && 
          !(conn.srcAddr.includes(this.currentFilters.host) || 
            conn.dstAddr.includes(this.currentFilters.host) || 
            conn.domain.includes(this.currentFilters.host))) {
        return false;
      }
      
      // Filter by favorites
      if (this.currentFilters.favorites && !this.favorites.has(conn.id)) {
        return false;
      }
      
      // Filter by country
      if (this.currentFilters.country && conn.country !== this.currentFilters.country) {
        return false;
      }
      
      // Filter by ASN
      if (this.currentFilters.asn && !conn.asn.includes(this.currentFilters.asn)) {
        return false;
      }
      
      // Filter by protocol
      if (this.currentFilters.protocol && this.currentFilters.protocol !== 'all') {
        if (this.currentFilters.protocol === 'http' && 
            !(conn.service === 'HTTP' || conn.service === 'HTTPS')) {
          return false;
        } else if (this.currentFilters.protocol !== conn.protocol.toLowerCase()) {
          return false;
        }
      }
      
      // All filters passed
      return true;
    });
  }
  
  // Sort connections based on current sort settings
  sortConnections() {
    this.filteredConnections.sort((a, b) => {
      let valA, valB;
      
      switch (this.currentSort.column) {
        case 'source':
          valA = a.srcAddr;
          valB = b.srcAddr;
          break;
        case 'sport':
          valA = a.srcPort;
          valB = b.srcPort;
          break;
        case 'destination':
          valA = a.dstAddr;
          valB = b.dstAddr;
          break;
        case 'dport':
          valA = a.dstPort;
          valB = b.dstPort;
          break;
        case 'protocol':
          valA = a.protocol;
          valB = b.protocol;
          break;
        case 'service':
          valA = a.service;
          valB = b.service;
          break;
        case 'bytes':
          valA = a.bytes;
          valB = b.bytes;
          break;
        case 'packets':
          valA = a.packets;
          valB = b.packets;
          break;
        default:
          valA = a.bytes;
          valB = b.bytes;
      }
      
      // Compare values based on sort direction
      if (this.currentSort.direction === 'asc') {
        return valA > valB ? 1 : valA < valB ? -1 : 0;
      } else {
        return valA < valB ? 1 : valA > valB ? -1 : 0;
      }
    });
  }
  
  // Render table with current page of filtered connections
  renderTable() {
    // Clear table
    this.connectionData.innerHTML = '';
    
    // Calculate page range
    const start = (this.currentPage - 1) * this.rowsPerPage;
    const end = Math.min(start + this.rowsPerPage, this.filteredConnections.length);
    const pageConnections = this.filteredConnections.slice(start, end);
    
    // Update showing info
    this.showingStart.textContent = this.filteredConnections.length > 0 ? start + 1 : 0;
    this.showingEnd.textContent = end;
    this.totalConnections.textContent = this.filteredConnections.length;
    
    // Create rows
    pageConnections.forEach(conn => {
      const row = document.createElement('tr');
      row.dataset.id = conn.id;
      
      // Check if row is favorited
      const isFavorite = this.favorites.has(conn.id);
      
      // Format byte size for display
      const bytesDisplay = this.formatBytes(conn.bytes);
      
      // Create cells
      row.innerHTML = `
        <td>${isFavorite ? '<span class="favorite-icon">★</span>' : ''}${conn.srcAddr}</td>
        <td>${conn.srcPort}</td>
        <td>${conn.dstAddr}${conn.domain ? ' (' + conn.domain + ')' : ''}</td>
        <td>${conn.dstPort}</td>
        <td>${conn.protocol}</td>
        <td>${conn.service}</td>
        <td>${bytesDisplay}</td>
        <td>${conn.packets}</td>
        <td class="action-cell">
          <button class="action-button favorite-btn" title="Add to favorites">${isFavorite ? '★' : '☆'}</button>
          <button class="action-button block-btn" title="Block connection">⊘</button>
        </td>
      `;
      
      this.connectionData.appendChild(row);
    });
    
    // Update sort indicators
    const headers = this.connectionTable.querySelectorAll('th.sortable');
    headers.forEach(header => {
      const sortColumn = header.dataset.sort;
      header.removeAttribute('aria-sort');
      
      if (sortColumn === this.currentSort.column) {
        header.setAttribute('aria-sort', this.currentSort.direction);
        const sortIcon = header.querySelector('.sort-icon');
        sortIcon.textContent = this.currentSort.direction === 'asc' ? '▲' : '▼';
      } else {
        const sortIcon = header.querySelector('.sort-icon');
        sortIcon.textContent = '';
      }
    });
  }
  
  // Update pagination controls
  updatePagination() {
    const totalPages = Math.ceil(this.filteredConnections.length / this.rowsPerPage);
    
    // Enable/disable prev/next buttons
    this.prevPageBtn.disabled = this.currentPage <= 1;
    this.nextPageBtn.disabled = this.currentPage >= totalPages;
    
    // Generate page numbers
    this.pageNumbers.innerHTML = '';
    
    // Determine range of pages to show (max 5)
    let startPage = Math.max(1, this.currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    
    // Adjust if at the end
    if (endPage - startPage < 4 && startPage > 1) {
      startPage = Math.max(1, endPage - 4);
    }
    
    // Add page numbers
    for (let i = startPage; i <= endPage; i++) {
      const pageEl = document.createElement('span');
      pageEl.className = 'page-number' + (i === this.currentPage ? ' active' : '');
      pageEl.dataset.page = i;
      pageEl.textContent = i;
      this.pageNumbers.appendChild(pageEl);
    }
  }
  
  // Format bytes to human readable format
  formatBytes(bytes) {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 B';
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)), 10);
    if (i === 0) return `${bytes} ${sizes[i]}`;
    return `${(bytes / (1024 ** i)).toFixed(2)} ${sizes[i]}`;
  }
  
  // Show connection details
  showConnectionDetails(id) {
    // Find connection
    const connection = this.connections.find(conn => conn.id === parseInt(id));
    if (!connection) return;
    
    // Update selected state
    this.selectedConnectionId = parseInt(id);
    
    // Update details in panel
    document.getElementById('detail-source').textContent = `${connection.srcAddr}:${connection.srcPort}`;
    document.getElementById('detail-destination').textContent = 
      `${connection.dstAddr}:${connection.dstPort}${connection.domain ? ' (' + connection.domain + ')' : ''}`;
    document.getElementById('detail-protocol').textContent = `${connection.protocol} (${connection.service})`;
    document.getElementById('detail-first-seen').textContent = connection.firstSeen.toLocaleString();
    document.getElementById('detail-last-seen').textContent = connection.lastSeen.toLocaleString();
    document.getElementById('detail-bytes').textContent = 
      `${this.formatBytes(connection.bytes / 2)} / ${this.formatBytes(connection.bytes / 2)}`; // Simplified for demo
    document.getElementById('detail-packets').textContent = 
      `${Math.floor(connection.packets / 2)} / ${Math.ceil(connection.packets / 2)}`; // Simplified for demo
    document.getElementById('detail-country').textContent = connection.country;
    document.getElementById('detail-asn').textContent = connection.asn;
    
    // Update favorite button text based on status
    const isFavorite = this.favorites.has(connection.id);
    this.favoriteBtn.innerHTML = 
      `<span class="star-icon">${isFavorite ? '★' : '☆'}</span> ${isFavorite ? 'Remove from' : 'Add to'} Favorites`;
    
    // Show panel
    this.detailsPanel.classList.add('active');
  }
  
  // Handle table clicks (row selection and sorting)
  handleTableClick(event) {
    const target = event.target;
    
    // Check if clicking on a sortable header
    if (target.closest('th.sortable')) {
      const header = target.closest('th.sortable');
      const column = header.dataset.sort;
      
      // Toggle or set sort direction
      if (this.currentSort.column === column) {
        this.currentSort.direction = this.currentSort.direction === 'asc' ? 'desc' : 'asc';
      } else {
        this.currentSort.column = column;
        this.currentSort.direction = 'asc';
      }
      
      // Re-sort and render
      this.sortConnections();
      this.renderTable();
      return;
    }
    
    // Check if clicking on a favorite button
    if (target.classList.contains('favorite-btn') || target.closest('.favorite-btn')) {
      const row = target.closest('tr');
      const id = parseInt(row.dataset.id);
      this.toggleFavorite(id);
      this.renderTable();
      return;
    }
    
    // Check if clicking on a block button
    if (target.classList.contains('block-btn') || target.closest('.block-btn')) {
      const row = target.closest('tr');
      const id = parseInt(row.dataset.id);
      this.blockConnection(id);
      return;
    }
    
    // Otherwise, select the row
    const row = target.closest('tr');
    if (row && row.dataset.id) {
      this.showConnectionDetails(row.dataset.id);
    }
  }
  
  // Handle sort header click
  handleSortClick(event) {
    // Implementation included in handleTableClick
  }
  
  // Handle close details button click
  handleCloseDetails() {
    this.detailsPanel.classList.remove('active');
    this.selectedConnectionId = null;
  }
  
  // Handle favorite button click in details panel
  handleFavorite() {
    if (this.selectedConnectionId) {
      this.toggleFavorite(this.selectedConnectionId);
      
      // Update favorite button text
      const isFavorite = this.favorites.has(this.selectedConnectionId);
      this.favoriteBtn.innerHTML = 
        `<span class="star-icon">${isFavorite ? '★' : '☆'}</span> ${isFavorite ? 'Remove from' : 'Add to'} Favorites`;
      
      // Refresh table to update favorite icon in row
      this.renderTable();
    }
    
    // Save favorites to localStorage
    this.saveFavorites();
  }
  
  // Toggle favorite status of a connection
  toggleFavorite(id) {
    if (this.favorites.has(id)) {
      this.favorites.delete(id);
    } else {
      this.favorites.add(id);
    }
    
    // Save favorites to localStorage
    this.saveFavorites();
    
    // If we're filtering by favorites, may need to refilter
    if (this.currentFilters.favorites) {
      this.filterConnections();
      this.renderTable();
      this.updatePagination();
    }
  }
  
  // Handle block button click
  handleBlock() {
    if (this.selectedConnectionId) {
      this.blockConnection(this.selectedConnectionId);
    }
  }
  
  // Block a connection (now will actually block using IP tables or Windows Firewall)
  blockConnection(id) {
    // Find connection to block
    const connection = this.connections.find(conn => conn.id === id);
    if (!connection) return;
    
    // In a real app, this would call the backend to block the connection
    console.log(`Blocking connection: ${connection.srcAddr}:${connection.srcPort} -> ${connection.dstAddr}:${connection.dstPort}`);
    
    // Call backend to block connection
    ipcRenderer.invoke('block-connection', {
      sourceIp: connection.srcAddr,
      sourcePort: connection.srcPort,
      destIp: connection.dstAddr,
      destPort: connection.dstPort,
      protocol: connection.protocol
    }).then(result => {
      if (result.success) {
        // Show success notification
        this.showBlockNotification(connection, true);
      } else {
        // Show error notification
        this.showBlockNotification(connection, false, result.error);
      }
    }).catch(error => {
      console.error('Error blocking connection:', error);
      this.showBlockNotification(connection, false, error.toString());
    });
    
    // Close the details panel if open
    this.handleCloseDetails();
  }
  
  // Show notification for connection blocking
  showBlockNotification(connection, success, error = null) {
    const notification = document.createElement('div');
    notification.className = 'notification-item';
    
    if (success) {
      notification.innerHTML = `
        <div class="notification-icon warning"></div>
        <div class="notification-content">
          <h4>Connection Blocked</h4>
          <p>${connection.srcAddr}:${connection.srcPort} to ${connection.dstAddr}:${connection.dstPort} (${connection.service})</p>
          <span class="notification-time">Just now</span>
        </div>
      `;
    } else {
      notification.innerHTML = `
        <div class="notification-icon error"></div>
        <div class="notification-content">
          <h4>Failed to Block Connection</h4>
          <p>${connection.srcAddr}:${connection.srcPort} to ${connection.dstAddr}:${connection.dstPort}</p>
          <p class="error-detail">${error || 'Unknown error'}</p>
          <span class="notification-time">Just now</span>
        </div>
      `;
    }
    
    // Add to notifications tab
    const notificationList = document.getElementById('notification-list');
    notificationList.prepend(notification);
    
    // Auto-remove notification after 10 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 10000);
  }
  
  // Handle previous page button click
  handlePrevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.renderTable();
      this.updatePagination();
    }
  }
  
  // Handle next page button click
  handleNextPage() {
    const totalPages = Math.ceil(this.filteredConnections.length / this.rowsPerPage);
    if (this.currentPage < totalPages) {
      this.currentPage++;
      this.renderTable();
      this.updatePagination();
    }
  }
  
  // Handle page number click
  handlePageClick(event) {
    if (event.target.classList.contains('page-number')) {
      this.currentPage = parseInt(event.target.dataset.page);
      this.renderTable();
      this.updatePagination();
    }
  }
  
  // Handle apply filters button click
  handleApplyFilters() {
    // Collect filter values
    this.currentFilters = {
      host: this.hostFilter.value.trim(),
      favorites: this.favoritesOnly.checked,
      country: this.countryFilter.value,
      asn: this.asnFilter.value,
      protocol: this.protocolFilter.value
    };
    
    // Count active filters
    const activeFilters = Object.values(this.currentFilters).filter(val => {
      if (typeof val === 'boolean') return val;
      return val && val !== '' && val !== 'all';
    }).length;
    
    // Update filter status text
    this.activeFilterCount.textContent = 
      activeFilters > 0 ? `${activeFilters} filter${activeFilters > 1 ? 's' : ''} active` : 'No filters active';
    
    // Apply filters and update table
    this.filterConnections();
    this.currentPage = 1; // Reset to first page
    this.sortConnections();
    this.renderTable();
    this.updatePagination();
  }
  
  // Handle reset filters button click
  handleResetFilters() {
    // Clear filter inputs
    this.hostFilter.value = '';
    this.favoritesOnly.checked = false;
    this.countryFilter.value = '';
    this.asnFilter.value = '';
    this.protocolFilter.value = 'all';
    
    // Clear filter state
    this.currentFilters = {};
    this.activeFilterCount.textContent = 'No filters active';
    
    // Reset table to unfiltered state
    this.filterConnections();
    this.currentPage = 1;
    this.sortConnections();
    this.renderTable();
    this.updatePagination();
  }
  
  // Handle clear history button click
  handleClearHistory() {
    const period = this.historyPeriod.value;
    const now = new Date();
    let cutoffDate;
    
    switch(period) {
      case 'day':
        cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '10days':
        cutoffDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
      default:
        cutoffDate = new Date(0); // Beginning of time
        break;
    }
    
    // Ask for confirmation
    const periodText = {
      'day': 'older than 24 hours',
      'week': 'older than 7 days',
      '10days': 'older than 10 days',
      'month': 'older than 30 days',
      'all': 'ALL connection history'
    };
    
    const confirmMessage = `Are you sure you want to clear ${periodText[period]}?`;
    if (!confirm(confirmMessage)) {
      return;
    }
    
    // Clear connections based on the cutoff date
    const initialCount = this.connections.length;
    this.connections = this.connections.filter(conn => conn.firstSeen >= cutoffDate);
    const removedCount = initialCount - this.connections.length;
    
    // Update last cleared timestamp
    this.lastCleared = Date.now().toString();
    localStorage.setItem('lastHistoryCleared', this.lastCleared);
    this.lastClearedSpan.textContent = `Last cleared: ${new Date().toLocaleString()}`;
    
    // Show notification
    this.showHistoryClearNotification(removedCount, periodText[period]);
    
    // Re-apply filters and update display
    this.filterConnections();
    this.sortConnections();
    this.currentPage = 1; // Reset to first page
    this.renderTable();
    this.updatePagination();
  }
  
  // Show notification for history clearing
  showHistoryClearNotification(count, periodText) {
    const notification = document.createElement('div');
    notification.className = 'notification-item';
    notification.innerHTML = `
      <div class="notification-icon info"></div>
      <div class="notification-content">
        <h4>History Cleared</h4>
        <p>Removed ${count} connection${count !== 1 ? 's' : ''} ${periodText}</p>
        <span class="notification-time">Just now</span>
      </div>
    `;
    
    // Add to notifications tab
    const notificationList = document.getElementById('notification-list');
    if (notificationList) {
      notificationList.prepend(notification);
      
      // Auto-remove notification after 10 seconds
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 10000);
    }
  }
  
  // Start real-time updates using real data
  startRealTimeUpdates() {
    // Update connections every few seconds
    setInterval(async () => {
      try {
        // Get real connection data
        const { connections, lastUpdate } = await ipcRenderer.invoke('get-real-connections');
        
        if (connections && Array.isArray(connections) && connections.length > 0) {
          // Update with real connections data
          this.connections = connections;
        }
        
        // Re-apply filters and sorting
        this.filterConnections();
        this.sortConnections();
        
        // Re-render table
        this.renderTable();
      } catch (error) {
        console.error('Error updating real-time connections:', error);
      }
    }, 2000); // Update every 2 seconds
  }
}