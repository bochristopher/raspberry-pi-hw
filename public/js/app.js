class SecureCameraApp {
    constructor() {
        this.ws = null;
        this.reconnectInterval = null;
        this.events = [];
        this.signedExample = null;
        this.unsignedExample = null;

        this.init();
    }

    init() {
        this.setupWebSocket();
        this.setupEventListeners();
        this.loadEvents();
        this.loadProvenanceStats();
    }

    setupWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;

        try {
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                console.log('WebSocket connected');
                this.updateConnectionStatus(true);
                if (this.reconnectInterval) {
                    clearInterval(this.reconnectInterval);
                    this.reconnectInterval = null;
                }
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleWebSocketMessage(data);
                } catch (error) {
                    console.error('Failed to parse WebSocket message:', error);
                }
            };

            this.ws.onclose = () => {
                console.log('WebSocket disconnected');
                this.updateConnectionStatus(false);
                this.scheduleReconnect();
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.updateConnectionStatus(false);
            };
        } catch (error) {
            console.error('Failed to create WebSocket:', error);
            this.updateConnectionStatus(false);
            this.scheduleReconnect();
        }
    }

    scheduleReconnect() {
        if (!this.reconnectInterval) {
            this.reconnectInterval = setInterval(() => {
                console.log('Attempting to reconnect...');
                this.setupWebSocket();
            }, 5000);
        }
    }

    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'status':
                this.updateSystemStatus(data.data);
                break;
            case 'new_event':
                this.handleNewEvent(data.data);
                break;
            case 'events':
                this.updateEventLog(data.data);
                break;
            case 'verification':
                this.handleVerificationResult(data.data);
                break;
        }
    }

    updateConnectionStatus(connected) {
        const statusDot = document.querySelector('.status-dot');
        const statusText = document.getElementById('status-text');

        if (connected) {
            statusDot.classList.add('connected');
            statusText.textContent = 'Connected';
        } else {
            statusDot.classList.remove('connected');
            statusText.textContent = 'Disconnected';
        }
    }

    updateSystemStatus(status) {
        // Update hardware status
        this.updateHardwareStatus('accel-status', status.accelerometer?.initialized);
        this.updateHardwareStatus('camera-status', status.camera?.initialized);
        this.updateHardwareStatus('crypto-status', status.crypto?.initialized);
        this.updateHardwareStatus('rtc-status', status.rtc?.initialized);
    }

    updateHardwareStatus(elementId, isOnline) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = isOnline ? 'Online' : 'Offline';
            element.className = `hw-status ${isOnline ? 'online' : 'offline'}`;
        }
    }

    handleNewEvent(eventData) {
        // Update latest image
        if (eventData.imageData) {
            this.updateLatestImage(eventData.imageData);
        }

        // Add to events list
        this.events.unshift(eventData);
        this.updateEventLog(this.events.slice(0, 20));

        // Update comparison examples
        if (eventData.signed) {
            this.signedExample = eventData;
        } else {
            this.unsignedExample = eventData;
        }
        this.updateComparisonExamples();

        // Refresh stats
        this.loadProvenanceStats();
    }

    updateLatestImage(imageData) {
        const container = document.getElementById('latest-image');
        container.innerHTML = `<img src="${imageData}" alt="Latest capture" />`;
    }

    setupEventListeners() {
        // Manual capture button
        document.getElementById('manual-capture').addEventListener('click', () => {
            this.triggerManualCapture();
        });

        // Refresh events button
        document.getElementById('refresh-events').addEventListener('click', () => {
            this.loadEvents();
        });

        // Verify all button
        document.getElementById('verify-all').addEventListener('click', () => {
            this.verifyAllEvents();
        });
    }

    triggerManualCapture() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'manual_capture' }));
        } else {
            // Fallback to API
            fetch('/api/capture', { method: 'POST' })
                .then(response => response.json())
                .then(data => {
                    console.log('Manual capture completed:', data);
                    this.loadEvents();
                })
                .catch(error => {
                    console.error('Manual capture failed:', error);
                });
        }
    }

    async loadEvents() {
        try {
            const response = await fetch('/api/events?limit=20');
            const events = await response.json();
            this.events = events;
            this.updateEventLog(events);
            this.updateComparisonExamples();
        } catch (error) {
            console.error('Failed to load events:', error);
        }
    }

    async loadProvenanceStats() {
        try {
            const response = await fetch('/api/provenance/status');
            const stats = await response.json();
            this.updateProvenanceStats(stats);
        } catch (error) {
            console.error('Failed to load provenance stats:', error);
        }
    }

    updateProvenanceStats(stats) {
        document.getElementById('total-events').textContent = stats.totalEvents || 0;
        document.getElementById('signed-events').textContent = stats.signedEvents || 0;
        document.getElementById('signature-rate').textContent = stats.signatureRate + '%' || '0%';

        const chainStatus = document.getElementById('chain-status');
        chainStatus.textContent = stats.chainValid ? 'Valid' : 'Broken';
        chainStatus.style.color = stats.chainValid ? '#27ae60' : '#e74c3c';
    }

    updateEventLog(events) {
        const logContainer = document.getElementById('event-log');

        if (events.length === 0) {
            logContainer.innerHTML = '<div class="loading">No events recorded yet</div>';
            return;
        }

        logContainer.innerHTML = events.map(event => this.createEventElement(event)).join('');
    }

    createEventElement(event) {
        const signedClass = event.signature ? 'signed' : 'unsigned';
        const signedBadge = event.signature ?
            '<span class="signature-badge signed">✓ Signed</span>' :
            '<span class="signature-badge unsigned">✗ Unsigned</span>';

        const triggerData = typeof event.trigger_data === 'string' ?
            JSON.parse(event.trigger_data) : event.trigger_data;

        return `
            <div class="event-item ${signedClass}">
                <div class="event-header">
                    <span class="event-id">${event.event_id}</span>
                    <span class="event-timestamp">${new Date(event.timestamp).toLocaleString()}</span>
                </div>
                <div class="event-details">
                    <div class="event-detail">
                        <strong>Type:</strong>
                        ${event.event_type}
                    </div>
                    <div class="event-detail">
                        <strong>Signature:</strong>
                        ${signedBadge}
                    </div>
                    <div class="event-detail">
                        <strong>Trigger:</strong>
                        ${triggerData.manual ? 'Manual' : 'Motion Detection'}
                    </div>
                    <div class="event-detail">
                        <strong>RTC:</strong>
                        ${event.rtc_timestamp ? new Date(event.rtc_timestamp).toLocaleString() : 'N/A'}
                    </div>
                </div>
            </div>
        `;
    }

    updateComparisonExamples() {
        // Find examples of signed and unsigned data
        const signedEvent = this.events.find(e => e.signature) || this.signedExample;
        const unsignedEvent = this.events.find(e => !e.signature) || this.unsignedExample;

        // Update signed example
        if (signedEvent) {
            const signedContainer = document.getElementById('signed-example');
            const signatureHash = signedEvent.signature ?
                signedEvent.signature.substring(0, 32) + '...' :
                'Sample: a7b8c9d0e1f2g3h4...';

            signedContainer.querySelector('.signature-hash').textContent = signatureHash;

            // Add visual indicators
            const signedSide = signedContainer.closest('.comparison-side');
            signedSide.classList.add('signed');
        }

        // Update unsigned example
        if (unsignedEvent) {
            const unsignedSide = document.querySelector('.comparison-side:last-child');
            unsignedSide.classList.add('unsigned');
        }
    }

    async verifyAllEvents() {
        const button = document.getElementById('verify-all');
        const originalText = button.textContent;
        button.textContent = 'Verifying...';
        button.disabled = true;

        try {
            for (const event of this.events.slice(0, 5)) { // Verify first 5 events
                if (event.signature) {
                    const response = await fetch(`/api/verify/${event.event_id}`, {
                        method: 'POST'
                    });
                    const result = await response.json();
                    console.log(`Verification for ${event.event_id}:`, result);
                }
            }
            console.log('Verification completed');
        } catch (error) {
            console.error('Verification failed:', error);
        } finally {
            button.textContent = originalText;
            button.disabled = false;
        }
    }

    handleVerificationResult(result) {
        console.log('Verification result:', result);
        // You could update the UI to show verification results here
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new SecureCameraApp();
});