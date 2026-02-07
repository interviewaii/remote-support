/**
 * Remote Assistance Viewer - Client-side JavaScript
 * Connects to sender's screen and sends control events
 */

// ⚠️ IMPORTANT: Update this URL after deploying your signaling server to Render.com
// Example: https://remote-support-signaling.onrender.com
const SIGNALING_SERVER_URL = 'https://remote-support-g88b.onrender.com'; // Production URL


class RemoteViewer {
    constructor() {
        this.socket = null;
        this.peer = null;
        this.sessionId = null;
        this.isConnected = false;

        // DOM elements
        this.sessionIdInput = document.getElementById('sessionIdInput');
        this.connectBtn = document.getElementById('connectBtn');
        this.disconnectBtn = document.getElementById('disconnectBtn');
        this.remoteVideo = document.getElementById('remoteVideo');
        this.connectSection = document.getElementById('connectSection');
        this.viewerSection = document.getElementById('viewerSection');
        this.loadingIndicator = document.getElementById('loadingIndicator');
        this.errorMessage = document.getElementById('errorMessage');
        this.statusText = document.getElementById('statusText');

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Connect button
        this.connectBtn.addEventListener('click', () => this.connect());

        // Enter key on session ID input
        this.sessionIdInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.connect();
            }
        });

        // Disconnect button
        this.disconnectBtn.addEventListener('click', () => this.disconnect());

        // Auto-format session ID input
        this.sessionIdInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        });
    }

    showError(message) {
        this.errorMessage.textContent = message;
        this.errorMessage.classList.add('show');
        setTimeout(() => {
            this.errorMessage.classList.remove('show');
        }, 5000);
    }

    async connect() {
        const sessionId = this.sessionIdInput.value.trim();

        if (!sessionId || sessionId.length !== 8) {
            this.showError('Please enter a valid 8-character session ID');
            return;
        }

        this.sessionId = sessionId;
        this.connectBtn.disabled = true;
        this.connectBtn.textContent = 'Connecting...';

        try {
            // Connect to signaling server
            await this.connectToSignalingServer();

            // Show viewer section
            this.connectSection.classList.add('hidden');
            this.viewerSection.classList.add('active');

        } catch (error) {
            console.error('Connection error:', error);
            this.showError(`Connection failed: ${error.message}`);
            this.connectBtn.disabled = false;
            this.connectBtn.textContent = 'Connect';
        }
    }

    connectToSignalingServer() {
        return new Promise((resolve, reject) => {
            console.log('Viewer: Connecting to signaling server:', SIGNALING_SERVER_URL);

            const connectionTimeout = setTimeout(() => {
                if (!this.isConnected) {
                    console.error('Viewer: Connection timeout after 60 seconds');
                    if (this.socket) {
                        this.socket.disconnect();
                    }
                    reject(new Error('Connection timeout - Server may be waking up. Please try again in 30 seconds.'));
                }
            }, 60000); // 60 seconds to match the app

            this.socket = io(SIGNALING_SERVER_URL, {
                transports: ['websocket', 'polling'], // Try both transports
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000,
                timeout: 60000 // 60 second timeout
            });

            console.log('Viewer: Socket.IO client created');

            this.socket.on('connect', () => {
                console.log('Viewer: Connected to signaling server! Socket ID:', this.socket.id);
                clearTimeout(connectionTimeout);

                // Join session as viewer
                const viewerName = prompt('Enter your name (optional):') || 'Anonymous Viewer';
                console.log('Viewer: Joining session', this.sessionId, 'as', viewerName);

                this.socket.emit('join-as-viewer', {
                    sessionId: this.sessionId,
                    viewerName: viewerName
                });
            });

            this.socket.on('joined-as-viewer', () => {
                console.log('Viewer: Successfully joined session as viewer');
                this.statusText.textContent = `Connected to session: ${this.sessionId}`;
                this.isConnected = true;
                clearTimeout(connectionTimeout);
                resolve();
            });

            this.socket.on('offer', ({ offer, from }) => {
                console.log('Viewer: Received WebRTC offer from', from);
                this.handleOffer(offer, from);
            });

            this.socket.on('ice-candidate', ({ candidate, from }) => {
                if (this.peer) {
                    this.peer.signal(candidate);
                }
            });

            this.socket.on('sender-disconnected', () => {
                this.showError('The sender has disconnected');
                this.disconnect();
            });

            this.socket.on('session-expired', () => {
                this.showError('Session has expired');
                this.disconnect();
            });

            this.socket.on('error', (error) => {
                console.error('Viewer: Socket error:', error);
                clearTimeout(connectionTimeout);
                reject(new Error(error.message || 'Connection failed'));
            });

            this.socket.on('connect_error', (error) => {
                console.error('Viewer: Connection error:', error);
                clearTimeout(connectionTimeout);
                reject(new Error(`Connection failed: ${error.message}`));
            });

            this.socket.on('disconnect', () => {
                console.log('Viewer: Disconnected from signaling server');
                if (this.isConnected) {
                    this.disconnect();
                }
            });
        });
    }

    handleOffer(offer, from) {
        this.peer = new SimplePeer({
            initiator: false,
            trickle: true,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            }
        });

        this.peer.on('signal', (signal) => {
            // Send answer back to sender
            this.socket.emit('answer', {
                sessionId: this.sessionId,
                answer: signal,
                target: from
            });
        });

        this.peer.on('stream', (stream) => {
            console.log('Received remote stream');
            this.remoteVideo.srcObject = stream;
            this.loadingIndicator.style.display = 'none';
            this.isConnected = true;

            // Setup remote control
            this.setupRemoteControl();
        });

        this.peer.on('error', (error) => {
            console.error('Peer connection error:', error);
            this.showError(`Connection error: ${error.message}`);
        });

        this.peer.on('close', () => {
            console.log('Peer connection closed');
            this.disconnect();
        });

        // Signal the offer
        this.peer.signal(offer);
    }

    setupRemoteControl() {
        const video = this.remoteVideo;

        // Mouse move
        video.addEventListener('mousemove', (e) => {
            const rect = video.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top) / rect.height;

            this.sendControlEvent({
                type: 'mousemove',
                x,
                y
            });
        });

        // Mouse click
        video.addEventListener('mousedown', (e) => {
            e.preventDefault();
            const button = ['left', 'middle', 'right'][e.button] || 'left';

            this.sendControlEvent({
                type: 'mousedown',
                button
            });
        });

        video.addEventListener('mouseup', (e) => {
            e.preventDefault();
            const button = ['left', 'middle', 'right'][e.button] || 'left';

            this.sendControlEvent({
                type: 'mouseup',
                button
            });
        });

        // Double click
        video.addEventListener('dblclick', (e) => {
            e.preventDefault();
            const button = ['left', 'middle', 'right'][e.button] || 'left';

            this.sendControlEvent({
                type: 'dblclick',
                button
            });
        });

        // Scroll
        video.addEventListener('wheel', (e) => {
            e.preventDefault();

            this.sendControlEvent({
                type: 'scroll',
                deltaX: e.deltaX,
                deltaY: e.deltaY
            });
        });

        // Keyboard events
        document.addEventListener('keydown', (e) => {
            if (this.isConnected && document.activeElement === document.body) {
                e.preventDefault();

                this.sendControlEvent({
                    type: 'keydown',
                    key: e.key
                });
            }
        });

        document.addEventListener('keyup', (e) => {
            if (this.isConnected && document.activeElement === document.body) {
                e.preventDefault();

                this.sendControlEvent({
                    type: 'keyup',
                    key: e.key
                });
            }
        });

        // Prevent context menu
        video.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    }

    sendControlEvent(event) {
        if (this.socket && this.isConnected) {
            this.socket.emit('control-event', {
                sessionId: this.sessionId,
                event
            });
        }
    }

    disconnect() {
        this.isConnected = false;

        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }

        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }

        // Reset UI
        this.viewerSection.classList.remove('active');
        this.connectSection.classList.remove('hidden');
        this.connectBtn.disabled = false;
        this.connectBtn.textContent = 'Connect';
        this.loadingIndicator.style.display = 'block';
        this.sessionIdInput.value = '';
        this.remoteVideo.srcObject = null;
    }
}

// Initialize viewer on page load
document.addEventListener('DOMContentLoaded', () => {
    new RemoteViewer();
});
