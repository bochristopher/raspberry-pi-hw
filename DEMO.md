# 🔒 Secure Camera Provenance System Demo

## System Status: ✅ RUNNING

The secure camera system is now operational and running on **http://localhost:3001**

## 🎯 Demo Features Live

### 🔴 **Mock Hardware Mode**
Since real hardware isn't connected, the system runs in demonstration mode:

- **LIS3DH Accelerometer**: Mock motion detection triggers every 15 seconds
- **USB Camera**: Generates mock camera images with timestamps
- **ATECC608 Crypto**: Software ECDSA signing (demonstrates security)
- **DS3231 RTC**: System time with precise timestamping
- **SQLite Database**: Real provenance chain with cryptographic hashing

### 📊 **Current System Metrics**
```
Chain Status: ✅ Valid
Total Events: 8+ (growing automatically)
Signed Events: 100%
Signature Rate: 100.0%
Hardware Fallback: Software crypto + Mock sensors
```

### 🌐 **Web Interface**
**Access: http://localhost:3001**

Features include:
- **Real-time Dashboard**: Live system status and hardware monitoring
- **Motion Detection**: Automatic triggers every 15 seconds
- **Manual Capture**: Button to trigger immediate capture
- **Visual Comparison**: Side-by-side signed vs unsigned data demo
- **Event Log**: Complete audit trail with cryptographic verification
- **Provenance Chain**: Interactive chain visualization

### 🔍 **API Endpoints**
```bash
# System Status
curl http://localhost:3001/api/status

# View Events
curl http://localhost:3001/api/events

# Manual Capture
curl -X POST http://localhost:3001/api/capture

# Provenance Status
curl http://localhost:3001/api/provenance/status

# Verify Event
curl -X POST http://localhost:3001/api/verify/{event-id}
```

### 📷 **Captured Images**
Mock camera images are stored in `/captures/` directory:
- Each image shows timestamp and "MOCK CAMERA FEED" text
- Images are cryptographically hashed for integrity
- Base64 encoded for real-time web display

### 🔐 **Security Demonstration**

#### ✅ **Signed Data** (Current Mode)
- Cryptographic ECDSA-SHA256 signatures
- Hardware security simulation
- Tamper-evident logging
- Immutable provenance chain
- Verification possible

#### ❌ **Unsigned Data** (Comparison)
- No cryptographic protection
- Data integrity questionable
- No tamper detection
- Vulnerable to modification
- No verification possible

### 🎮 **Interactive Demo**

1. **Watch Automatic Motion**: System triggers every 15 seconds
2. **Manual Capture**: Use web interface button or API
3. **Verify Events**: Real cryptographic signature verification
4. **Chain Integrity**: Provenance chain validation
5. **Visual Comparison**: See signed vs unsigned differences

### 🛠 **Technical Architecture**

- **Backend**: Node.js with Express + WebSocket
- **Database**: SQLite with provenance tracking
- **Crypto**: ECDSA with secp256k1 curve
- **Images**: JIMP mock generation + Base64 encoding
- **Frontend**: Real-time dashboard with JavaScript
- **Chain**: SHA-256 hash linking for immutability

### 🚀 **Production Deployment**

For real hardware deployment:
1. Enable I2C on Raspberry Pi
2. Connect hardware components per README
3. Install OpenCV for real camera
4. Configure proper key management
5. Set up HTTPS/TLS encryption

The system gracefully falls back to mock mode when hardware isn't available, making it perfect for demonstration and development!

---

**🎯 Ready to explore secure IoT provenance tracking!**