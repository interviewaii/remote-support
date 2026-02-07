const { ipcRenderer } = require('electron');
const io = require('socket.io-client');
const Peer = require('simple-peer');

/**
 * RemoteAssistanceManager - Handles remote desktop assistance functionality
 * Allows a helper to view and control this computer after receiving a session ID
 */
class RemoteAssistanceManager {
    constructor(signalingServerUrl = 'http://localhost:3000') {
        this.signalingServerUrl = signalingServerUrl;
        this.socket = null;
        this.peer = null;
        this.sessionId = null;
        this.isActive = false;
        this.stream = null;
        this.connectedViewers = [];

        // Callbacks for UI updates
        this.onSessionCreated = null;
        this.onViewerJoined = null;
        this.onViewerLeft = null;
        this.onDisconnected = null;
        this.onError = null;
    }

    /**
     * Initialize and start a new remote assistance session
     * @returns {Promise<string>} Session ID
     */
    async startSession() {
        try {
            // Create session on signaling server
            const response = await fetch(`${this.signalingServerUrl}/api/session/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) {
                throw new Error('Failed to create session');
            }

            const { sessionId, expiresIn } = await response.json();
            this.sessionId = sessionId;

            // Connect to signaling server via WebSocket
            await this.connectToSignalingServer();

            // Capture screen stream
            await this.startScreenCapture();

            this.isActive = true;

            if (this.onSessionCreated) {
                this.onSessionCreated({ sessionId, expiresIn });
            }

            console.log(`Remote assistance session started: ${sessionId}`);
            return sessionId;

        } catch (error) {
            console.error('Error starting remote assistance:', error);
            if (this.onError) {
                this.onError(error);
            }
            throw error;
        }
    }

    /**
     * Connect to the signaling server via Socket.io
     */
    async connectToSignalingServer() {
        return new Promise((resolve, reject) => {
            this.socket = io(this.signalingServerUrl, {
                transports: ['websocket'],
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000
            });

            this.socket.on('connect', () => {
                console.log('Connected to signaling server');

                // Join as sender
                this.socket.emit('join-as-sender', { sessionId: this.sessionId });
            });

            this.socket.on('joined-as-sender', () => {
                console.log('Joined session as sender');
                resolve();
            });

            this.socket.on('viewer-joined', ({ viewerId, viewerName, timestamp }) => {
                console.log(`Viewer joined: ${viewerName} (${viewerId})`);
                this.connectedViewers.push({ viewerId, viewerName, timestamp });

                // Initiate WebRTC connection with the new viewer
                this.createPeerConnection(viewerId);

                if (this.onViewerJoined) {
                    this.onViewerJoined({ viewerId, viewerName, timestamp });
                }
            });

            this.socket.on('viewer-left', ({ viewerId, viewerName }) => {
                console.log(`Viewer left: ${viewerName}`);
                this.connectedViewers = this.connectedViewers.filter(v => v.viewerId !== viewerId);

                if (this.onViewerLeft) {
                    this.onViewerLeft({ viewerId, viewerName });
                }
            });

            this.socket.on('answer', ({ answer, from }) => {
                if (this.peer) {
                    this.peer.signal(answer);
                }
            });

            this.socket.on('ice-candidate', ({ candidate, from }) => {
                if (this.peer) {
                    this.peer.signal(candidate);
                }
            });

            this.socket.on('control-event', ({ event, from }) => {
                // Handle remote control events (mouse, keyboard)
                this.handleControlEvent(event);
            });

            this.socket.on('session-expired', () => {
                console.log('Session expired');
                this.stopSession();
            });

            this.socket.on('error', (error) => {
                console.error('Socket error:', error);
                reject(error);
            });

            this.socket.on('disconnect', () => {
                console.log('Disconnected from signaling server');
                this.stopSession();
            });
        });
    }

    /**
     * Start capturing the screen
     */
    async startScreenCapture() {
        try {
            // Request screen capture via IPC
            const sources = await ipcRenderer.invoke('get-screen-sources');

            if (!sources || sources.length === 0) {
                throw new Error('No screen sources available');
            }

            // Use the first screen (primary display)
            const primarySource = sources[0];

            // Get media stream
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                    mandatory: {
                        chromeMediaSource: 'desktop',
                        chromeMediaSourceId: primarySource.id,
                        minWidth: 1280,
                        maxWidth: 1920,
                        minHeight: 720,
                        maxHeight: 1080,
                        frameRate: { ideal: 15, max: 30 } // Limit framerate to reduce bandwidth
                    }
                }
            });

            console.log('Screen capture started');

        } catch (error) {
            console.error('Error capturing screen:', error);
            throw error;
        }
    }

    /**
     * Create WebRTC peer connection with a viewer
     * @param {string} viewerId - The viewer's socket ID
     */
    createPeerConnection(viewerId) {
        this.peer = new Peer({
            initiator: true, // Sender initiates the connection
            stream: this.stream,
            trickle: true,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            }
        });

        this.peer.on('signal', (signal) => {
            // Send WebRTC signal to viewer via signaling server
            this.socket.emit('offer', {
                sessionId: this.sessionId,
                offer: signal,
                target: viewerId
            });
        });

        this.peer.on('connect', () => {
            console.log(`WebRTC connection established with viewer ${viewerId}`);
        });

        this.peer.on('error', (error) => {
            console.error('Peer connection error:', error);
        });

        this.peer.on('close', () => {
            console.log(`Peer connection closed with viewer ${viewerId}`);
        });
    }

    /**
     * Handle remote control events from viewer
     * @param {Object} event - Control event (mouse/keyboard)
     */
    handleControlEvent(event) {
        // Send to main process for input simulation
        ipcRenderer.send('simulate-input', event);
    }

    /**
     * Stop the remote assistance session
     */
    stopSession() {
        console.log('Stopping remote assistance session');

        this.isActive = false;

        // Stop screen capture
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        // Close peer connection
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }

        // Disconnect from signaling server
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }

        this.sessionId = null;
        this.connectedViewers = [];

        if (this.onDisconnected) {
            this.onDisconnected();
        }
    }

    /**
     * Get current session status
     * @returns {Object} Session status
     */
    getStatus() {
        return {
            isActive: this.isActive,
            sessionId: this.sessionId,
            viewerCount: this.connectedViewers.length,
            viewers: this.connectedViewers
        };
    }

    /**
     * Disconnect a specific viewer
     * @param {string} viewerId - Viewer's socket ID
     */
    disconnectViewer(viewerId) {
        // TODO: Implement individual viewer disconnect
        console.log(`Disconnecting viewer: ${viewerId}`);
    }
}

module.exports = RemoteAssistanceManager;
