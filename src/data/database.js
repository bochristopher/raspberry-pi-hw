const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;

class ProvenanceDatabase {
    constructor(dbPath = 'data/provenance.db') {
        this.dbPath = dbPath;
        this.db = null;
    }

    async initialize() {
        try {
            // Ensure directory exists
            const dir = path.dirname(this.dbPath);
            await fs.mkdir(dir, { recursive: true });

            this.db = new sqlite3.Database(this.dbPath);

            await this.createTables();
            console.log('Provenance database initialized');
        } catch (error) {
            console.error('Failed to initialize database:', error);
            throw error;
        }
    }

    createTables() {
        return new Promise((resolve, reject) => {
            const createEventTable = `
                CREATE TABLE IF NOT EXISTS events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    event_id TEXT UNIQUE NOT NULL,
                    timestamp TEXT NOT NULL,
                    rtc_timestamp TEXT,
                    event_type TEXT NOT NULL,
                    trigger_data TEXT,
                    image_path TEXT,
                    image_hash TEXT,
                    signature TEXT,
                    signature_info TEXT,
                    verification_status INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `;

            const createProvenanceTable = `
                CREATE TABLE IF NOT EXISTS provenance_chain (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    event_id TEXT NOT NULL,
                    previous_hash TEXT,
                    current_hash TEXT NOT NULL,
                    chain_position INTEGER NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (event_id) REFERENCES events (event_id)
                )
            `;

            this.db.serialize(() => {
                this.db.run(createEventTable);
                this.db.run(createProvenanceTable, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        });
    }

    async logEvent(eventData) {
        return new Promise((resolve, reject) => {
            const {
                eventId,
                timestamp,
                rtcTimestamp,
                eventType,
                triggerData,
                imagePath,
                imageHash,
                signature,
                signatureInfo,
                verificationStatus
            } = eventData;

            const sql = `
                INSERT INTO events (
                    event_id, timestamp, rtc_timestamp, event_type,
                    trigger_data, image_path, image_hash, signature,
                    signature_info, verification_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            this.db.run(sql, [
                eventId,
                timestamp,
                rtcTimestamp,
                eventType,
                JSON.stringify(triggerData),
                imagePath,
                imageHash,
                signature,
                JSON.stringify(signatureInfo),
                verificationStatus ? 1 : 0
            ], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    }

    async addToProvenanceChain(eventId, previousHash, currentHash) {
        return new Promise((resolve, reject) => {
            // Get chain position
            this.db.get(
                'SELECT MAX(chain_position) as max_pos FROM provenance_chain',
                (err, row) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    const position = (row.max_pos || 0) + 1;

                    const sql = `
                        INSERT INTO provenance_chain (
                            event_id, previous_hash, current_hash, chain_position
                        ) VALUES (?, ?, ?, ?)
                    `;

                    this.db.run(sql, [eventId, previousHash, currentHash, position], function(err) {
                        if (err) {
                            reject(err);
                        } else {
                            resolve({ id: this.lastID, position });
                        }
                    });
                }
            );
        });
    }

    async getEvents(limit = 50, offset = 0) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT e.*, p.current_hash, p.chain_position
                FROM events e
                LEFT JOIN provenance_chain p ON e.event_id = p.event_id
                ORDER BY e.created_at DESC
                LIMIT ? OFFSET ?
            `;

            this.db.all(sql, [limit, offset], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows.map(row => ({
                        ...row,
                        trigger_data: JSON.parse(row.trigger_data || '{}'),
                        signature_info: JSON.parse(row.signature_info || '{}'),
                        verification_status: Boolean(row.verification_status)
                    })));
                }
            });
        });
    }

    async getEventById(eventId) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT e.*, p.current_hash, p.previous_hash, p.chain_position
                FROM events e
                LEFT JOIN provenance_chain p ON e.event_id = p.event_id
                WHERE e.event_id = ?
            `;

            this.db.get(sql, [eventId], (err, row) => {
                if (err) {
                    reject(err);
                } else if (row) {
                    resolve({
                        ...row,
                        trigger_data: JSON.parse(row.trigger_data || '{}'),
                        signature_info: JSON.parse(row.signature_info || '{}'),
                        verification_status: Boolean(row.verification_status)
                    });
                } else {
                    resolve(null);
                }
            });
        });
    }

    async verifyProvenanceChain() {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT * FROM provenance_chain
                ORDER BY chain_position ASC
            `;

            this.db.all(sql, (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }

                let isValid = true;
                const issues = [];

                for (let i = 1; i < rows.length; i++) {
                    if (rows[i].previous_hash !== rows[i - 1].current_hash) {
                        isValid = false;
                        issues.push({
                            position: rows[i].chain_position,
                            issue: 'Hash chain broken',
                            expected: rows[i - 1].current_hash,
                            actual: rows[i].previous_hash
                        });
                    }
                }

                resolve({
                    isValid,
                    totalEvents: rows.length,
                    issues
                });
            });
        });
    }

    async getStatistics() {
        return new Promise((resolve, reject) => {
            const queries = [
                'SELECT COUNT(*) as total_events FROM events',
                'SELECT COUNT(*) as signed_events FROM events WHERE signature IS NOT NULL',
                'SELECT COUNT(*) as verified_events FROM events WHERE verification_status = 1'
            ];

            let results = {};
            let completed = 0;

            queries.forEach((query, index) => {
                this.db.get(query, (err, row) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    const keys = ['total_events', 'signed_events', 'verified_events'];
                    results[keys[index]] = Object.values(row)[0];

                    completed++;
                    if (completed === queries.length) {
                        resolve(results);
                    }
                });
            });
        });
    }

    stop() {
        if (this.db) {
            this.db.close();
        }
    }
}

module.exports = ProvenanceDatabase;