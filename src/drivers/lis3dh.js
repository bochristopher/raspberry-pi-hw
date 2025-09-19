const { EventEmitter } = require('events');

let i2c;
try {
    i2c = require('i2c-bus');
} catch (error) {
    console.log('i2c-bus not available, using mock mode');
    i2c = null;
}

class LIS3DH extends EventEmitter {
    constructor(busNumber = 1, address = 0x18) {
        super();
        this.busNumber = busNumber;
        this.address = address;
        this.bus = null;
        this.threshold = 0.5; // g-force threshold for interrupt
    }

    async initialize() {
        try {
            if (!i2c) {
                console.log('LIS3DH: Using mock mode - no hardware I2C available');
                this.mockMode = true;
                this.startMockPolling();
                return;
            }

            this.bus = await i2c.openPromisified(this.busNumber);

            // Configure LIS3DH
            await this.bus.writeByte(this.address, 0x20, 0x57); // CTRL_REG1: ODR 100Hz, all axes enabled
            await this.bus.writeByte(this.address, 0x23, 0x00); // CTRL_REG4: ±2g scale

            // Configure interrupt
            await this.bus.writeByte(this.address, 0x22, 0x40); // CTRL_REG3: INT1 on AOI1
            await this.bus.writeByte(this.address, 0x30, 0x95); // INT1_CFG: OR combination, all axes
            await this.bus.writeByte(this.address, 0x32, Math.floor(this.threshold * 16)); // INT1_THS
            await this.bus.writeByte(this.address, 0x33, 0x01); // INT1_DURATION: 1 sample

            console.log('LIS3DH initialized successfully');
            this.startPolling();
        } catch (error) {
            console.error('Failed to initialize LIS3DH, falling back to mock mode:', error);
            this.mockMode = true;
            this.startMockPolling();
        }
    }

    async readAcceleration() {
        try {
            const xLow = await this.bus.readByte(this.address, 0x28);
            const xHigh = await this.bus.readByte(this.address, 0x29);
            const yLow = await this.bus.readByte(this.address, 0x2A);
            const yHigh = await this.bus.readByte(this.address, 0x2B);
            const zLow = await this.bus.readByte(this.address, 0x2C);
            const zHigh = await this.bus.readByte(this.address, 0x2D);

            const x = this.convertToG((xHigh << 8) | xLow);
            const y = this.convertToG((yHigh << 8) | yLow);
            const z = this.convertToG((zHigh << 8) | zLow);

            return { x, y, z };
        } catch (error) {
            console.error('Failed to read acceleration:', error);
            return { x: 0, y: 0, z: 0 };
        }
    }

    convertToG(rawValue) {
        // Convert 16-bit signed value to g-force (±2g range)
        const signed = rawValue > 32767 ? rawValue - 65536 : rawValue;
        return (signed / 16384.0);
    }

    async checkInterrupt() {
        try {
            const intSrc = await this.bus.readByte(this.address, 0x31);
            return (intSrc & 0x40) !== 0; // Check IA bit
        } catch (error) {
            console.error('Failed to check interrupt:', error);
            return false;
        }
    }

    startPolling() {
        this.pollInterval = setInterval(async () => {
            if (await this.checkInterrupt()) {
                const acceleration = await this.readAcceleration();
                console.log('Motion detected:', acceleration);
                this.emit('motion', acceleration);

                // Clear interrupt by reading INT1_SRC
                await this.bus.readByte(this.address, 0x31);
            }
        }, 100); // Poll every 100ms
    }

    startMockPolling() {
        console.log('Starting mock motion detection (triggers every 15 seconds)');
        this.pollInterval = setInterval(() => {
            const mockAcceleration = {
                x: (Math.random() - 0.5) * 2,
                y: (Math.random() - 0.5) * 2,
                z: Math.random() * 0.5 + 0.5, // Mostly positive Z (gravity)
                mock: true
            };
            console.log('Mock motion detected:', mockAcceleration);
            this.emit('motion', mockAcceleration);
        }, 15000); // Trigger every 15 seconds for demo
    }

    stop() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
        }
        if (this.bus) {
            this.bus.close();
        }
    }
}

module.exports = LIS3DH;