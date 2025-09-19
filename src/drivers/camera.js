const NodeWebcam = require('node-webcam');
const fs = require('fs').promises;
const path = require('path');
const Jimp = require('jimp');

class CameraCapture {
    constructor(deviceId = 0) {
        this.deviceId = deviceId;
        this.webcam = null;
        this.captureDir = 'captures';
        this.initialized = false;
    }

    async initialize() {
        try {
            // Create captures directory if it doesn't exist
            await fs.mkdir(this.captureDir, { recursive: true });

            // Configure webcam options
            const opts = {
                width: 640,
                height: 480,
                quality: 100,
                delay: 0,
                saveShots: true,
                output: 'jpeg',
                device: false, // Use default camera
                callbackReturn: 'location',
                verbose: false
            };

            this.webcam = NodeWebcam.create(opts);
            this.initialized = true;

            console.log('Camera initialized successfully');
        } catch (error) {
            console.error('Failed to initialize camera:', error);
            // For demo purposes, we'll create a mock camera
            this.initializeMockCamera();
        }
    }

    initializeMockCamera() {
        console.log('Initializing mock camera for demonstration');
        this.initialized = true;
        this.mockMode = true;
    }

    async captureFrame() {
        if (!this.initialized) {
            throw new Error('Camera not initialized');
        }

        try {
            if (this.mockMode) {
                return await this.captureMockFrame();
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `frame_${timestamp}.jpg`;
            const filepath = path.join(this.captureDir, filename);

            // Capture image
            return new Promise((resolve, reject) => {
                this.webcam.capture(filepath, (err, data) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    // Read the captured file and convert to base64
                    fs.readFile(data)
                        .then(buffer => {
                            const base64 = buffer.toString('base64');
                            resolve({
                                filepath: data,
                                filename,
                                base64Data: `data:image/jpeg;base64,${base64}`,
                                timestamp: new Date(),
                                width: 640,
                                height: 480
                            });
                        })
                        .catch(reject);
                });
            });
        } catch (error) {
            console.error('Failed to capture frame:', error);
            return await this.captureMockFrame();
        }
    }

    async captureMockFrame() {
        try {
            // Create a mock image with timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `mock_frame_${timestamp}.jpg`;
            const filepath = path.join(this.captureDir, filename);

            // Create a simple colored rectangle with timestamp text
            const image = new Jimp(640, 480, 0x4A90E2FF);
            const font = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);

            image.print(font, 50, 200, 'MOCK CAMERA FEED');
            image.print(font, 50, 250, new Date().toLocaleString());

            await image.writeAsync(filepath);

            // Convert to base64
            const buffer = await image.getBufferAsync(Jimp.MIME_JPEG);
            const base64 = buffer.toString('base64');

            return {
                filepath,
                filename,
                base64Data: `data:image/jpeg;base64,${base64}`,
                timestamp: new Date(),
                width: 640,
                height: 480,
                mock: true
            };
        } catch (error) {
            console.error('Failed to create mock frame:', error);
            throw error;
        }
    }

    async captureAndSave() {
        const frameData = await this.captureFrame();
        console.log(`Frame captured: ${frameData.filename}${frameData.mock ? ' (MOCK)' : ''}`);
        return frameData;
    }

    getStatus() {
        return {
            initialized: this.initialized,
            deviceId: this.deviceId,
            mockMode: this.mockMode || false
        };
    }

    stop() {
        this.initialized = false;
        this.webcam = null;
    }
}

module.exports = CameraCapture;