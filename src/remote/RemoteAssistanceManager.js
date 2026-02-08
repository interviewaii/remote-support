const { ipcRenderer } = require('electron');
const io = require('socket.io-client');
const Peer = require('simple-peer');

/**
 * RemoteAssistanceManager - Handles remote desktop assistance functionality
 * Allows a helper to view and control this computer after receiving a session ID
 */
class RemoteAssistanceManager {
    constructor(signalingServerUrl = 'https://remote-support-g88b.onrender.com') {
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

        // Validate dependencies
        console.log('RemoteAssistanceManager: Checking dependencies...');
        console.log('RemoteAssistanceManager: io available?', typeof io);
        console.log('RemoteAssistanceManager: Peer available?', typeof Peer);
        console.log('RemoteAssistanceManager: ipcRenderer available?', typeof ipcRenderer);
    }

    /**
     * Initialize and start a new remote assistance session
     * @returns {Promise<string>} Session ID
     */
    async startSession() {
        console.log('RemoteAssistanceManager: Starting session initialization...');
        console.log(`RemoteAssistanceManager: Using signaling server: ${this.signalingServerUrl}`);

        try {
            // Create session on signaling server
            console.log('RemoteAssistanceManager: Fetching session creation API...');
            const response = await fetch(`${this.signalingServerUrl}/api/session/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            console.log(`RemoteAssistanceManager: Server response status: ${response.status}`);

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`RemoteAssistanceManager: Server error response: ${errorText}`);
                throw new Error(`Failed to create session: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            console.log('RemoteAssistanceManager: Session data received:', data);

            const { sessionId, expiresIn } = data;
            this.sessionId = sessionId;

            // Connect to signaling server via WebSocket
            console.log('RemoteAssistanceManager: Connecting to WebSocket...');
            await this.connectToSignalingServer();
            console.log('RemoteAssistanceManager: WebSocket connected');

            // Capture screen stream
            console.log('RemoteAssistanceManager: Starting screen capture...');
            await this.startScreenCapture();
            console.log('RemoteAssistanceManager: Screen capture started');

            this.isActive = true;

            if (this.onSessionCreated) {
                this.onSessionCreated({ sessionId, expiresIn });
            }

            console.log(`RemoteAssistanceManager: Session FULLY started: ${sessionId}`);
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
            console.log('RemoteAssistanceManager: Attempting WebSocket connection...');
            console.log('RemoteAssistanceManager: Server URL:', this.signalingServerUrl);

            // Set a timeout for the connection (60 seconds for Render cold start)
            const connectionTimeout = setTimeout(() => {
                console.error('RemoteAssistanceManager: Connection timeout after 60 seconds');
                if (this.socket) {
                    console.log('RemoteAssistanceManager: Disconnecting socket due to timeout');
                    this.socket.disconnect();
                }
                reject(new Error('Connection timeout - Server may be waking up (Render free tier). Please try again in 30 seconds.'));
            }, 60000); // 60 seconds

            try {
                this.socket = io(this.signalingServerUrl, {
                    transports: ['websocket', 'polling'], // Try both transports
                    reconnection: true,
                    reconnectionAttempts: 5,
                    reconnectionDelay: 1000,
                    timeout: 60000, // 60 second timeout
                    forceNew: true,
                    autoConnect: true
                });

                console.log('RemoteAssistanceManager: Socket.IO client created');

                this.socket.on('connect', () => {
                    console.log('RemoteAssistanceManager: Socket connected! Socket ID:', this.socket.id);
                    clearTimeout(connectionTimeout);

                    // Join as sender
                    console.log('RemoteAssistanceManager: Emitting join-as-sender with sessionId:', this.sessionId);
                    this.socket.emit('join-as-sender', { sessionId: this.sessionId });
                });

                this.socket.on('joined-as-sender', () => {
                    console.log('RemoteAssistanceManager: Successfully joined as sender');
                    clearTimeout(connectionTimeout);
                    resolve();
                });

                this.socket.on('connect_error', (error) => {
                    console.error('RemoteAssistanceManager: Connection error:', error);
                    console.error('RemoteAssistanceManager: Error message:', error.message);
                    console.error('RemoteAssistanceManager: Error type:', error.type);
                    clearTimeout(connectionTimeout);
                    reject(new Error(`Connection failed: ${error.message}`));
                });

                this.socket.on('connect_timeout', () => {
                    console.error('RemoteAssistanceManager: Connection timeout event fired');
                    clearTimeout(connectionTimeout);
                    reject(new Error('Connection timeout'));
                });

                this.socket.on('error', (error) => {
                    console.error('RemoteAssistanceManager: Socket error:', error);
                    clearTimeout(connectionTimeout);
                    reject(error);
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
                    console.log('RemoteAssistanceManager: Received control event:', event.type, event);
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
            } catch (error) {
                console.error('RemoteAssistanceManager: Error creating socket:', error);
                clearTimeout(connectionTimeout);
                reject(error);
            }
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
        console.log('RemoteAssistanceManager: Handling control event, sending to main process:', event);
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

export default RemoteAssistanceManager;
