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
import { isLicenseValid, activateLicense, canStartInterview, canGetResponse, trackInterviewStart, trackResponse, getLicenseInfo } from '../../utils/licenseManager.js';

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
            cursor: text !important;
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
        selectedScreenshotInterval: { type: String },
        selectedImageQuality: { type: String },
        layoutMode: { type: String },
        advancedMode: { type: Boolean },
        isDarkMode: { type: Boolean },
        showPaymentAlert: { type: Boolean },
        _viewInstances: { type: Object, state: true },
        _isClickThrough: { state: true },
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
        this.selectedProfile = localStorage.getItem('selectedProfile') || 'interview';
        this.selectedLanguage = localStorage.getItem('selectedLanguage') || 'en-US';
        this.selectedScreenshotInterval = localStorage.getItem('selectedScreenshotInterval') || 'manual';
        this.selectedImageQuality = localStorage.getItem('selectedImageQuality') || 'medium';
        this.layoutMode = localStorage.getItem('layoutMode') || 'normal';
        this.advancedMode = localStorage.getItem('advancedMode') === 'true';
        this.isDarkMode = localStorage.getItem('isDarkMode') !== 'false'; // Default to dark mode
        this.responses = [];
        this.currentResponseIndex = -1;
        this.isListening = false;
        this._viewInstances = new Map();
        this._isClickThrough = false;
        this.responseCount = parseInt(localStorage.getItem('responseCount') || '0');
        this.isActivated = false; // Will be verified async
        this.showPaymentAlert = false;

        // Apply layout mode to document root
        this.updateLayoutMode();

        // Apply initial theme
        this.applyTheme();

        // Sync theme state with localStorage
        this.syncThemeState();
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
        // Check both old activation and new license system
        const oldActivation = await isActivationValid();
        const licenseValid = isLicenseValid();
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
                this.setResponse(response);
            });
            ipcRenderer.on('update-status', (_, status) => {
                this.setStatus(status);
            });
            ipcRenderer.on('click-through-toggled', (_, isEnabled) => {
                this._isClickThrough = isEnabled;
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

    setResponse(response) {
        // Simple deduplication check
        if (this.responses.length > 0 && this.responses[this.responses.length - 1] === response) {
            console.log('Skipped duplicate response in UI');
            return;
        }

        // Only check license limits if user is already activated
        if (this.isActivated) {
            const responseCheck = canGetResponse();
            if (!responseCheck.allowed) {
                this.setStatus(responseCheck.reason);
                alert(`⚠️ Limit Reached\n\n${responseCheck.reason}\n\nPlease upgrade your plan or wait until tomorrow.`);
                return;
            }
        }

        this.responses.push(response);

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
                console.log('Starting listening...');
                if (window.interviewAI && window.interviewAI.startCapture) {
                    await window.interviewAI.startCapture(this.selectedScreenshotInterval, this.selectedImageQuality);
                } else {
                    console.error('window.interviewAI or startCapture not available');
                }
                this.isListening = true;
                this.setStatus('Listening started...');
                console.log('Listening started successfully');
            }
        } catch (error) {
            console.error('Error toggling listening:', error);
            this.setStatus('Error: ' + error.message);
        }
    }

    // Main view event handlers
    async handleStart() {
        // Enforce license check - No free trial allowed
        if (!this.isActivated) {
            this.showPaymentAlert = true;
            this.requestUpdate();
            return;
        }

        // Check license limits
        const interviewCheck = canStartInterview();
        if (!interviewCheck.allowed) {
            alert(interviewCheck.reason);
            return;
        }

        if (window.interviewAI) {
            await window.interviewAI.initializeGemini(this.selectedProfile, this.selectedLanguage);
            // Pass the screenshot interval as string (including 'manual' option)
            window.interviewAI.startCapture(this.selectedScreenshotInterval, this.selectedImageQuality);
        }

        // Track interview start for license limits (only if activated)
        if (this.isActivated) {
            trackInterviewStart();
        }

        this.responses = [];
        this.currentResponseIndex = -1;
        this.isListening = true;
        this.startTime = Date.now();
        this.currentView = 'assistant';
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
                        .currentResponseIndex=${this.currentResponseIndex}
                        .selectedProfile=${this.selectedProfile}
                        .onSendText=${message => this.handleSendText(message)}
                        @response-index-changed=${this.handleResponseIndexChanged}
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

                this.requestUpdate();

                // Show upgrade message if applicable
                if (licenseResult.isUpgrade) {
                    alert(`✓ License upgraded successfully!\n\nPrevious: ${licenseResult.previousTier}\nNew: ${licenseResult.tier}\n\nYour new plan is now active!`);
                } else {
                    alert(`✓ License activated successfully!\n\nPlan: ${licenseResult.tier}\nDevice ID: ${licenseResult.deviceId}`);
                }
                console.log('License activated:', licenseResult.tier);
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