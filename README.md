# Network Traffic Monitor

![Project Structure](https://img.shields.io/badge/status-active-success.svg) ![Python](https://img.shields.io/badge/python-3.8+-blue.svg) ![Node.js](https://img.shields.io/badge/node.js-14+-green.svg) ![Electron](https://img.shields.io/badge/electron.js-gui-yellow.svg) 

A desktop application for real-time network traffic capture and analysis, built with Python (Scapy) for packet processing and Electron.js for cross-platform GUI.

## Project Architecture

```
/network-traffic-monitor/
├── backend/                 # Core packet processing engine
│   ├── src/                 # Production-grade Python code
│   ├── tests/               # Pytest unit/integration tests
│   └── requirements.txt     # Pinned dependencies
├── frontend/                # Enterprise-ready Electron interface
│   ├── src/                 # TypeScript source
│   ├── public/              # Optimized static assets
│   ├── tests/               # Jest test suite
│   └── package.json         # Version-controlled dependencies
├── storage/                 # Persistent data management
│   ├── schemas/             # SQLite schema definitions
│   ├── migrations/          # Versioned database migrations
│   └── data/                # PCAP storage (git-ignored)
├── docs/                    # Technical documentation
├── scripts/                 # Deployment/maintenance scripts
└── .gitignore               # Professional exclusion patterns
```

## System Requirements

### Minimum Specifications
- **OS**: Windows 10 (1809+), macOS 10.15+, or Linux (kernel 5.4+)
- **CPU**: x86-64 processor with SSE4.2 support
- **RAM**: 4GB minimum (8GB recommended for heavy traffic)
- **Storage**: 500MB available space

### Required Components
| Component       | Version     | Notes                          |
|-----------------|-------------|--------------------------------|
| Python          | 3.8+        | With pip 20.0+                 |
| Node.js         | 14.x LTS    | Recommended: 16.x              |
| Npcap/libpcap   | Latest      | Admin privileges required      |

## Installation

### Backend Setup

```bash
# Clone repository (professional practice: use SSH)
git clone https://github.com/your-repo/network-traffic-monitor.git
cd network-traffic-monitor/backend

# Create isolated Python environment
python -m venv .venv --prompt ntm

# Activate environment
# Windows:
.venv\Scripts\activate
# Unix/macOS:
source .venv/bin/activate

# Install production dependencies with hash checking
pip install --require-hashes -r requirements.txt

# Verify Scapy installation
python -c "from scapy.all import sniff; print('Dependency check passed')"
```

### Frontend Setup

```bash
cd ../frontend

# Install exact package versions (from package-lock.json)
npm ci --production

# Build production assets
npm run build
```

## Production Execution

### Running in Production Mode

1. **Start Backend Service**:
```bash
cd backend
.venv/bin/python -m src.main --production
```

2. **Launch Electron Application**:
```bash
cd frontend
npm start -- --production
```

## Development Practices

### Backend Standards
- **Testing**: Pytest with 85%+ coverage requirement
- **Dependencies**: Pinned versions with hashes in requirements.txt

### Frontend Standards
- **Type Safety**: TypeScript strict mode enabled
- **Packaging**: Webpack with production optimizations

## Data Management

### Storage Options

| Method  | Recommended Use Case          | Performance | Size Limit |
|---------|-------------------------------|-------------|------------|
| SQLite  | Structured packet metadata    | High        | 140TB*     |
| JSON    | Session exports/transfers     | Medium      | 2GB        |

*\*Theoretical maximum, practical limits depend on filesystem*

## Compliance Notes

- All network monitoring complies with standard ethical guidelines
- No packet payload storage implemented by default
- User must ensure proper authorization before monitoring networks
