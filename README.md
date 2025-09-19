# Secure Camera Provenance System

A comprehensive IoT security demonstration system that integrates multiple hardware components for secure data provenance tracking. The system captures camera frames triggered by motion detection and cryptographically signs them for tamper-evident logging.

## Hardware Components

- **LIS3DH Accelerometer**: Motion detection and interrupt generation
- **USB Camera**: Image capture functionality
- **ATECC608**: Hardware cryptographic signing (with software fallback)
- **DS3231**: Real-time clock for precise timestamping
- **SQLite Database**: Event logging and provenance chain storage

## Features

### 🔒 Cryptographic Security
- Hardware-based ECDSA signing using ATECC608
- Software fallback for demonstration purposes
- Cryptographic provenance chain linking all events
- Data integrity verification

### 📷 Motion-Triggered Capture
- LIS3DH accelerometer monitors for motion
- Automatic camera capture on movement detection
- Manual capture capability via web interface
- Real-time image streaming to web dashboard

### 🔍 Provenance Tracking
- Immutable event logging with SQLite
- Cryptographic hash chain for event ordering
- Timestamp verification using RTC
- Visual comparison of signed vs unsigned data

### 🌐 Web Interface
- Real-time system status monitoring
- Live camera feed display
- Event log with verification status
- Interactive provenance chain visualization
- Hardware status indicators

## Installation

### Prerequisites
```bash
# Install Node.js dependencies
npm install

# Install OpenCV (required for camera functionality)
# Ubuntu/Debian:
sudo apt-get install libopencv-dev

# Enable I2C on Raspberry Pi
sudo raspi-config
# Navigate to Interface Options > I2C > Enable
```

### Hardware Setup

#### I2C Connections
```
LIS3DH Accelerometer:
- VCC → 3.3V
- GND → Ground
- SDA → GPIO 2 (SDA)
- SCL → GPIO 3 (SCL)
- Address: 0x18

ATECC608 Crypto Chip:
- VCC → 3.3V
- GND → Ground
- SDA → GPIO 2 (SDA)
- SCL → GPIO 3 (SCL)
- Address: 0x60

DS3231 RTC:
- VCC → 3.3V
- GND → Ground
- SDA → GPIO 2 (SDA)
- SCL → GPIO 3 (SCL)
- Address: 0x68
```

#### USB Camera
- Connect any USB UVC-compatible camera
- System will auto-detect on /dev/video0

## Usage

### Starting the System
```bash
# Development mode with auto-restart
npm run dev

# Production mode
npm start
```

### Web Interface
Navigate to `http://localhost:3000` to access the dashboard.

### API Endpoints

#### System Status
```bash
GET /api/status
```

#### Event Management
```bash
# Get events
GET /api/events?limit=50&offset=0

# Get specific event
GET /api/events/:id

# Verify event signature
POST /api/verify/:id

# Manual capture
POST /api/capture
```

#### Provenance Chain
```bash
# Get chain status
GET /api/provenance/status
```

## Architecture

### Data Flow
1. **Motion Detection**: LIS3DH detects movement and triggers interrupt
2. **Image Capture**: Camera captures frame automatically
3. **Timestamping**: DS3231 provides precise RTC timestamp
4. **Signing**: ATECC608 cryptographically signs event data
5. **Logging**: Event stored in SQLite with provenance chain
6. **Verification**: Web interface displays signed vs unsigned comparison

### File Structure
```
src/
├── drivers/
│   ├── lis3dh.js          # Accelerometer driver
│   ├── camera.js          # USB camera interface
│   └── ds3231.js          # RTC driver
├── crypto/
│   └── atecc608.js        # Crypto chip interface
├── data/
│   ├── database.js        # SQLite database management
│   └── provenance.js      # Provenance tracking logic
├── web/
└── server.js              # Main application server

public/
├── index.html            # Web dashboard
├── css/style.css         # Styling
└── js/app.js            # Frontend JavaScript

captures/                 # Stored camera images
logs/                    # Application logs
data/                    # SQLite database files
```

## Security Features

### Cryptographic Provenance
- Each event is cryptographically signed
- Hash chain links events in chronological order
- Tamper detection through signature verification
- Hardware security module (ATECC608) for key storage

### Data Integrity
- Image hash calculation for content verification
- Timestamp authentication via RTC
- Chain of custody maintenance
- Audit trail for all system events

## Demonstration

The web interface provides a clear visual comparison between:

### ✅ Signed Data
- Cryptographic signature present
- Hardware-verified timestamps
- Tamper-evident logging
- Chain of custody maintained

### ❌ Unsigned Data
- No cryptographic protection
- Questionable data integrity
- No tamper detection
- Vulnerable to modification

## Hardware Fallbacks

The system gracefully handles missing hardware:
- **No ATECC608**: Falls back to software signing
- **No DS3231**: Uses system time
- **No LIS3DH**: Manual capture only
- **No Camera**: Simulated capture mode

## Development

### Testing
```bash
npm test
```

### Debug Mode
Set environment variable for verbose logging:
```bash
DEBUG=true npm run dev
```

## License

MIT License - See LICENSE file for details

## Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

## Security Notice

This is a demonstration system. For production use:
- Implement proper key management
- Add network security (HTTPS/TLS)
- Enhance authentication mechanisms
- Add secure boot verification
- Implement hardware tamper detection