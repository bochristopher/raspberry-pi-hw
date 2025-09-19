const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const cors = require('cors');

// Import our hardware drivers
const LIS3DH = require('./drivers/lis3dh');
const CameraCapture = require('./drivers/camera');
const ATECC608 = require('./crypto/atecc608');
const DS3231 = require('./drivers/ds3231');
const ProvenanceDatabase = require('./data/database');
const ProvenanceTracker = require('./data/provenance');

class SecureCameraSystem {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.wss = new WebSocket.Server({ server: this.server });

        // Hardware components
        this.accelerometer = new LIS3DH();
        this.camera = new CameraCapture();
        this.crypto = new ATECC608();
        this.rtc = new DS3231();
        this.database = new ProvenanceDatabase();
        this.provenance = null;

        this.setupExpress();
        this.setupWebSocket();
        this.setupRoutes();
    }

    setupExpress() {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.static(path.join(__dirname, '../public')));
        this.app.use('/captures', express.static('captures'));
    }

    setupWebSocket() {
        this.wss.on('connection', (ws) => {
            console.log('Client connected to WebSocket');

            ws.send(JSON.stringify({
                type: 'status',
                data: this.getSystemStatus()
            }));

            ws.on('message', async (message) => {
                try {
                    const data = JSON.parse(message);
                    await this.handleWebSocketMessage(ws, data);
                } catch (error) {
                    console.error('WebSocket message error:', error);
                }
            });

            ws.on('close', () => {
                console.log('Client disconnected from WebSocket');
            });
        });
    }

    async handleWebSocketMessage(ws, data) {
        switch (data.type) {
            case 'manual_capture':
                await this.handleMotionDetection({ manual: true });
                break;
            case 'get_events':
                const events = await this.database.getEvents(20);
                ws.send(JSON.stringify({
                    type: 'events',
                    data: events
                }));
                break;
            case 'verify_event':
                const verification = await this.provenance.verifyEvent(data.eventId);
                ws.send(JSON.stringify({
                    type: 'verification',
                    data: verification
                }));
                break;
        }
    }

    setupRoutes() {
        // API Routes
        this.app.get('/api/status', (req, res) => {
            res.json(this.getSystemStatus());
        });

        this.app.get('/api/events', async (req, res) => {
            try {
                const limit = parseInt(req.query.limit) || 50;
                const offset = parseInt(req.query.offset) || 0;
                const events = await this.database.getEvents(limit, offset);
                res.json(events);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.get('/api/events/:id', async (req, res) => {
            try {
                const event = await this.database.getEventById(req.params.id);
                if (event) {
                    res.json(event);
                } else {
                    res.status(404).json({ error: 'Event not found' });
                }
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.post('/api/verify/:id', async (req, res) => {
            try {
                const verification = await this.provenance.verifyEvent(req.params.id);
                res.json(verification);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.get('/api/provenance/status', async (req, res) => {
            try {
                const status = await this.provenance.getProvenanceChainStatus();
                res.json(status);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.post('/api/capture', async (req, res) => {
            try {
                const record = await this.handleMotionDetection({ manual: true });
                res.json(record);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Serve main page
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, '../public/index.html'));
        });
    }

    async initialize() {
        try {
            console.log('Initializing Secure Camera System...');

            // Initialize database first
            await this.database.initialize();

            // Initialize hardware components
            await Promise.all([
                this.crypto.initialize(),
                this.rtc.initialize(),
                this.camera.initialize()
            ]);

            // Initialize provenance tracker
            this.provenance = new ProvenanceTracker(this.database, this.crypto, this.rtc);
            await this.provenance.initialize();

            // Initialize accelerometer last and set up motion detection
            await this.accelerometer.initialize();
            this.accelerometer.on('motion', this.handleMotionDetection.bind(this));

            console.log('System initialized successfully');
        } catch (error) {
            console.error('Failed to initialize system:', error);
            throw error;
        }
    }

    async handleMotionDetection(motionData) {
        try {
            console.log('Motion detected, capturing frame...');

            // Capture frame
            const imageData = await this.camera.captureAndSave();

            // Create provenance record
            const record = await this.provenance.createProvenanceRecord(
                'motion_detection',
                motionData,
                imageData
            );

            // Broadcast to all connected WebSocket clients
            const message = JSON.stringify({
                type: 'new_event',
                data: {
                    ...record,
                    imageData: imageData.base64Data
                }
            });

            this.wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            });

            return record;
        } catch (error) {
            console.error('Failed to handle motion detection:', error);
            return null;
        }
    }

    getSystemStatus() {
        return {
            accelerometer: this.accelerometer ? {
                initialized: true,
                threshold: this.accelerometer.threshold
            } : { initialized: false },
            camera: this.camera ? this.camera.getStatus() : { initialized: false },
            crypto: this.crypto ? this.crypto.getStatus() : { initialized: false },
            rtc: this.rtc ? this.rtc.getStatus() : { initialized: false },
            database: { initialized: this.database !== null },
            provenance: { initialized: this.provenance !== null }
        };
    }

    start(port = 3000) {
        this.server.listen(port, '0.0.0.0', () => {
            console.log(`Secure Camera System running on port ${port}`);
            console.log(`Web interface: http://localhost:${port}`);
            console.log(`External access: http://0.0.0.0:${port}`);
        });
    }

    async stop() {
        console.log('Stopping Secure Camera System...');

        // Stop hardware components
        if (this.accelerometer) this.accelerometer.stop();
        if (this.camera) this.camera.stop();
        if (this.crypto) this.crypto.stop();
        if (this.rtc) this.rtc.stop();
        if (this.database) this.database.stop();

        // Close server
        this.server.close();
        this.wss.close();
    }
}

// Create and start the system
const system = new SecureCameraSystem();

async function main() {
    try {
        await system.initialize();
        system.start(process.env.PORT || 3000);
    } catch (error) {
        console.error('Failed to start system:', error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\nReceived SIGINT, shutting down gracefully...');
    await system.stop();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\nReceived SIGTERM, shutting down gracefully...');
    await system.stop();
    process.exit(0);
});

if (require.main === module) {
    main();
}

module.exports = SecureCameraSystem;