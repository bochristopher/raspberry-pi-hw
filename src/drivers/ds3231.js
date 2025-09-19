let i2c;
try {
    i2c = require('i2c-bus');
} catch (error) {
    console.log('i2c-bus not available, using system time fallback');
    i2c = null;
}

class DS3231 {
    constructor(busNumber = 1, address = 0x68) {
        this.busNumber = busNumber;
        this.address = address;
        this.bus = null;
        this.initialized = false;
    }

    async initialize() {
        try {
            if (!i2c) {
                console.log('DS3231: Using system time fallback - no hardware I2C available');
                this.initialized = false;
                return;
            }

            this.bus = await i2c.openPromisified(this.busNumber);

            // Check if DS3231 is responding
            await this.bus.readByte(this.address, 0x00);

            // Clear oscillator stop flag if set
            const status = await this.bus.readByte(this.address, 0x0F);
            if (status & 0x80) {
                await this.bus.writeByte(this.address, 0x0F, status & 0x7F);
            }

            console.log('DS3231 RTC initialized successfully');
            this.initialized = true;
        } catch (error) {
            console.error('Failed to initialize DS3231, using system time:', error);
            this.initialized = false;
        }
    }

    bcdToDec(bcd) {
        return ((bcd >> 4) * 10) + (bcd & 0x0F);
    }

    decToBcd(dec) {
        return ((Math.floor(dec / 10) << 4) | (dec % 10));
    }

    async readTime() {
        if (!this.initialized) {
            return new Date();
        }

        try {
            const data = Buffer.alloc(7);
            for (let i = 0; i < 7; i++) {
                data[i] = await this.bus.readByte(this.address, i);
            }

            const seconds = this.bcdToDec(data[0] & 0x7F);
            const minutes = this.bcdToDec(data[1] & 0x7F);
            const hours = this.bcdToDec(data[2] & 0x3F);
            const day = this.bcdToDec(data[4] & 0x3F);
            const month = this.bcdToDec(data[5] & 0x1F);
            const year = this.bcdToDec(data[6]) + 2000;

            return new Date(year, month - 1, day, hours, minutes, seconds);
        } catch (error) {
            console.error('Failed to read DS3231 time:', error);
            return new Date();
        }
    }

    async setTime(date = new Date()) {
        if (!this.initialized) {
            console.log('DS3231 not available, time not set');
            return;
        }

        try {
            const seconds = this.decToBcd(date.getSeconds());
            const minutes = this.decToBcd(date.getMinutes());
            const hours = this.decToBcd(date.getHours());
            const dayOfWeek = this.decToBcd(date.getDay() + 1);
            const day = this.decToBcd(date.getDate());
            const month = this.decToBcd(date.getMonth() + 1);
            const year = this.decToBcd(date.getFullYear() - 2000);

            await this.bus.writeByte(this.address, 0x00, seconds);
            await this.bus.writeByte(this.address, 0x01, minutes);
            await this.bus.writeByte(this.address, 0x02, hours);
            await this.bus.writeByte(this.address, 0x03, dayOfWeek);
            await this.bus.writeByte(this.address, 0x04, day);
            await this.bus.writeByte(this.address, 0x05, month);
            await this.bus.writeByte(this.address, 0x06, year);

            console.log('DS3231 time set successfully');
        } catch (error) {
            console.error('Failed to set DS3231 time:', error);
        }
    }

    async getTemperature() {
        if (!this.initialized) {
            return 25.0; // Default temperature
        }

        try {
            const msb = await this.bus.readByte(this.address, 0x11);
            const lsb = await this.bus.readByte(this.address, 0x12);

            let temperature = msb;
            if (lsb & 0x80) temperature += 0.5;
            if (lsb & 0x40) temperature += 0.25;

            // Handle negative temperatures
            if (msb & 0x80) {
                temperature = temperature - 256;
            }

            return temperature;
        } catch (error) {
            console.error('Failed to read DS3231 temperature:', error);
            return 25.0;
        }
    }

    async getPreciseTimestamp() {
        const rtcTime = await this.readTime();
        const temperature = await this.getTemperature();

        return {
            timestamp: rtcTime,
            iso: rtcTime.toISOString(),
            unix: Math.floor(rtcTime.getTime() / 1000),
            temperature: temperature,
            source: this.initialized ? 'DS3231' : 'SYSTEM',
            precision: this.initialized ? 'RTC' : 'SYSTEM'
        };
    }

    getStatus() {
        return {
            initialized: this.initialized,
            address: this.address,
            available: this.initialized
        };
    }

    stop() {
        if (this.bus) {
            this.bus.close();
        }
    }
}

module.exports = DS3231;