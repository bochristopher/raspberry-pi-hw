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
        try {
            if (!i2c) {
                console.log('ATECC608: Using software crypto fallback - no hardware I2C available');
                this.initialized = false;
                return;
            }

            this.bus = await i2c.openPromisified(this.busNumber);

            // Wake up the chip
            await this.wakeup();

            // Read device revision to verify communication
            const revision = await this.getRevision();
            console.log(`ATECC608 initialized, revision: ${revision.toString(16)}`);

            this.initialized = true;
        } catch (error) {
            console.error('Failed to initialize ATECC608:', error);
            // For demo purposes, we'll use software crypto if hardware isn't available
            console.log('Falling back to software cryptography');
            this.initialized = false;
        }
    }

    async wakeup() {
        // Send wake condition (dummy write)
        try {
            await this.bus.writeByte(this.address, 0x00, 0x00);
        } catch (error) {
            // Expected to fail, this is just to wake the chip
        }

        // Wait for wake-up
        await new Promise(resolve => setTimeout(resolve, 10));
    }

    async getRevision() {
        const command = Buffer.from([0x03, 0x07, 0x30, 0x00, 0x00, 0x00, 0x03, 0x5D]);
        await this.sendCommand(command);
        const response = await this.receiveResponse();
        return response[1];
    }

    async sendCommand(commandBuffer) {
        const length = commandBuffer.length;
        const packet = Buffer.concat([Buffer.from([length]), commandBuffer]);

        for (let i = 0; i < packet.length; i++) {
            await this.bus.writeByte(this.address, packet[i]);
        }
    }

    async receiveResponse() {
        // Read response length
        const length = await this.bus.readByte(this.address, 0x00);

        // Read response data
        const response = Buffer.alloc(length - 1);
        for (let i = 0; i < length - 1; i++) {
            response[i] = await this.bus.readByte(this.address, 0x00);
        }

        return response;
    }

    async signData(data) {
        if (this.initialized) {
            return await this.hardwareSign(data);
        } else {
            return await this.softwareSign(data);
        }
    }

    async hardwareSign(data) {
        try {
            const hash = crypto.createHash('sha256').update(data).digest();

            // This is a simplified implementation
            // Real ATECC608 signing would use proper ECDSA commands
            const command = Buffer.concat([
                Buffer.from([0x41, 0x07, 0x80, 0x00]),
                hash.slice(0, 32)
            ]);

            await this.sendCommand(command);
            const signature = await this.receiveResponse();

            return {
                signature: signature.toString('hex'),
                algorithm: 'ECDSA-SHA256',
                keyId: 'ATECC608-SLOT0',
                hardware: true
            };
        } catch (error) {
            console.error('Hardware signing failed, falling back to software:', error);
            return await this.softwareSign(data);
        }
    }

    async softwareSign(data) {
        // Software fallback using Node.js crypto
        const privateKey = crypto.generateKeyPairSync('ec', {
            namedCurve: 'secp256k1'
        }).privateKey;

        const sign = crypto.createSign('SHA256');
        sign.update(data);
        const signature = sign.sign(privateKey, 'hex');

        return {
            signature,
            algorithm: 'ECDSA-SHA256',
            keyId: 'SOFTWARE-FALLBACK',
            hardware: false
        };
    }

    async verifySignature(data, signatureInfo) {
        if (signatureInfo.hardware && this.initialized) {
            return await this.hardwareVerify(data, signatureInfo);
        } else {
            return await this.softwareVerify(data, signatureInfo);
        }
    }

    async hardwareVerify(data, signatureInfo) {
        // Simplified hardware verification
        // Real implementation would use ATECC608 verify commands
        return true; // Placeholder
    }

    async softwareVerify(data, signatureInfo) {
        try {
            // For demo purposes, we'll generate a verification key
            // In practice, you'd have the public key stored
            return Math.random() > 0.1; // 90% success rate for demo
        } catch (error) {
            console.error('Verification failed:', error);
            return false;
        }
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