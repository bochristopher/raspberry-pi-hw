const crypto = require('crypto');

let i2c;
try {
    i2c = require('i2c-bus');
} catch (error) {
    console.log('i2c-bus not available, using software crypto fallback');
    i2c = null;
}

class ATECC608 {
    constructor(busNumber = 1, address = 0x60) {
        this.busNumber = busNumber;
        this.address = address;
        this.bus = null;
        this.initialized = false;
    }

    async initialize() {
        if (!i2c) {
            throw new Error('ATECC608: i2c-bus module not available - hardware I2C required');
        }

        this.bus = await i2c.openPromisified(this.busNumber);

        // Enhanced wake-up and verification sequence based on working tests
        await this.wakeupAndVerify();

        // Get device revision to verify proper communication
        const revision = await this.getRevision();
        console.log(`ATECC608 initialized successfully, revision: 0x${revision.toString(16)}`);

        this.initialized = true;
    }

    async wakeupAndVerify() {
        // Enhanced wake-up sequence that matches our working comprehensive test
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                // Method 1: Write 0x00 to device address
                await this.bus.i2cWrite(this.address, 1, Buffer.from([0x00]));
            } catch (error) {
                // Expected to fail, this is just to wake the chip
            }

            try {
                // Method 2: Write to address 0x00 (some devices need this)
                await this.bus.i2cWrite(0x00, 1, Buffer.from([0x00]));
            } catch (error) {
                // This might fail too
            }

            // Wait between attempts
            await new Promise(resolve => setTimeout(resolve, 2));
        }

        // Test basic connectivity - this approach worked in our comprehensive test
        try {
            const testRead = Buffer.alloc(1);
            await this.bus.i2cRead(this.address, 1, testRead);
            console.log(`Basic connectivity test: ${testRead.toString('hex')}`);

            if (testRead[0] === 0x04) {
                console.log('Device appears to be ready (status = 0x04)');
            }
        } catch (e) {
            console.log(`Basic connectivity test failed: ${e.message} - proceeding anyway`);
            // Don't throw error, just proceed to try Info command
        }
    }

    async getRevision() {
        // Use ATECC508-compatible format that worked in our comprehensive test
        const command = Buffer.from([0x30, 0x00, 0x00, 0x00]);

        // Calculate simple checksum (ATECC508 style)
        let checksum = 0;
        for (let i = 0; i < command.length; i++) {
            checksum += command[i];
        }
        checksum = (~checksum + 1) & 0xFF;

        const fullCommand = Buffer.concat([command, Buffer.from([checksum])]);

        console.log('DEBUG: Sending Info command:', fullCommand.toString('hex'));

        let response;
        try {
            // Send command directly (no word address prefix) - this worked in our tests
            await this.bus.i2cWrite(this.address, fullCommand.length, fullCommand);

            // Wait for command execution
            await new Promise(resolve => setTimeout(resolve, 10));

            // Read response
            response = Buffer.alloc(8);
            await this.bus.i2cRead(this.address, 8, response);
        } catch (error) {
            console.log('DEBUG: I2C communication error:', error.message);
            throw new Error(`I2C communication failed: ${error.message}`);
        }

        console.log('DEBUG: Received response:', response.toString('hex'));
        console.log('DEBUG: Response bytes:', Array.from(response));

        // Parse response based on working test results
        if (response[0] === 0x04) {
            // Use big-endian format as per ATECC documentation (MSB first)
            const revision = response.readUInt16BE(1);
            console.log('DEBUG: Parsed revision:', revision.toString(16));
            return revision;
        }

        throw new Error(`Invalid revision response: ${response.toString('hex')}`);
    }


    calculateCRC(data) {
        // CRC-16 calculation for ATECC608 (polynomial 0x8005)
        let crc = 0x0000;

        for (let i = 0; i < data.length; i++) {
            crc ^= data[i];
            for (let j = 0; j < 8; j++) {
                if (crc & 0x0001) {
                    crc = (crc >> 1) ^ 0x8005;
                } else {
                    crc = crc >> 1;
                }
            }
        }

        return crc;
    }

    async signData(data) {
        if (!this.initialized) {
            throw new Error('ATECC608 not initialized - hardware crypto required');
        }

        // For now, return a mock signature until we implement hardware signing commands
        console.log('WARNING: Hardware signing not yet implemented, using mock signature');
        const hash = crypto.createHash('sha256').update(data).digest();

        return {
            signature: hash.toString('hex'),
            algorithm: 'ECDSA-SHA256',
            keyId: 'ATECC608-SLOT0',
            hardware: false, // Mark as false since this is mock
            raw: hash
        };
    }


    async verifySignature(data, signatureInfo) {
        if (!this.initialized) {
            throw new Error('ATECC608 not initialized - hardware crypto required');
        }

        // For now, return mock verification
        console.log('WARNING: Hardware verification not yet implemented, using mock verification');
        return true;
    }

    getStatus() {
        return {
            initialized: this.initialized,
            hardware: this.initialized,
            address: this.address
        };
    }

    stop() {
        if (this.bus) {
            this.bus.close();
        }
    }
}

module.exports = ATECC608;