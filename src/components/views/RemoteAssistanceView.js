import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';

/**
 * RemoteAssistanceView - UI component for remote desktop assistance
 * Allows users to start sessions and manage remote connections
 */
class RemoteAssistanceView extends LitElement {
    static styles = css`
        * {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        .container {
            padding: 32px;
            color: #1a202c;
        }

        .header {
            margin-bottom: 32px;
        }

        .header h1 {
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 8px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .header p {
            color: #718096;
            font-size: 14px;
        }

        .card {
            background: white;
            border-radius: 16px;
            padding: 24px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
            margin-bottom: 24px;
        }

        .status-indicator {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 16px;
            background: #f7fafc;
            border-radius: 12px;
            margin-bottom: 24px;
        }

        .status-dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: #cbd5e0;
        }

        .status-dot.active {
            background: #48bb78;
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }

        .session-info {
            text-align: center;
            padding: 32px;
        }

        .session-id-display {
            font-size: 48px;
            font-weight: 700;
            letter-spacing: 8px;
            color: #667eea;
            margin: 24px 0;
            font-family: 'Courier New', monospace;
            user-select: all;
            cursor: pointer;
        }

        .session-id-display:hover {
            color: #764ba2;
        }

        .btn {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 14px 32px;
            font-size: 16px;
            font-weight: 600;
            border-radius: 10px;
            cursor: pointer;
            transition: all 0.2s;
            display: inline-block;
        }

        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
        }

        .btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
        }

        .btn-danger {
            background: #e53e3e;
        }

        .btn-danger:hover {
            background: #c53030;
            box-shadow: 0 8px 20px rgba(229, 62, 62, 0.4);
        }

        .btn-secondary {
            background: #edf2f7;
            color: #2d3748;
        }

        .btn-secondary:hover {
            background: #e2e8f0;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .viewers-list {
            margin-top: 24px;
        }

        .viewer-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px;
            background: #f7fafc;
            border-radius: 8px;
            margin-bottom: 12px;
        }

        .viewer-info {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .viewer-avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 700;
        }

        .settings-section {
            margin-top: 32px;
        }

        .setting-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 0;
            border-bottom: 1px solid #e2e8f0;
        }

        .setting-item:last-child {
            border-bottom: none;
        }

        .toggle {
            position: relative;
            width: 50px;
            height: 28px;
            background: #cbd5e0;
            border-radius: 14px;
            cursor: pointer;
            transition: background 0.2s;
        }

        .toggle.active {
            background: #48bb78;
        }

        .toggle-handle {
            position: absolute;
            top: 3px;
            left: 3px;
            width: 22px;
            height: 22px;
            background: white;
            border-radius: 50%;
            transition: transform 0.2s;
        }

        .toggle.active .toggle-handle {
            transform: translateX(22px);
        }

        .instructions {
            background: #edf2f7;
            padding: 20px;
            border-radius: 12px;
            margin-top: 24px;
        }

        .instructions h3 {
            font-size: 16px;
            margin-bottom: 12px;
            color: #2d3748;
        }

        .instructions ol {
            padding-left: 20px;
        }

        .instructions li {
            margin-bottom: 8px;
            color: #4a5568;
            font-size: 14px;
        }

        .copy-hint {
            font-size: 14px;
            color: #718096;
            margin-top: 8px;
        }

        .empty-state {
            text-align: center;
            padding: 48px 24px;
            color: #718096;
        }

        .empty-state h2 {
            font-size: 20px;
            margin-bottom: 12px;
            color: #2d3748;
        }
    `;

    static properties = {
        isSessionActive: { type: Boolean },
        sessionId: { type: String },
        connectedViewers: { type: Array },
        isEnabled: { type: Boolean },
        signalingServerUrl: { type: String }
    };

    constructor() {
        super();
        this.isSessionActive = false;
        this.sessionId = null;
        this.connectedViewers = [];
        this.isEnabled = this.loadSetting('remoteAssistanceEnabled', false);
        this.signalingServerUrl = this.loadSetting('signalingServerUrl', 'https://remote-support-g88b.onrender.com');
        this.manager = null;
    }

    connectedCallback() {
        super.connectedCallback();
        this.loadSettings();
    }

    loadSetting(key, defaultValue) {
        try {
            const value = localStorage.getItem(key);
            return value !== null ? JSON.parse(value) : defaultValue;
        } catch {
            return defaultValue;
        }
    }

    saveSetting(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    loadSettings() {
        this.isEnabled = this.loadSetting('remoteAssistanceEnabled', false);
        this.signalingServerUrl = this.loadSetting('signalingServerUrl', 'https://remote-support-g88b.onrender.com');
    }

    toggleEnabled(e) {
        this.isEnabled = !this.isEnabled;
        this.saveSetting('remoteAssistanceEnabled', this.isEnabled);

        if (!this.isEnabled && this.isSessionActive) {
            this.stopSession();
        }
    }

    async startSession() {
        console.log('RemoteAssistanceView: startSession() called');
        console.log('RemoteAssistanceView: isEnabled =', this.isEnabled);

        if (!this.isEnabled) {
            alert('Please enable Remote Assistance first');
            return;
        }

        console.log('RemoteAssistanceView: Starting dynamic import...');

        try {
            // Dynamically import the manager
            const importedModule = await import('../../remote/RemoteAssistanceManager.js');
            console.log('RemoteAssistanceView: Imported module:', importedModule);

            let RemoteAssistanceManager = importedModule.default;

            if (typeof RemoteAssistanceManager !== 'function') {
                console.warn('RemoteAssistanceView: default export is not a constructor, trying module directly or named export');
                if (typeof importedModule === 'function') {
                    RemoteAssistanceManager = importedModule;
                } else if (importedModule.RemoteAssistanceManager) {
                    RemoteAssistanceManager = importedModule.RemoteAssistanceManager;
                }
            }

            console.log('RemoteAssistanceView: Resolved RemoteAssistanceManager:', RemoteAssistanceManager);

            if (typeof RemoteAssistanceManager !== 'function') {
                throw new Error(`RemoteAssistanceManager is not a constructor (got ${typeof RemoteAssistanceManager})`);
            }

            this.manager = new RemoteAssistanceManager(this.signalingServerUrl);

            // Setup callbacks
            this.manager.onSessionCreated = ({ sessionId }) => {
                this.sessionId = sessionId;
                this.isSessionActive = true;
                this.requestUpdate();
            };

            this.manager.onViewerJoined = ({ viewerId, viewerName, timestamp }) => {
                this.connectedViewers = [
                    ...this.connectedViewers,
                    { viewerId, viewerName, timestamp }
                ];
                this.requestUpdate();

                this.showNotification(`${viewerName} connected`, 'success');
            };

            this.manager.onViewerLeft = ({ viewerId, viewerName }) => {
                this.connectedViewers = this.connectedViewers.filter(v => v.viewerId !== viewerId);
                this.requestUpdate();

                this.showNotification(`${viewerName} disconnected`, 'info');
            };

            this.manager.onDisconnected = () => {
                this.stopSession();
            };

            this.manager.onError = (error) => {
                this.showNotification(`Error: ${error.message}`, 'error');
            };

            // Start the session
            await this.manager.startSession();

        } catch (error) {
            console.error('Error starting session:', error);
            const errorMessage = `Failed to start session: ${error.message}\n\nCheck your internet connection and ensure the signaling server is running.`;
            this.showNotification(errorMessage, 'error');
            alert(errorMessage); // Force show error to user
        }
    }

    stopSession() {
        if (this.manager) {
            this.manager.stopSession();
            this.manager = null;
        }

        this.isSessionActive = false;
        this.sessionId = null;
        this.connectedViewers = [];
        this.requestUpdate();
    }

    copySessionId() {
        if (this.sessionId) {
            navigator.clipboard.writeText(this.sessionId);
            this.showNotification('Session ID copied to clipboard!', 'success');
        }
    }

    showNotification(message, type = 'info') {
        // You can integrate with your existing notification system here
        console.log(`[${type}] ${message}`);
    }

    render() {
        return html`
            <div class="container">
                <div class="header">
                    <h1>🖥️ Remote Assistance</h1>
                    <p>Allow trusted helpers to control your screen during interviews</p>
                </div>

                <!-- Enable Toggle -->
                <div class="card">
                    <div class="setting-item">
                        <div>
                            <strong>Enable Remote Assistance</strong>
                            <p style="font-size: 13px; color: #718096; margin-top: 4px;">
                                Allow remote screen control and assistance
                            </p>
                        </div>
                        <div 
                            class="toggle ${this.isEnabled ? 'active' : ''}" 
                            @click="${this.toggleEnabled}"
                        >
                            <div class="toggle-handle"></div>
                        </div>
                    </div>
                </div>

                ${this.isEnabled ? html`
                    ${this.isSessionActive ? this.renderActiveSession() : this.renderInactive()}
                ` : html`
                    <div class="empty-state">
                        <h2>Remote Assistance Disabled</h2>
                        <p>Enable the toggle above to use remote assistance features</p>
                    </div>
                `}
            </div>
        `;
    }

    renderInactive() {
        return html`
            <div class="card">
                <div class="session-info">
                    <h2 style="margin-bottom: 16px;">Start Remote Assistance Session</h2>
                    <p style="color: #718096; margin-bottom: 24px;">
                        Click the button below to generate a session ID that a helper can use to connect
                    </p>
                    <button class="btn" @click="${this.startSession}">
                        🚀 Start Session
                    </button>
                </div>

                <div class="instructions">
                    <h3>📋 How it works:</h3>
                    <ol>
                        <li>Click "Start Session" to generate a unique session ID</li>
                        <li>Share the session ID with your helper (via WhatsApp, Email, etc.)</li>
                        <li>Helper opens the viewer web app and enters the session ID</li>
                        <li>Helper can see and control your screen to assist you</li>
                        <li>You can disconnect anytime or when you close the app</li>
                    </ol>
                </div>
            </div>
        `;
    }

    renderActiveSession() {
        return html`
            <!-- Status -->
            <div class="status-indicator">
                <div class="status-dot active"></div>
                <div>
                    <strong>Session Active</strong>
                    <p style="font-size: 13px; color: #718096; margin: 0;">
                        ${this.connectedViewers.length} viewer(s) connected
                    </p>
                </div>
            </div>

            <!-- Session ID Card -->
            <div class="card session-info">
                <h2 style="margin-bottom: 12px;">Session ID</h2>
                <div 
                    class="session-id-display" 
                    @click="${this.copySessionId}"
                    title="Click to copy"
                >
                    ${this.sessionId}
                </div>
                <p class="copy-hint">👆 Click to copy • Share this with your helper</p>
                
                <div style="margin-top: 32px;">
                    <button class="btn btn-danger" @click="${this.stopSession}">
                        ⛔ Stop Session
                    </button>
                </div>
            </div>

            <!-- Connected Viewers -->
            ${this.connectedViewers.length > 0 ? html`
                <div class="card">
                    <h3 style="margin-bottom: 16px;">Connected Helpers</h3>
                    <div class="viewers-list">
                        ${this.connectedViewers.map(viewer => html`
                            <div class="viewer-item">
                                <div class="viewer-info">
                                    <div class="viewer-avatar">
                                        ${viewer.viewerName.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <strong>${viewer.viewerName}</strong>
                                        <p style="font-size: 12px; color: #718096; margin: 0;">
                                            Connected ${this.formatTime(viewer.timestamp)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        `)}
                    </div>
                </div>
            ` : ''}

            <!-- Viewer Link -->
            <div class="card">
                <h3 style="margin-bottom: 12px;">Helper Instructions</h3>
                <p style="color: #718096; margin-bottom: 16px;">
                    Send this link to your helper:
                </p>
                <input 
                    type="text" 
                    readonly 
                    value="https://interviewaii.github.io/remote-support/viewer/index.html"
                    style="width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-family: monospace;"
                    @click="${(e) => e.target.select()}"
                />
            </div>
        `;
    }

    formatTime(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);

        if (minutes < 1) return 'just now';
        if (minutes === 1) return '1 minute ago';
        if (minutes < 60) return `${minutes} minutes ago`;

        const hours = Math.floor(minutes / 60);
        if (hours === 1) return '1 hour ago';
        return `${hours} hours ago`;
    }
}

customElements.define('remote-assistance-view', RemoteAssistanceView);
export { RemoteAssistanceView };
