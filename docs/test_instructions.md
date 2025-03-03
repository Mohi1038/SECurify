# Testing Instructions

## Backend Test (Packet Capture)

1. Open a terminal with administrator/root privileges
2. Navigate to the backend directory:
```bash
cd backend
```

3. Activate the virtual environment:
```bash
# Windows
venv\Scripts\activate

# Unix/MacOS
source venv/bin/activate
```

4. Run the test capture script:
```bash
python src/test_capture.py --count 10
```

Expected output:
```
Starting packet capture (count: 10)...
============================================================

Packet captured at 2023-XX-XX XX:XX:XX
----------------------------------------
Source IP: 192.168.1.100
Destination IP: 142.250.180.78
Protocol: 6
Source Port: 52431
Destination Port: 443
TCP Flags: PA
Packet Length: 124 bytes

[... more packets ...]

Packet capture completed successfully!
```

## Frontend Test (Electron Window)

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies if not already done:
```bash
npm install
```

3. Run the test window:
```bash
# Windows
npx electron src/test_window.js

# Unix/MacOS
./node_modules/.bin/electron src/test_window.js
```

4. Verify the following:
   - A window opens with the title "Network Monitor Test"
   - Click the "Test Connection" button
   - A success message appears
   - DevTools opens if in development mode

## Troubleshooting

### Packet Capture Issues
- **Permission Denied**: Run with admin/root privileges
- **No Packets**: Check network interface and firewall settings
- **Module Not Found**: Verify Scapy installation and virtual environment

### Electron Issues
- **Window Not Opening**: Check Node.js installation and npm dependencies
- **Blank Screen**: Verify HTML content loading
- **Module Error**: Check package.json and node_modules

## Next Steps

If both tests pass:
1. The packet capture system is working correctly
2. The Electron frontend is properly configured
3. You can proceed with integrating both components

If any test fails, review the error messages and consult the setup guide for requirements and permissions.
