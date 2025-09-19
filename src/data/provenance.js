const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

class ProvenanceTracker {
    constructor(database, cryptoDevice, rtc) {
        this.db = database;
        this.crypto = cryptoDevice;
        this.rtc = rtc;
        this.lastHash = null;
    }

    async initialize() {
        // Get the last hash from the chain to continue the provenance
        try {
            const events = await this.db.getEvents(1, 0);
            if (events.length > 0) {
                this.lastHash = events[0].current_hash;
            }
        } catch (error) {
            console.error('Failed to initialize provenance tracker:', error);
        }
    }

    async createProvenanceRecord(eventType, triggerData, imageData) {
        try {
            const eventId = uuidv4();
            const timestamp = new Date().toISOString();
            const rtcTimestamp = await this.rtc.getPreciseTimestamp();

            // Create image hash
            const imageHash = this.calculateImageHash(imageData);

            // Create event data for signing
            const eventData = {
                eventId,
                timestamp,
                rtcTimestamp: rtcTimestamp.iso,
                eventType,
                triggerData,
                imageHash,
                previousHash: this.lastHash
            };

            // Sign the event data
            const dataToSign = JSON.stringify(eventData);
            const signatureInfo = await this.crypto.signData(dataToSign);

            // Create current hash for the chain
            const currentHash = this.calculateEventHash(eventData, signatureInfo.signature);

            // Store in database
            const dbRecord = {
                eventId,
                timestamp,
                rtcTimestamp: rtcTimestamp.iso,
                eventType,
                triggerData,
                imagePath: imageData.filepath,
                imageHash,
                signature: signatureInfo.signature,
                signatureInfo,
                verificationStatus: true
            };

            await this.db.logEvent(dbRecord);
            await this.db.addToProvenanceChain(eventId, this.lastHash, currentHash);

            // Update last hash for next event
            this.lastHash = currentHash;

            console.log(`Provenance record created: ${eventId}`);

            return {
                eventId,
                currentHash,
                signed: true,
                ...dbRecord
            };

        } catch (error) {
            console.error('Failed to create provenance record:', error);
            return await this.createUnsignedRecord(eventType, triggerData, imageData);
        }
    }

    async createUnsignedRecord(eventType, triggerData, imageData) {
        try {
            const eventId = uuidv4();
            const timestamp = new Date().toISOString();
            const rtcTimestamp = await this.rtc.getPreciseTimestamp();

            // Create image hash
            const imageHash = this.calculateImageHash(imageData);

            // Create event data without signing
            const eventData = {
                eventId,
                timestamp,
                rtcTimestamp: rtcTimestamp.iso,
                eventType,
                triggerData,
                imageHash,
                previousHash: this.lastHash
            };

            // Create current hash for the chain (without signature)
            const currentHash = this.calculateEventHash(eventData, null);

            // Store in database
            const dbRecord = {
                eventId,
                timestamp,
                rtcTimestamp: rtcTimestamp.iso,
                eventType,
                triggerData,
                imagePath: imageData.filepath,
                imageHash,
                signature: null,
                signatureInfo: { signed: false, reason: 'Crypto device unavailable' },
                verificationStatus: false
            };

            await this.db.logEvent(dbRecord);
            await this.db.addToProvenanceChain(eventId, this.lastHash, currentHash);

            // Update last hash for next event
            this.lastHash = currentHash;

            console.log(`Unsigned record created: ${eventId}`);

            return {
                eventId,
                currentHash,
                signed: false,
                ...dbRecord
            };

        } catch (error) {
            console.error('Failed to create unsigned record:', error);
            throw error;
        }
    }

    calculateImageHash(imageData) {
        // Hash the base64 image data for integrity verification
        return crypto.createHash('sha256')
            .update(imageData.base64Data)
            .digest('hex');
    }

    calculateEventHash(eventData, signature) {
        // Create a hash that includes all event data and signature
        const hashInput = JSON.stringify({
            ...eventData,
            signature: signature || 'unsigned'
        });

        return crypto.createHash('sha256')
            .update(hashInput)
            .digest('hex');
    }

    async verifyEvent(eventId) {
        try {
            const event = await this.db.getEventById(eventId);
            if (!event) {
                return { valid: false, reason: 'Event not found' };
            }

            if (!event.signature) {
                return { valid: false, reason: 'Event not signed', event };
            }

            // Reconstruct the original data that was signed
            const originalData = {
                eventId: event.event_id,
                timestamp: event.timestamp,
                rtcTimestamp: event.rtc_timestamp,
                eventType: event.event_type,
                triggerData: event.trigger_data,
                imageHash: event.image_hash,
                previousHash: event.previous_hash
            };

            const dataToVerify = JSON.stringify(originalData);
            const isValid = await this.crypto.verifySignature(dataToVerify, event.signature_info);

            return {
                valid: isValid,
                event,
                signatureInfo: event.signature_info
            };

        } catch (error) {
            console.error('Failed to verify event:', error);
            return { valid: false, reason: 'Verification failed', error: error.message };
        }
    }

    async getProvenanceChainStatus() {
        try {
            const chainStatus = await this.db.verifyProvenanceChain();
            const stats = await this.db.getStatistics();

            return {
                chainValid: chainStatus.isValid,
                totalEvents: stats.total_events,
                signedEvents: stats.signed_events,
                verifiedEvents: stats.verified_events,
                signatureRate: stats.total_events > 0 ? (stats.signed_events / stats.total_events * 100).toFixed(1) : 0,
                issues: chainStatus.issues
            };
        } catch (error) {
            console.error('Failed to get chain status:', error);
            return { chainValid: false, error: error.message };
        }
    }
}

module.exports = ProvenanceTracker;