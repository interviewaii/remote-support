
import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';
import { AppHeader } from './AppHeader.js';
import { MainView } from '../views/MainView.js';
import { CustomizeView } from '../views/CustomizeView.js';
import { HelpView } from '../views/HelpView.js';
import { HistoryView } from '../views/HistoryView.js';
import { AssistantView } from '../views/AssistantView.js';
import { OnboardingView } from '../views/OnboardingView.js';
import { AdvancedView } from '../views/AdvancedView.js';
import { PaymentAlert } from '../views/PaymentAlert.js';
import { isActivationValid, activateWithDeviceLock } from '../../utils/deviceId.js';
import { isLicenseValid, activateLicense, canStartInterview, canGetResponse, trackInterviewStart, trackResponse, getLicenseInfo, getLicenseRemainingInfo } from '../../utils/licenseManager.js';

export class InterviewCrackerApp extends LitElement {
    static styles = css`
        * {
            box-sizing: border-box;
            font-family:
                'Inter',
                -apple-system,
                BlinkMacSystemFont,
                sans-serif;
            margin: 0px;
            padding: 0px;
            cursor: default;
            user-select: none;
        }

        input, textarea {
            user-select: text !important;
            -webkit-user-select: text !important;
            cursor: text !important;
            pointer-events: auto !important;
        }

        :host {
            display: block;
            width: 100%;
            height: 100vh;
            background: transparent !important;
            color: var(--text-color);
        }
        .window-container {
            height: 100vh;
            border-radius: var(--border-radius);
            overflow: hidden;
            box-shadow: 
                0 20px 60px rgba(31, 38, 135, 0.25),
                0 8px 32px rgba(0, 0, 0, 0.2),
                inset 0 1px 0 rgba(255, 255, 255, 0.1);
            background: var(--background-transparent) !important;
            backdrop-filter: blur(var(--glass-blur, 8px));
            -webkit-backdrop-filter: blur(var(--glass-blur, 8px));
            border: 1.5px solid var(--card-border);
            animation: windowAppear 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94);
            position: relative;
            transition: all 0.3s ease-in-out;
        }

        .window-container::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: transparent !important;
            pointer-events: none;
            border-radius: 20px;
        }

        @keyframes windowAppear {
            from {
                opacity: 0;
                transform: scale(0.95) translateY(20px);
            }
            to {
                opacity: 1;
                transform: scale(1) translateY(0);
            }
        }
        .container {
            display: flex;
            flex-direction: column;
            height: 100%;
            background: none;
        }
        .main-content {
            flex: 1;
            padding: var(--main-content-padding);
            overflow: hidden;
            margin-top: var(--main-content-margin-top);
            border-radius: var(--content-border-radius);
            transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
            background: var(--main-content-background) !important;
            backdrop-filter: blur(var(--glass-blur, 8px));
            -webkit-backdrop-filter: blur(var(--glass-blur, 8px));
            box-shadow: 
                0 8px 32px var(--shadow-color, rgba(31, 38, 135, 0.15)),
                inset 0 1px 0 rgba(255, 255, 255, 0.1);
            border: 1.5px solid var(--card-border);
            animation: slideInUp 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94);
            /* Hide scrollbar in non-WebKit as well */
            -ms-overflow-style: none;
            scrollbar-width: none;
        }

        @keyframes slideInUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .main-content.with-border {
            border: 1px solid var(--border-color);
        }

        .main-content.assistant-view {
            padding: 10px;
            border: none;
        }

        .main-content.onboarding-view {
            padding: 0;
            border: none;
            background: transparent;
        }

        .view-container {
            opacity: 1;
            transform: translateY(0);
            transition:
                opacity 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94),
                transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
            height: 100%;
            animation: fadeInScale 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }

        .view-container.entering {
            opacity: 0;
            transform: translateY(20px) scale(0.98);
        }

        @keyframes fadeInScale {
            from {
                opacity: 0;
                transform: scale(0.95);
            }
            to {
                opacity: 1;
                transform: scale(1);
            }
        }

        ::-webkit-scrollbar {
            width: 0 !important;
            height: 0 !important;
        }

        ::-webkit-scrollbar-track { background: transparent !important; }

        ::-webkit-scrollbar-thumb { background: transparent !important; border: none !important; }

        ::-webkit-scrollbar-thumb:hover { background: transparent !important; }

        ::-webkit-scrollbar-corner {
            background: transparent;
        }
    `;

    static properties = {
        currentView: { type: String },
        statusText: { type: String },
        startTime: { type: Number },
        isRecording: { type: Boolean },
        sessionActive: { type: Boolean },
        selectedProfile: { type: String },
        selectedLanguage: { type: String },
        responses: { type: Array },
        currentResponseIndex: { type: Number },
        isListening: { type: Boolean },
        streamingContent: { type: String },
        selectedScreenshotInterval: { type: String },
        selectedImageQuality: { type: String },
        layoutMode: { type: String },
        advancedMode: { type: Boolean },
        isDarkMode: { type: Boolean },
        showPaymentAlert: { type: Boolean },
        _viewInstances: { type: Object, state: true },
        _isClickThrough: { state: true },
        isManualMode: { type: Boolean },
    };

    constructor() {
        super();
        // Check if onboarding has been completed
        const onboardingCompleted = localStorage.getItem('onboardingCompleted');
        this.currentView = onboardingCompleted ? 'main' : 'onboarding';
        this.statusText = '';
        this.startTime = null;
        this.isRecording = false;
        this.sessionActive = false;
        // Force migration to 'student' if previously 'interview' (as requested by user to be default)
        const storedProfile = localStorage.getItem('selectedProfile');
        this.selectedProfile = (storedProfile === 'interview' || !storedProfile) ? 'student' : storedProfile;
        // Update localStorage to reflect the forced change
        if (this.selectedProfile === 'student' && storedProfile !== 'student') {
            localStorage.setItem('selectedProfile', 'student');
        }
        this.selectedLanguage = localStorage.getItem('selectedLanguage') || 'en-US';
        this.selectedScreenshotInterval = localStorage.getItem('selectedScreenshotInterval') || 'manual';
        this.selectedImageQuality = localStorage.getItem('selectedImageQuality') || 'medium';
        this.layoutMode = localStorage.getItem('layoutMode') || 'normal';
        this.advancedMode = localStorage.getItem('advancedMode') === 'true';
        this.isDarkMode = localStorage.getItem('isDarkMode') !== 'false'; // Default to dark mode
        this.responses = [];
        this.currentResponseIndex = -1;
        this.streamingContent = '';
        this.isListening = false;
        this._viewInstances = new Map();
        this._isClickThrough = false;
        this.responseCount = parseInt(localStorage.getItem('responseCount') || '0');
        this.isActivated = false; // Will be verified async
        this.showPaymentAlert = false;
        this.isManualMode = false; // Add manual mode state

        // Apply layout mode to document root
        this.updateLayoutMode();

        // Apply initial theme
        this.applyTheme();

        // Sync theme state with localStorage
        this.syncThemeState();

        // Initialize Web Speech API for FREE real-time transcription
        this.initWebSpeechAPI();
    }

    initWebSpeechAPI() {
        // Check for Web Speech API support
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn('Web Speech API not supported in this browser');
            return;
        }

        this.speechRecognition = new SpeechRecognition();
        this.speechRecognition.continuous = true; // Keep listening
        this.speechRecognition.interimResults = true; // Real-time word-by-word
        this.speechRecognition.lang = this.selectedLanguage || 'en-US';
        this.speechRecognition.maxAlternatives = 1;

        this.currentTranscript = ''; // Accumulate full sentence
        this.finalTranscript = ''; // Store finalized text

        this.speechRecognition.onresult = (event) => {
            let interimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    this.finalTranscript += transcript + ' ';
                    console.log(`[FINAL] "${transcript}"`);
                    // Send final transcript to OpenAI for response
                    this.sendTranscriptToOpenAI(transcript.trim());
                } else {
                    interimTranscript += transcript;
                }
            }

            // Update status with real-time transcription
            if (interimTranscript) {
                this.setStatus(`Listening: "${interimTranscript}..."`);
                console.log(`[INTERIM] "${interimTranscript}"`);
            }
        };

        this.speechRecognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            if (event.error === 'no-speech') {
                // Restart on no-speech error
                this.restartSpeechRecognition();
            }
        };

        this.speechRecognition.onend = () => {
            // Auto-restart if session is active
            if (this.sessionActive && this.isListening) {
                console.log('Speech recognition ended, restarting...');
                this.restartSpeechRecognition();
            }
        };

        console.log('Web Speech API initialized');
    }

    restartSpeechRecognition() {
        if (this.speechRecognition && this.sessionActive && this.isListening) {
            try {
                this.speechRecognition.start();
            } catch (e) {
                // Already started
            }
        }
    }

    async sendTranscriptToOpenAI(text) {
        if (!text || text.trim().length === 0) return;

        console.log(`Sending to OpenAI: "${text}"`);
        this.setStatus('Processing...');

        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            try {
                await ipcRenderer.invoke('send-text-message', text);
            } catch (error) {
                console.error('Error sending to OpenAI:', error);
                this.setStatus('Error: ' + error.message);
            }
        }
    }

    async syncConfigWithFile() {
        if (window.require) {
            try {
                const { ipcRenderer } = window.require('electron');
                const config = await ipcRenderer.invoke('get-app-config');
                console.log('Loaded config from file store:', config);

                if (config) {
                    let changed = false;
                    // Restore key settings to localStorage if missing
                    const settingsToSync = [
                        'licenseKey', 'licenseTier', 'licenseExpiry', 'licenseActivatedDate',
                        'isActivated', 'activationCode', 'onboardingCompleted', 'customPrompt'
                    ];

                    settingsToSync.forEach(key => {
                        if (config[key] && !localStorage.getItem(key)) {
                            localStorage.setItem(key, config[key]);
                            changed = true;
                        }
                    });

                    if (changed) {
                        console.log('Restored settings from file store to localStorage');
                        // Update app state based on restored settings
                        if (localStorage.getItem('onboardingCompleted') === 'true' && this.currentView === 'onboarding') {
                            this.currentView = 'main';
                        }
                    }
                }
            } catch (error) {
                console.error('Failed to sync config with file store:', error);
            }
        }

        // Verify device-locked activation after sync
        await this.verifyActivation();
    }

    async verifyActivation() {
        // Get device ID for verification
        const deviceId = await (async () => {
            if (window.require) {
                const { ipcRenderer } = window.require('electron');
                return await ipcRenderer.invoke('get-machine-id');
            }
            return localStorage.getItem('deviceId') || 'browser-fallback';
        })();

        // Check both old activation and new license system
        const oldActivation = await isActivationValid();
        const licenseValid = isLicenseValid(deviceId);
        this.isActivated = oldActivation || licenseValid;
        this.requestUpdate();
    }

    connectedCallback() {
        super.connectedCallback();

        // Sync state from file-based config
        this.syncConfigWithFile();

        // Set up IPC listeners if needed
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.on('update-response', (_, response) => {
                this.setResponse(response, true); // final true means it's the finished response
            });
            ipcRenderer.on('update-response-stream', (_, chunk) => {
                this.handleStreamingChunk(chunk);
            });
            ipcRenderer.on('update-transcription-partial', (_, partialText) => {
                // Update the status with partial transcription to show user what's captured
                this.setStatus(`Listening: "${partialText}..."`);
            });
            ipcRenderer.on('update-status', (_, status) => {
                this.setStatus(status);
            });
            ipcRenderer.on('click-through-toggled', (_, isEnabled) => {
                this._isClickThrough = isEnabled;
            });
            ipcRenderer.on('update-mode', (_, isManual) => {
                this.isManualMode = isManual;
                this.requestUpdate();
            });
        }

        // Add functions to window.desireAI for IPC callbacks
        this.setupInterviewCrackerCallbacks();

        // Add theme toggle to window for debugging
        window.toggleTheme = () => this.handleToggleTheme();
        window.getCurrentTheme = () => this.isDarkMode ? 'dark' : 'light';
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.removeAllListeners('update-response');
            ipcRenderer.removeAllListeners('update-transcription-partial');
            ipcRenderer.removeAllListeners('update-status');
            ipcRenderer.removeAllListeners('click-through-toggled');
        }
    }

    setupInterviewCrackerCallbacks() {
        // Initialize window.interviewCracker and window.desireAI if they don't exist
        if (!window.interviewCracker) {
            window.interviewCracker = {};
        }
        if (!window.interviewAI) {
            window.interviewAI = window.interviewCracker;
        }

        // Add functions to get current view and layout mode
        window.interviewAI.getCurrentView = window.interviewCracker.getCurrentView = () => {
            return this.currentView;
        };

        window.interviewAI.getLayoutMode = window.interviewCracker.getLayoutMode = () => {
            return this.layoutMode;
        };

        // Add function to set status
        window.interviewAI.setStatus = window.interviewCracker.setStatus = (status) => {
            this.setStatus(status);
        };

        // Add handleShortcut function
        window.interviewAI.handleShortcut = window.interviewCracker.handleShortcut = (shortcutKey) => {
            this.handleShortcut(shortcutKey);
        };
    }

    handleShortcut(shortcutKey) {
        console.log('Handling shortcut in app:', shortcutKey);
        const normalizedKey = shortcutKey.toLowerCase();

        // Check for Alt+S or Cmd+S or the old Ctrl+Enter for backward compatibility
        if (normalizedKey === 'alt+s' || normalizedKey === 'cmd+s' || normalizedKey === 'ctrl+enter' || normalizedKey === 'cmd+enter') {
            if (this.currentView === 'main') {
                this.handleStart();
            } else if (this.currentView === 'assistant') {
                if (window.captureManualScreenshot) {
                    window.captureManualScreenshot();
                } else {
                    console.error('window.captureManualScreenshot not available');
                }
            }
        }
    }

    setStatus(text) {
        this.statusText = text;
    }

    handleStreamingChunk(chunk) {
        this.streamingContent += chunk;
        this.requestUpdate();
    }

    async setResponse(response, isFinal = false) {
        // Simple deduplication check
        if (this.responses.length > 0 && this.responses[this.responses.length - 1] === response) {
            console.log('Skipped duplicate response in UI');
            this.streamingContent = ''; // Clear stream if it matched final
            return;
        }

        // Only check license limits if user is already activated
        if (this.isActivated) {
            // Get device ID for limit checks
            const deviceId = await (async () => {
                if (window.require) {
                    const { ipcRenderer } = window.require('electron');
                    return await ipcRenderer.invoke('get-machine-id');
                }
                return localStorage.getItem('deviceId') || 'browser-fallback';
            })();

            const responseCheck = canGetResponse(deviceId);
            if (!responseCheck.allowed) {
                this.setStatus(responseCheck.reason);
                alert(`⚠️ Limit Reached\n\n${responseCheck.reason}\n\nPlease upgrade your plan or wait until tomorrow.`);
                return;
            }
        }

        // Use spread to trigger Lit update properly
        this.responses = [...this.responses, response];

        // Reset streaming once final message is added
        if (isFinal) {
            this.streamingContent = '';
        }

        // Track response for license limits (only if activated)
        if (this.isActivated) {
            trackResponse();
        }

        // Increment response count and save to localStorage
        this.responseCount++;
        localStorage.setItem('responseCount', this.responseCount.toString());

        // Check for payment alert if not activated
        if (!this.isActivated && this.responseCount >= 300) {
            // Show in-app payment alert
            this.showPaymentAlert = true;
        }

        // If user is viewing the latest response (or no responses yet), auto-navigate to new response
        if (this.currentResponseIndex === this.responses.length - 2 || this.currentResponseIndex === -1) {
            this.currentResponseIndex = this.responses.length - 1;
        }

        this.requestUpdate();
    }

    // Header event handlers
    handleCustomizeClick() {
        this.currentView = 'customize';
        this.requestUpdate();
    }

    handleHelpClick() {
        this.currentView = 'help';
        this.requestUpdate();
    }

    handleHistoryClick() {
        this.currentView = 'history';
        this.requestUpdate();
    }

    handleAdvancedClick() {
        this.currentView = 'advanced';
        this.requestUpdate();
    }

    handleLoginClick() {
        // TODO: Implement login functionality
        console.log('Login clicked');
    }

    async handleUpgradeClick() {
        // Redirect to Microsoft Store
        const storeUrl = 'https://apps.microsoft.com/store/detail/interview-ai';

        try {
            if (window.require) {
                const { ipcRenderer } = window.require('electron');
                await ipcRenderer.invoke('open-external', storeUrl);
            } else {
                // Fallback for web environment
                window.open(storeUrl, '_blank');
            }
        } catch (error) {
            console.error('Failed to open store URL:', error);
            alert(`Please visit the Microsoft Store to upgrade:\n${storeUrl}`);
        }
    }

    async handleClose() {
        if (this.currentView === 'customize' || this.currentView === 'help' || this.currentView === 'history') {
            this.currentView = 'main';
        } else if (this.currentView === 'assistant') {
            if (window.interviewAI) {
                window.interviewAI.stopCapture();
            }

            // Close the session
            if (window.require) {
                const { ipcRenderer } = window.require('electron');
                await ipcRenderer.invoke('close-session');
            }
            this.sessionActive = false;
            this.currentView = 'main';
            console.log('Session closed');
        } else {
            // Quit the entire application
            if (window.require) {
                const { ipcRenderer } = window.require('electron');
                await ipcRenderer.invoke('quit-application');
            }
        }
    }

    async handleHideToggle() {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            await ipcRenderer.invoke('toggle-window-visibility');
        }
    }

    async handleToggleListening() {
        console.log('handleToggleListening called!', this.isListening);
        console.log('window.interviewAI available:', !!window.interviewAI);
        if (window.interviewAI) {
            console.log('window.interviewAI methods:', Object.keys(window.interviewAI));
        }

        try {
            if (this.isListening) {
                // Stop listening
                console.log('Stopping listening...');
                if (window.interviewAI && window.interviewAI.stopCapture) {
                    window.interviewAI.stopCapture();
                } else {
                    console.error('window.interviewAI or stopCapture not available');
                }
                this.isListening = false;
                this.setStatus('Listening stopped');
                console.log('Listening stopped successfully');
            } else {
                // Start listening
                console.log('🎤 [DEBUG] Start Listening button clicked');
                console.log('🎤 [DEBUG] window.interviewAI exists:', !!window.interviewAI);
                console.log('🎤 [DEBUG] window.interviewAI.startCapture exists:', !!(window.interviewAI && window.interviewAI.startCapture));

                if (window.interviewAI && window.interviewAI.startCapture) {
                    console.log('🎤 [DEBUG] Calling startCapture with:', this.selectedScreenshotInterval, this.selectedImageQuality);
                    await window.interviewAI.startCapture(this.selectedScreenshotInterval, this.selectedImageQuality);
                    console.log('🎤 [DEBUG] startCapture completed');
                } else {
                    console.error('❌ window.interviewAI or startCapture not available');
                }
                this.isListening = true;
                this.setStatus('Listening started...');
                console.log('✅ Listening started successfully');
            }
        } catch (error) {
            console.error('Error toggling listening:', error);
            this.setStatus('Error: ' + error.message);
        }
    }

    // Main view event handlers
    async handleStart() {
        console.log('🎤 [DEBUG] handleStart CALLED - isActivated:', this.isActivated);

        // DISABLED: Enforce license check - No free trial allowed
        // if (!this.isActivated) {
        //     console.log('❌ [DEBUG] License check FAILED - showing payment alert');
        //     this.showPaymentAlert = true;
        //     this.requestUpdate();
        //     return;
        // }

        console.log('✅ [DEBUG] License check BYPASSED - proceeding with audio setup...');

        // Get device ID for limit checks
        const deviceId = await (async () => {
            if (window.require) {
                const { ipcRenderer } = window.require('electron');
                return await ipcRenderer.invoke('get-machine-id');
            }
            return localStorage.getItem('deviceId') || 'browser-fallback';
        })();

        // Check license limits
        const interviewCheck = canStartInterview(deviceId);
        if (!interviewCheck.allowed) {
            alert(interviewCheck.reason);
            return;
        }

        console.log('🎤 [DEBUG] handleStart - window.interviewAI exists:', !!window.interviewAI);
        if (window.interviewAI) {
            console.log('🎤 [DEBUG] Calling initializeGemini...');
            await window.interviewAI.initializeGemini(this.selectedProfile, this.selectedLanguage);
            console.log('🎤 [DEBUG] initializeGemini completed');

            // Pass the screenshot interval as string (including 'manual' option)
            console.log('🎤 [DEBUG] About to call startCapture with:', this.selectedScreenshotInterval, this.selectedImageQuality);
            window.interviewAI.startCapture(this.selectedScreenshotInterval, this.selectedImageQuality);
            console.log('🎤 [DEBUG] startCapture call dispatched');
        } else {
            console.error('❌ window.interviewAI not available in handleStart!');
        }

        // Track interview start for license limits (only if activated)
        if (this.isActivated) {
            trackInterviewStart();
        }

        this.responses = [];
        this.currentResponseIndex = -1;
        this.isListening = true;
        this.sessionActive = true;
        this.startTime = Date.now();
        this.currentView = 'assistant';

        // Start Web Speech API recognition
        if (this.speechRecognition) {
            try {
                this.speechRecognition.start();
                console.log('Web Speech recognition started');
            } catch (e) {
                console.warn('Speech recognition may already be running:', e);
            }
        }
    }

    async handleAPIKeyHelp() {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            await ipcRenderer.invoke('open-external', 'https://ai.google.dev/');
        }
    }

    // Customize view event handlers
    handleProfileChange(profile) {
        this.selectedProfile = profile;
    }

    handleLanguageChange(language) {
        this.selectedLanguage = language;
    }

    handleScreenshotIntervalChange(interval) {
        this.selectedScreenshotInterval = interval;
    }

    handleImageQualityChange(quality) {
        this.selectedImageQuality = quality;
        localStorage.setItem('selectedImageQuality', quality);
    }

    handleAdvancedModeChange(advancedMode) {
        this.advancedMode = advancedMode;
        localStorage.setItem('advancedMode', advancedMode.toString());
    }

    handleBackClick() {
        this.currentView = 'main';
        this.requestUpdate();
    }

    // Help view event handlers
    async handleExternalLinkClick(url) {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            await ipcRenderer.invoke('open-external', url);
        }
    }

    // Assistant view event handlers
    async handleSendText(message) {
        if (window.interviewAI) {
            const result = await window.interviewAI.sendTextMessage(message);

            if (!result.success) {
                console.error('Failed to send message:', result.error);
                this.setStatus('Error sending message: ' + result.error);
            } else {
                this.setStatus('Message sent...');
            }
        }
    }

    handleResponseIndexChanged(e) {
        this.currentResponseIndex = e.detail.index;
    }

    handleActivateLicenseClick() {
        this.currentView = 'payment';
        this.requestUpdate();
    }

    async handleChatClick() {
        // Enforce license check
        if (!this.isActivated) {
            this.showPaymentAlert = true;
            this.requestUpdate();
            return;
        }

        // Initialize Gemini if needed
        if (window.interviewAI) {
            await window.interviewAI.initializeGemini(this.selectedProfile, this.selectedLanguage);
        }

        this.currentView = 'assistant';

        // Add a welcome message if chat is empty
        if (!this.responses || this.responses.length === 0) {
            this.responses = [{
                text: "Hello! I'm your AI assistant. How can I help you today?",
                sender: 'ai',
                timestamp: new Date().toLocaleTimeString()
            }];
            this.currentResponseIndex = 0;
        }

        this.requestUpdate();
    }

    // Onboarding event handlers
    handleOnboardingComplete() {
        this.currentView = 'main';
    }

    updated(changedProperties) {
        super.updated(changedProperties);

        // Only notify main process of view change if the view actually changed
        if (changedProperties.has('currentView') && window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.send('view-changed', this.currentView);

            // Add a small delay to smooth out the transition
            const viewContainer = this.shadowRoot?.querySelector('.view-container');
            if (viewContainer) {
                viewContainer.classList.add('entering');
                requestAnimationFrame(() => {
                    viewContainer.classList.remove('entering');
                });
            }
        }

        // Only update localStorage when these specific properties change
        if (changedProperties.has('selectedProfile')) {
            localStorage.setItem('selectedProfile', this.selectedProfile);
        }
        if (changedProperties.has('selectedLanguage')) {
            localStorage.setItem('selectedLanguage', this.selectedLanguage);
        }
        if (changedProperties.has('selectedScreenshotInterval')) {
            localStorage.setItem('selectedScreenshotInterval', this.selectedScreenshotInterval);
        }
        if (changedProperties.has('selectedImageQuality')) {
            localStorage.setItem('selectedImageQuality', this.selectedImageQuality);
        }
        if (changedProperties.has('layoutMode')) {
            this.updateLayoutMode();
        }
        if (changedProperties.has('advancedMode')) {
            localStorage.setItem('advancedMode', this.advancedMode.toString());
        }
        if (changedProperties.has('isDarkMode')) {
            localStorage.setItem('isDarkMode', this.isDarkMode.toString());
        }
    }

    renderCurrentView() {
        // Only re-render the view if it hasn't been cached or if critical properties changed
        const viewKey = `${this.currentView}-${this.selectedProfile}-${this.selectedLanguage}`;

        switch (this.currentView) {
            case 'onboarding':
                return html`
                    <onboarding-view .onComplete=${() => this.handleOnboardingComplete()} .onClose=${() => this.handleClose()}></onboarding-view>
                `;

            case 'main':
                return html`
                    <main-view
                        .onStart=${() => this.handleStart()}
                        .onAPIKeyHelp=${() => this.handleAPIKeyHelp()}
                        .onLayoutModeChange=${layoutMode => this.handleLayoutModeChange(layoutMode)}
                        .onActivateLicense=${() => this.handleActivateLicenseClick()}
                        .onChat=${() => this.handleChatClick()}
                        .licenseRemainingInfo=${getLicenseRemainingInfo()}
                    ></main-view>
                `;

            case 'customize':
                return html`
                    <customize-view
                        .selectedProfile=${this.selectedProfile}
                        .selectedLanguage=${this.selectedLanguage}
                        .selectedScreenshotInterval=${this.selectedScreenshotInterval}
                        .selectedImageQuality=${this.selectedImageQuality}
                        .layoutMode=${this.layoutMode}
                        .advancedMode=${this.advancedMode}
                        .onProfileChange=${profile => this.handleProfileChange(profile)}
                        .onLanguageChange=${language => this.handleLanguageChange(language)}
                        .onScreenshotIntervalChange=${interval => this.handleScreenshotIntervalChange(interval)}
                        .onImageQualityChange=${quality => this.handleImageQualityChange(quality)}
                        .onLayoutModeChange=${layoutMode => this.handleLayoutModeChange(layoutMode)}
                        .onAdvancedModeChange=${advancedMode => this.handleAdvancedModeChange(advancedMode)}
                    ></customize-view>
                `;

            case 'help':
                return html` <help-view .onExternalLinkClick=${url => this.handleExternalLinkClick(url)}></help-view> `;

            case 'history':
                return html` <history-view></history-view> `;

            case 'advanced':
                return html` <advanced-view></advanced-view> `;

            case 'assistant':
                return html`
                    <assistant-view
                        .responses=${this.responses}
                        .streamingContent=${this.streamingContent}
                        .currentResponseIndex=${this.currentResponseIndex}
                        .selectedProfile=${this.selectedProfile}
                        .onSendText=${message => this.handleSendText(message)}
                        @response-index-changed=${this.handleResponseIndexChanged}
                        @back-clicked=${() => this.handleBackClick()}
                    ></assistant-view>
                `;

            case 'payment':
                return html`
                    <payment-alert
                        .onClose=${() => this.handleBackClick()}
                        .onActivate=${(code) => this.handleActivationSubmit(code)}
                        .onPayNow=${() => this.handlePayNow()}
                    ></payment-alert>
                `;

            default:
                return html`<div>Unknown view: ${this.currentView}</div>`;
        }
    }

    handleBackClick() {
        console.log('Back clicked - returning to main menu');

        // Stop listening/recording
        if (this.isListening) {
            this.handleToggleListening();
        }

        this.sessionActive = false;
        this.currentView = 'main';
        this.requestUpdate();
    }

    render() {
        const mainContentClass = `main-content ${this.currentView === 'assistant' ? 'assistant-view' : this.currentView === 'onboarding' ? 'onboarding-view' : 'with-border'
            }`;

        return html`
            <div class="window-container">
                <div class="container">
                    <app-header
                        .currentView=${this.currentView}
                        .statusText=${this.statusText}
                        .startTime=${this.startTime}
                        .advancedMode=${this.advancedMode}
                        .isListening=${this.isListening}
                        .isDarkMode=${this.isDarkMode}
                        .isManualMode=${this.isManualMode}
                        .onCustomizeClick=${() => this.handleCustomizeClick()}
                        .onHelpClick=${() => this.handleHelpClick()}
                        .onHistoryClick=${() => this.handleHistoryClick()}
                        .onAdvancedClick=${() => this.handleAdvancedClick()}
                        .onLoginClick=${() => this.handleLoginClick()}
                        .onUpgradeClick=${() => this.handleUpgradeClick()}
                        .onCloseClick=${() => this.handleClose()}
                        .onBackClick=${() => this.handleBackClick()}
                        .onHideToggleClick=${() => this.handleHideToggle()}
                        .onToggleListening=${this.handleToggleListening.bind(this)}
                        .onToggleTheme=${() => this.handleToggleTheme()}
                        ?isClickThrough=${this._isClickThrough}
                    ></app-header>
                    <div class="${mainContentClass}">
                        <div class="view-container">${this.renderCurrentView()}</div>
                    </div>
                </div>
                ${this.showPaymentAlert ? html`
                    <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 10000;">
                        <payment-alert
                            .onClose=${() => { this.showPaymentAlert = false; this.requestUpdate(); }}
                            .onActivate=${(code) => this.handleActivationSubmit(code)}
                            .onPayNow=${() => this.handlePayNow()}
                        ></payment-alert>
                    </div>
                ` : ''}
            </div>
        `;
    }

    updateLayoutMode() {
        // Apply or remove compact layout class to document root
        if (this.layoutMode === 'compact') {
            document.documentElement.classList.add('compact-layout');
        } else {
            document.documentElement.classList.remove('compact-layout');
        }
    }

    applyTheme() {
        try {
            // Apply theme to document root
            if (this.isDarkMode) {
                document.documentElement.removeAttribute('data-theme');
                // Set dark theme specific backdrop filter
                document.body.style.backdropFilter = 'blur(8px)';
                document.body.style.webkitBackdropFilter = 'blur(8px)';
                // Clear any light-theme-specific filters
                document.body.style.filter = '';
            } else {
                document.documentElement.setAttribute('data-theme', 'light');
                // Set light theme enhanced glass effect
                document.body.style.backdropFilter = 'blur(var(--glass-blur, 12px))';
                document.body.style.webkitBackdropFilter = 'blur(var(--glass-blur, 12px))';
                // Apply additional light theme glass effect properties
                document.body.style.filter = `saturate(var(--glass-saturation, 180%)) brightness(var(--glass-brightness, 1.15))`;
            }

            // Force a repaint to ensure theme is applied
            document.documentElement.style.display = 'none';
            document.documentElement.offsetHeight; // Trigger reflow
            document.documentElement.style.display = '';

            // Apply enhanced glass effect to window container
            const windowContainer = this.shadowRoot?.querySelector('.window-container');
            if (windowContainer) {
                if (this.isDarkMode) {
                    windowContainer.style.backdropFilter = 'blur(8px)';
                    windowContainer.style.webkitBackdropFilter = 'blur(8px)';
                } else {
                    windowContainer.style.backdropFilter = 'blur(var(--glass-blur, 12px))';
                    windowContainer.style.webkitBackdropFilter = 'blur(var(--glass-blur, 12px))';
                }
            }
        } catch (error) {
            console.error('Error applying theme:', error);
        }
    }

    handleToggleTheme() {
        try {
            this.isDarkMode = !this.isDarkMode;
            localStorage.setItem('isDarkMode', this.isDarkMode.toString());
            this.applyTheme();
            this.requestUpdate();

            // Log theme change for debugging
            console.log('Theme toggled to:', this.isDarkMode ? 'dark' : 'light');
        } catch (error) {
            console.error('Error toggling theme:', error);
            // Revert on error
            this.isDarkMode = !this.isDarkMode;
        }
    }

    syncThemeState() {
        try {
            const savedTheme = localStorage.getItem('isDarkMode');
            if (savedTheme !== null) {
                this.isDarkMode = savedTheme === 'true';
                this.applyTheme();
            }
        } catch (error) {
            console.error('Error syncing theme state:', error);
        }
    }

    async handleLayoutModeChange(layoutMode) {
        this.layoutMode = layoutMode;
        localStorage.setItem('layoutMode', layoutMode);
        this.updateLayoutMode();

        // Notify main process about layout change for window resizing
        if (window.require) {
            try {
                const { ipcRenderer } = window.require('electron');
                await ipcRenderer.invoke('update-sizes');
            } catch (error) {
                console.error('Failed to update sizes in main process:', error);
            }
        }

        this.requestUpdate();
    }

    handlePaymentAlertClose() {
        this.showPaymentAlert = false;
        this.requestUpdate();
    }

    async handleActivationSubmit(code) {
        try {
            // Try new license system first
            const deviceId = await (async () => {
                if (window.require) {
                    const { ipcRenderer } = window.require('electron');
                    return await ipcRenderer.invoke('get-machine-id');
                }
                return localStorage.getItem('deviceId') || 'browser-fallback';
            })();

            const licenseResult = await activateLicense(code, deviceId);
            if (licenseResult.success) {
                this.isActivated = true;
                this.showPaymentAlert = false;

                // Switch to chat view and show welcome message
                this.currentView = 'assistant';
                this.responses = [{
                    text: "🎉 License activated successfully! How can I help you today?",
                    sender: 'ai',
                    timestamp: new Date().toLocaleTimeString()
                }];
                this.currentResponseIndex = 0;

                // Initialize Gemini if needed
                if (window.interviewAI) {
                    await window.interviewAI.initializeGemini(this.selectedProfile, this.selectedLanguage);
                }

                // Use a small delay for the alert to allow the UI to transition and the overlay to remove
                setTimeout(async () => {
                    // Force the window to handle interaction again just in case click-through was sticked
                    if (window.require) {
                        const { ipcRenderer } = window.require('electron');
                        ipcRenderer.send('view-changed', 'main');
                        ipcRenderer.send('view-changed', 'assistant');

                        // Try to focus the window
                        try {
                            const { remote } = window.require('electron');
                            if (remote) remote.getCurrentWindow().focus();
                        } catch (e) { }
                    }

                    // Show success message
                    const message = licenseResult.isUpgrade
                        ? `✓ License upgraded successfully!\n\nPrevious: ${licenseResult.previousTier}\nNew: ${licenseResult.tier}\n\nYour new plan is now active!`
                        : `✓ License activated successfully!\n\nPlan: ${licenseResult.tier}\nDevice ID: ${licenseResult.deviceId}`;

                    alert(message);

                    // Force focus to the input box after alert is dismissed
                    setTimeout(() => {
                        const assistantView = this.shadowRoot.querySelector('assistant-view');
                        if (assistantView && assistantView.focusInput) {
                            assistantView.focusInput();
                        }
                    }, 100);
                }, 100);

                this.requestUpdate();
                return;
            } else {
                // Show error message in the payment alert
                const paymentAlert = this.shadowRoot.querySelector('payment-alert');
                if (paymentAlert) {
                    paymentAlert.errorMessage = licenseResult.reason || 'Invalid activation code. Please try again.';
                    paymentAlert.successMessage = '';
                    paymentAlert.requestUpdate();
                }
            }

            // Fallback to old activation system
            const result = await activateWithDeviceLock(code);
            if (result.success) {
                this.isActivated = true;
                this.showPaymentAlert = false;
                this.requestUpdate();
                console.log('Activated on device:', result.deviceId);
            }
        } catch (error) {
            console.error('Activation failed:', error);
        }
    }

    async handlePayNow() {
        this.showPaymentAlert = true;
        this.requestUpdate();
    }
}

customElements.define('interview-ai-app', InterviewCrackerApp);