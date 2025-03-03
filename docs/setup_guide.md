# Comprehensive Setup Guide

## System Requirements

### Operating System
- Windows 10 or later (with Npcap)
- Linux (with libpcap)
- macOS (with libpcap)

### Required Permissions
1. **Administrator/Root Access**
   - Windows: Run as Administrator
   - Linux/macOS: Root privileges or sudo access

2. **Network Capture Requirements**
   - Windows: 
     - Install [Npcap](https://npcap.com/)
     - Run installer in WinPcap compatibility mode
   - Linux:
     ```bash
     sudo apt-get install libpcap-dev  # Debian/Ubuntu
     sudo yum install libpcap-devel    # RHEL/CentOS
     ```
   - macOS:
     ```bash
     brew install libpcap
     ```

### Verifying Requirements

Run the system check tool:
```bash
python backend/src/system_check.py
```

If any checks fail:
1. **Admin Rights**
   - Windows: Right-click → Run as Administrator
   - Linux/macOS: Use `sudo`

2. **Npcap/libpcap**
   - Windows: Reinstall Npcap with WinPcap compatibility
   - Linux/macOS: Reinstall libpcap

3. **Network Interfaces**
   - Check firewall settings
   - Verify network adapter status
   - Ensure antivirus isn't blocking access

## Python Environment Setup

### Creating a Virtual Environment

```bash
# Navigate to the backend directory
cd backend

# Create a virtual environment
python -m venv venv

# Activate the virtual environment
# On Windows:
venv\Scripts\activate
# On Unix/MacOS:
source venv/bin/activate

# Verify activation (should show virtual environment path)
which python  # Unix/MacOS
where python  # Windows
```

### Installing Dependencies

```bash
# Ensure pip is up to date
python -m pip install --upgrade pip

# Install requirements
pip install -r requirements.txt

# Verify installations
pip list

# Optional: Check specific package versions
python -c "import scapy; print(scapy.__version__)"
python -c "import psutil; print(psutil.__version__)"
```

### Troubleshooting Common Issues

1. **Permission Errors**:
   - Run terminal/command prompt as administrator
   - Use `--user` flag: `pip install --user -r requirements.txt`

2. **Scapy Installation Issues**:
   - Windows: Install Npcap first (https://npcap.com/)
   - Linux: Run `sudo apt-get install python3-scapy` first

3. **Virtual Environment Not Activating**:
   - Check execution policies on Windows:
     ```powershell
     Get-ExecutionPolicy
     Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
     ```

## Local Storage Setup

### SQLite Setup

SQLite comes built into Python, but you may need to verify the installation:

```python
import sqlite3
print(sqlite3.sqlite_version)
```

### Database Initialization

```bash
# Create the database directory
mkdir -p storage/data
```

### Example SQLite Usage

```python
import sqlite3
from datetime import datetime

def initialize_db():
    conn = sqlite3.connect('storage/data/traffic.db')
    c = conn.cursor()
    
    # Create packets table
    c.execute('''
        CREATE TABLE IF NOT EXISTS packets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            source_ip TEXT,
            dest_ip TEXT,
            protocol TEXT,
            length INTEGER,
            raw_data BLOB
        )
    ''')
    
    conn.commit()
    conn.close()

def store_packet(packet_data):
    conn = sqlite3.connect('storage/data/traffic.db')
    c = conn.cursor()
    
    c.execute('''
        INSERT INTO packets (source_ip, dest_ip, protocol, length, raw_data)
        VALUES (?, ?, ?, ?, ?)
    ''', (
        packet_data['src_ip'],
        packet_data['dst_ip'],
        packet_data['protocol'],
        packet_data['length'],
        packet_data.get('raw_data')
    ))
    
    conn.commit()
    conn.close()
```

### Alternative: JSON Storage

For simpler storage needs, use the built-in JSON storage system:

```python
import json
from pathlib import Path

def save_capture(packets, filename=None):
    if filename is None:
        filename = f"capture_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    
    path = Path('storage/data') / filename
    path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(path, 'w') as f:
        json.dump(packets, f, indent=2)
```

## Verification Steps

### Backend Verification

1. Test packet capture:
```bash
# Activate virtual environment first
python backend/src/packet_capture.py
```

2. Test database:
```python
import sqlite3
conn = sqlite3.connect('storage/data/traffic.db')
print("Database connected successfully")
conn.close()
```

### Common Issues and Solutions

1. **Database Permission Issues**:
   - Check directory permissions
   - Ensure the application has write access to storage/data
   - Try creating the database file manually first

2. **Package Conflicts**:
   - Use `pip freeze > requirements.txt` to lock versions
   - Clear pip cache: `pip cache purge`
   - Reinstall packages: `pip install --no-cache-dir -r requirements.txt`

3. **Network Capture Issues**:
   - Run with administrative privileges
   - Check firewall settings
   - Verify network interface availability:
     ```python
     from scapy.all import show_interfaces
     show_interfaces()
     ```

## Development Environment Tips

1. **VSCode Configuration**:
   ```json
   {
     "python.defaultInterpreterPath": "./backend/venv/Scripts/python.exe",
     "python.analysis.extraPaths": ["./backend/src"]
   }
   ```

2. **Git Configuration**:
   - Ensure `.gitignore` includes virtual environment and database files
   - Consider using Git LFS for large packet captures

3. **Testing Setup**:
   ```bash
   # Install test dependencies
   pip install pytest pytest-cov

   # Run tests with coverage
   pytest --cov=src tests/
   ```

## Frontend Setup

For detailed instructions on setting up the Electron.js frontend, please refer to the [Electron.js Setup Guide](electron_setup.md).
