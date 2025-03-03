# Network Traffic Monitor

A desktop application for capturing and analyzing network traffic.

## Project Structure

```
/network-traffic-monitor/
├── backend/                 # Python-based packet capturing 
│   ├── src/                 # Source code
│   ├── tests/               # Unit tests
│   └── requirements.txt     # Python dependencies
├── frontend/                # Electron.js GUI
│   ├── src/                 # Source code
│   ├── public/              # Static assets
│   ├── tests/               # Unit tests
│   └── package.json         # Node.js dependencies and scripts
├── storage/                 # Data storage configuration and scripts
│   ├── schemas/             # Database schemas (if using SQLite)
│   ├── migrations/          # Database migrations
│   └── data/                # Stored packet captures
├── docs/                    # Project documentation
├── scripts/                 # Utility scripts
└── .gitignore               # Git ignore file
```

## Setup Instructions

For detailed setup instructions, including environment configuration, dependency installation, and troubleshooting, see our [Comprehensive Setup Guide](docs/setup_guide.md).

### Quick Start

#### Prerequisites

- Python 3.8+
- Node.js 14+
- Git
- Npcap (Windows) or libpcap (Linux/MacOS)

#### Backend Setup

```bash
cd backend
# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
# Install dependencies
pip install -r requirements.txt
```

### Frontend Setup

```bash
cd frontend
# Install dependencies
npm install
```

### Running the Application

1. Start the backend server (if needed)
2. Launch the Electron application:

```bash
cd frontend
npm start
```

## Development

### Backend Development

The backend uses Python with Scapy for packet capturing and analysis.

### Frontend Development

The frontend is built with Electron.js for cross-platform desktop support.

### Data Storage

The application supports two storage methods:
- SQLite database (default) for structured storage of packet data
- JSON files for capture sessions and exports

For detailed storage configuration, see the [Setup Guide](docs/setup_guide.md#local-storage-setup).
