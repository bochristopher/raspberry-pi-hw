#!/usr/bin/env node

const Camera = require('./src/drivers/camera.js');
const DS3231 = require('./src/drivers/ds3231.js');
const ATECC608 = require('./src/crypto/atecc608.js');
const LIS3DH = require('./src/drivers/lis3dh.js');
const fs = require('fs').promises;
const path = require('path');

class StandaloneSecureCamera {
    constructor() {
        this.camera = new Camera();
        this.rtc = new DS3231();
        this.crypto = new ATECC608();
        this.accelerometer = new LIS3DH();
        this.initialized = false;
    }

    async initialize() {
        console.log('🚀 Initializing Standalone Secure Camera System...');

        try {
            // Initialize all hardware components
            console.log('📷 Initializing camera...');
            await this.camera.initialize();

            console.log('⏰ Initializing RTC...');
            await this.rtc.initialize();

            console.log('🔐 Initializing crypto chip...');
            await this.crypto.initialize();

            console.log('📱 Initializing accelerometer...');
            await this.accelerometer.initialize();

            this.initialized = true;
            console.log('✅ All systems initialized successfully!');

            // Display system status
            await this.displayStatus();

        } catch (error) {
            console.error('❌ System initialization failed:', error.message);
            throw error;
        }
    }

    async displayStatus() {
        console.log('\n📊 System Status:');
        console.log('================');

        // Camera status
        const cameraStatus = this.camera.getStatus();
        console.log(`📷 Camera: ${cameraStatus.initialized ? '✅' : '❌'} ${cameraStatus.mockMode ? '(Mock)' : '(Hardware)'}`);

        // RTC status and time
        const rtcStatus = this.rtc.getStatus();
        const currentTime = await this.rtc.getPreciseTimestamp();
        console.log(`⏰ RTC: ${rtcStatus.initialized ? '✅' : '❌'} Time: ${currentTime.iso}`);
        console.log(`🌡️  Temperature: ${currentTime.temperature}°C`);

        // Crypto status
        const cryptoStatus = this.crypto.getStatus();
        console.log(`🔐 Crypto: ${cryptoStatus.initialized ? '✅' : '❌'} Addr: 0x${cryptoStatus.address.toString(16)}`);

        // Accelerometer status and reading
        try {
            const accelData = await this.accelerometer.readAcceleration();
            console.log(`📱 Accelerometer: ✅ Motion: x=${accelData.x.toFixed(3)}, y=${accelData.y.toFixed(3)}, z=${accelData.z.toFixed(3)}`);
        } catch (error) {
            console.log(`📱 Accelerometer: ❌ Error: ${error.message}`);
        }

        console.log('================\n');
    }

    async captureSecureImage() {
        if (!this.initialized) {
            throw new Error('System not initialized');
        }

        console.log('📸 Capturing secure image...');

        // Get precise timestamp
        const timestamp = await this.rtc.getPreciseTimestamp();

        // Get motion context
        const motion = await this.accelerometer.readAcceleration();

        // Capture image
        const capture = await this.camera.captureFrame();

        // Create provenance data
        const provenance = {
            timestamp: timestamp.iso,
            unixTime: timestamp.unix,
            temperature: timestamp.temperature,
            motion: {
                x: motion.x,
                y: motion.y,
                z: motion.z,
                magnitude: Math.sqrt(motion.x*motion.x + motion.y*motion.y + motion.z*motion.z)
            },
            capture: {
                filename: capture.filename,
                dimensions: capture.dimensions,
                mockMode: capture.mockMode
            }
        };

        // Sign the provenance data
        const provenanceString = JSON.stringify(provenance);
        const signature = await this.crypto.signData(provenanceString);

        // Create complete record
        const secureRecord = {
            provenance,
            signature,
            captureData: capture
        };

        // Save to file
        const recordFilename = `secure_${capture.filename.replace('.jpg', '.json')}`;
        const recordPath = path.join('captures', recordFilename);

        await fs.writeFile(recordPath, JSON.stringify(secureRecord, null, 2));

        console.log('✅ Secure capture completed:');
        console.log(`   📄 Image: ${capture.filepath}`);
        console.log(`   📋 Record: ${recordPath}`);
        console.log(`   🔐 Signature: ${signature.hardware ? 'Hardware' : 'Mock'}`);
        console.log(`   📊 Motion: ${provenance.motion.magnitude.toFixed(3)}`);

        return secureRecord;
    }

    async startInteractiveMode() {
        console.log('🎮 Interactive Mode - Commands:');
        console.log('  📸 c or capture - Take secure photo');
        console.log('  📊 s or status  - Show system status');
        console.log('  🚪 q or quit    - Exit program');
        console.log('');

        process.stdin.setEncoding('utf8');
        process.stdin.on('data', async (input) => {
            const command = input.trim().toLowerCase();

            try {
                switch (command) {
                    case 'c':
                    case 'capture':
                        await this.captureSecureImage();
                        break;

                    case 's':
                    case 'status':
                        await this.displayStatus();
                        break;

                    case 'q':
                    case 'quit':
                        console.log('👋 Shutting down...');
                        await this.shutdown();
                        process.exit(0);
                        break;

                    default:
                        console.log('❓ Unknown command. Use: c/capture, s/status, q/quit');
                        break;
                }
            } catch (error) {
                console.error('❌ Command failed:', error.message);
            }

            process.stdout.write('> ');
        });

        process.stdout.write('> ');
    }

    async shutdown() {
        console.log('🔌 Stopping hardware components...');

        if (this.accelerometer) {
            this.accelerometer.stop();
        }

        if (this.crypto) {
            this.crypto.stop();
        }

        console.log('✅ Shutdown complete');
    }
}

// Main execution
async function main() {
    const system = new StandaloneSecureCamera();

    try {
        await system.initialize();

        // Check command line arguments
        const args = process.argv.slice(2);

        if (args.includes('--help') || args.includes('-h')) {
            console.log('📖 Standalone Secure Camera - Usage:');
            console.log('  ./standalone.js               - Interactive mode');
            console.log('  ./standalone.js --capture|-c  - Take single secure photo');
            console.log('  ./standalone.js --status|-s   - Show system status');
            console.log('  ./standalone.js --help|-h     - Show this help');
            await system.shutdown();
        } else if (args.includes('--capture') || args.includes('-c')) {
            // Single capture mode
            await system.captureSecureImage();
            await system.shutdown();
        } else if (args.includes('--status') || args.includes('-s')) {
            // Status only mode
            await system.displayStatus();
            await system.shutdown();
        } else {
            // Interactive mode
            await system.startInteractiveMode();
        }

    } catch (error) {
        console.error('💥 System error:', error.message);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Received interrupt signal...');
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Received terminate signal...');
    process.exit(0);
});

if (require.main === module) {
    main();
}

module.exports = StandaloneSecureCamera;