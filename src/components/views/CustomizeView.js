import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';
import { resizeLayout } from '../../utils/windowResize.js';
import './RemoteAssistanceView.js';

export class CustomizeView extends LitElement {
    static styles = css`
        * {
            font-family:
                'Inter',
                -apple-system,
                BlinkMacSystemFont,
                sans-serif;
            cursor: default;
            user-select: none;
        }

        :host {
            display: flex;
            flex-direction: column;
            padding: 12px;
            margin: 0 auto;
            max-width: 700px;
            height: 100%;
            box-sizing: border-box;
            overflow: hidden;
        }

        .settings-container {
            display: grid;
            gap: 12px;
            padding-bottom: 20px;
        }

        .settings-section {
            background: var(--card-background);
            border: 1px solid var(--card-border);
            border-radius: 6px;
            padding: 16px;
            backdrop-filter: blur(10px);
        }

        .section-title {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 12px;
            font-size: 14px;
            font-weight: 600;
            color: var(--text-color);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .section-title::before {
            content: '';
            width: 3px;
            height: 14px;
            background: var(--accent-color);
            border-radius: 1.5px;
        }

        .form-grid {
            display: grid;
            gap: 12px;
        }

        .form-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            align-items: start;
        }

        @media (max-width: 600px) {
            .form-row {
                grid-template-columns: 1fr;
            }
        }

        .form-group {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }

        .form-group.full-width {
            grid-column: 1 / -1;
        }

        .form-label {
            font-weight: 500;
            font-size: 12px;
            color: var(--label-color);
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .form-description {
            font-size: 11px;
            color: var(--description-color);
            line-height: 1.3;
            margin-top: 2px;
        }

        .form-control {
            background: var(--input-background, rgba(0, 0, 0, 0.3));
            color: var(--text-color);
            border: 1px solid var(--input-border, rgba(255, 255, 255, 0.15));
            padding: 8px 10px;
            border-radius: 4px;
            font-size: 12px;
            transition: all 0.15s ease;
            min-height: 16px;
            font-weight: 400;
            user-select: text !important;
            -webkit-user-select: text !important;
            pointer-events: auto !important;
        }

        .form-control:focus {
            outline: none;
            border-color: var(--focus-border-color, #007aff);
            box-shadow: 0 0 0 2px var(--focus-shadow, rgba(0, 122, 255, 0.1));
            background: var(--input-focus-background, rgba(0, 0, 0, 0.4));
        }

        .form-control:hover:not(:focus) {
            border-color: var(--input-hover-border, rgba(255, 255, 255, 0.2));
            background: var(--input-hover-background, rgba(0, 0, 0, 0.35));
        }

        select.form-control {
            cursor: default;
            appearance: none;
            background-image: var(--select-arrow, url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23ffffff' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e"));
            background-position: right 8px center;
            background-repeat: no-repeat;
            background-size: 12px;
            padding-right: 28px;
        }

        textarea.form-control {
            resize: vertical;
            min-height: 60px;
            line-height: 1.4;
            font-family: inherit;
        }

        textarea.form-control::placeholder {
            color: var(--placeholder-color, rgba(255, 255, 255, 0.4));
        }
        
        input.form-control::placeholder {
            color: var(--placeholder-color, rgba(255, 255, 255, 0.4));
        }

        .profile-option {
            display: flex;
            flex-direction: column;
            gap: 3px;
        }

        .current-selection {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-size: 10px;
            color: rgba(255, 255, 255, 0.8); /* Light text for current selection */
            background: rgba(255, 255, 255, 0.1); /* Transparent white background */
            padding: 2px 6px;
            border-radius: 3px;
            font-weight: 500;
            border: 1px solid rgba(255, 255, 255, 0.2); /* Subtle border */
        }

        .current-selection::before {
            content: '✓';
            font-weight: 600;
        }

        .keybind-input {
            cursor: default;
            font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
            text-align: center;
            letter-spacing: 0.5px;
            font-weight: 500;
        }

        .keybind-input:focus {
            cursor: text;
            background: var(--input-focus-background, rgba(0, 122, 255, 0.1));
        }

        .keybind-input::placeholder {
            color: var(--placeholder-color, rgba(255, 255, 255, 0.4));
            font-style: italic;
        }

        .reset-keybinds-button {
            background: var(--button-background, rgba(255, 255, 255, 0.1));
            color: var(--text-color);
            border: 1px solid var(--button-border, rgba(255, 255, 255, 0.15));
            padding: 6px 10px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 500;
            cursor: default;
            transition: all 0.15s ease;
        }

        .reset-keybinds-button:hover {
            background: var(--button-hover-background, rgba(255, 255, 255, 0.15));
            border-color: var(--button-hover-border, rgba(255, 255, 255, 0.25));
        }

        .reset-keybinds-button:active {
            transform: translateY(1px);
        }

        .keybinds-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
            border-radius: 4px;
            overflow: hidden;
        }

        .keybinds-table th,
        .keybinds-table td {
            padding: 8px 10px;
            text-align: left;
            border-bottom: 1px solid var(--table-border, rgba(255, 255, 255, 0.08));
        }

        .keybinds-table th {
            background: var(--table-header-background, rgba(255, 255, 255, 0.04));
            font-weight: 600;
            font-size: 11px;
            color: var(--label-color, rgba(255, 255, 255, 0.8));
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .keybinds-table td {
            vertical-align: middle;
        }

        .keybinds-table .action-name {
            font-weight: 500;
            color: var(--text-color);
            font-size: 12px;
        }

        .keybinds-table .action-description {
            font-size: 10px;
            color: var(--description-color, rgba(255, 255, 255, 0.5));
            margin-top: 1px;
        }

        .keybinds-table .keybind-input {
            min-width: 100px;
            padding: 4px 8px;
            margin: 0;
            font-size: 11px;
        }

        .keybinds-table tr:hover {
            background: var(--table-row-hover, rgba(255, 255, 255, 0.02));
        }

        .keybinds-table tr:last-child td {
            border-bottom: none;
        }

        .table-reset-row {
            border-top: 1px solid var(--table-border, rgba(255, 255, 255, 0.08));
        }

        .table-reset-row td {
            padding-top: 10px;
            padding-bottom: 8px;
            border-bottom: none;
        }

        .settings-note {
            font-size: 10px;
            color: var(--note-color, rgba(255, 255, 255, 0.4));
            font-style: italic;
            text-align: center;
            margin-top: 10px;
            padding: 8px;
            background: var(--note-background, rgba(255, 255, 255, 0.02));
            border-radius: 4px;
            border: 1px solid var(--note-border, rgba(255, 255, 255, 0.08));
        }

        .checkbox-group {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 10px;
            padding: 8px;
            background: var(--checkbox-background, rgba(255, 255, 255, 0.02));
            border-radius: 4px;
            border: 1px solid var(--checkbox-border, rgba(255, 255, 255, 0.06));
        }

        .checkbox-input {
            width: 14px;
            height: 14px;
            accent-color: var(--focus-border-color, #007aff);
            cursor: default;
        }

        .checkbox-label {
            font-weight: 500;
            font-size: 12px;
            color: var(--label-color, rgba(255, 255, 255, 0.9));
            cursor: default;
            user-select: none;
        }

        /* Better focus indicators */
        .form-control:focus-visible {
            outline: none;
            border-color: var(--focus-border-color, #007aff);
            box-shadow: 0 0 0 2px var(--focus-shadow, rgba(0, 122, 255, 0.1));
        }

        /* Improved button states */
        .reset-keybinds-button:focus-visible {
            outline: none;
            border-color: var(--focus-border-color, #007aff);
            box-shadow: 0 0 0 2px var(--focus-shadow, rgba(0, 122, 255, 0.1));
        }

        /* Slider styles */
        .slider-container {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .slider-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .slider-value {
            font-size: 11px;
            color: var(--success-color, #34d399);
            background: var(--success-background, rgba(52, 211, 153, 0.1));
            padding: 2px 6px;
            border-radius: 3px;
            font-weight: 500;
            border: 1px solid var(--success-border, rgba(52, 211, 153, 0.2));
            font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
        }

        .slider-input {
            -webkit-appearance: none;
            appearance: none;
            width: 100%;
            height: 4px;
            border-radius: 2px;
            background: var(--input-background, rgba(0, 0, 0, 0.3));
            outline: none;
            border: 1px solid var(--input-border, rgba(255, 255, 255, 0.15));
            cursor: default;
        }

        .slider-input::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: var(--focus-border-color, #007aff);
            cursor: default;
            border: 2px solid var(--text-color, white);
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }

        .slider-input::-moz-range-thumb {
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: var(--focus-border-color, #007aff);
            cursor: default;
            border: 2px solid var(--text-color, white);
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }

        .slider-input:hover::-webkit-slider-thumb {
            background: var(--text-input-button-hover, #0056b3);
        }

        .slider-input:hover::-moz-range-thumb {
            background: var(--text-input-button-hover, #0056b3);
        }

        .slider-labels {
            display: flex;
            justify-content: space-between;
            margin-top: 4px;
            font-size: 10px;
            color: var(--description-color, rgba(255, 255, 255, 0.5));
        }

        .settings-tabs {
            display: flex;
            gap: 8px;
            margin-bottom: 18px;
            justify-content: flex-start;
            overflow-x: auto;
            overflow-y: hidden;
            padding-bottom: 8px;
            /* Smooth horizontal scrolling */
            scroll-behavior: smooth;
            -webkit-overflow-scrolling: touch;
        }
        
        /* Hide scrollbar for cleaner look */
        .settings-tabs::-webkit-scrollbar {
            height: 4px;
        }
        .settings-tabs::-webkit-scrollbar-track {
            background: transparent;
        }
        .settings-tabs::-webkit-scrollbar-thumb {
            background: var(--scrollbar-thumb, rgba(255, 255, 255, 0.2));
            border-radius: 4px;
        }
        .settings-tabs::-webkit-scrollbar-thumb:hover {
            background: var(--scrollbar-thumb-hover, rgba(255, 255, 255, 0.3));
        }
        
        .tab-btn {
            background: var(--button-background, rgba(255, 255, 255, 0.08));
            color: var(--text-color, #ffffff);
            border: 1.5px solid var(--card-border, rgba(255, 255, 255, 0.2));
            border-radius: 18px 18px 0 0;
            font-weight: 600;
            font-size: 14px;
            padding: 10px 18px;
            cursor: default;
            transition: all 0.2s ease;
            white-space: nowrap;
            flex-shrink: 0;
        }
        .tab-btn.active, .tab-btn:hover {
            background: var(--button-hover-background, rgba(255, 255, 255, 0.15)); /* Use theme variable with fallback */
            color: var(--text-color, #fff);
            border-bottom: 2.5px solid var(--accent-color, #fff);
        }
        .settings-tab-content {
            min-height: 0;
            flex: 1;
            height: auto;
            overflow-y: auto;
            padding-right: 6px; /* space for scrollbar */
            scrollbar-gutter: stable;
        }

        /* Visible scrollbar styling within CustomizeView */
        .settings-tab-content::-webkit-scrollbar {
            width: 10px;
        }
        .settings-tab-content::-webkit-scrollbar-track {
            background: var(--scrollbar-track, rgba(255, 255, 255, 0.08));
            border-radius: 8px;
        }
        .settings-tab-content::-webkit-scrollbar-thumb {
            background: var(--scrollbar-thumb, rgba(255, 255, 255, 0.18));
            border-radius: 8px;
            border: 2px solid transparent;
            background-clip: padding-box;
        }
        .settings-tab-content::-webkit-scrollbar-thumb:hover {
            background: var(--scrollbar-thumb-hover, rgba(255, 255, 255, 0.28));
        }
        .settings-tab-content {
            scrollbar-color: var(--scrollbar-thumb, rgba(255, 255, 255, 0.18)) var(--scrollbar-track, rgba(255, 255, 255, 0.08));
            scrollbar-width: thin;
        }
        .settings-card {
            background: var(--card-background, rgba(255, 255, 255, 0.05)); /* Use theme variable with fallback */
            border: 1.5px solid var(--card-border, rgba(255, 255, 255, 0.15)); /* Use theme variable with fallback */
            border-radius: 18px;
            box-shadow: 0 4px 15px var(--shadow-color, rgba(0, 0, 0, 0.2)); /* Use theme variable with fallback */
            backdrop-filter: blur(15px); /* Stronger blur for glass effect */
            -webkit-backdrop-filter: blur(15px);
            padding: 32px 28px 24px 28px;
            margin: 0 auto;
            width: 90%;
            max-width: 600px;
            display: flex;
            flex-direction: column;
            align-items: stretch;
            gap: 18px;
        }
        .card-title {
            font-size: 18px;
            font-weight: 700;
            color: var(--text-color, #ffffff); /* Use theme variable with fallback */
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .card-content {
            width: 100%;
            display: flex;
            flex-direction: column;
            gap: 14px;
        }
        .form-label {
            font-weight: 600;
            font-size: 13px;
            color: var(--label-color, rgba(255, 255, 255, 0.9)); /* Use theme variable with fallback */
            margin-bottom: 2px;
        }
        .form-control {
            border-radius: 12px;
            border: 1.5px solid var(--card-border, rgba(255, 255, 255, 0.2)); /* Use theme variable with fallback */
            background: var(--input-background, rgba(255, 255, 255, 0.08)); /* Use theme variable with fallback */
            color: var(--text-color, #ffffff); /* Use theme variable with fallback */
            padding: 8px 14px;
            font-size: 15px;
            margin-bottom: 4px;
        }
        .form-control:focus {
            border: 1.5px solid var(--input-focus-border, rgba(255, 255, 255, 0.4)); /* Use theme variable with fallback */
            background: var(--input-focus-background, rgba(255, 255, 255, 0.15)); /* Use theme variable with fallback */
            outline: none;
        }
        .form-description {
            font-size: 12px;
            color: var(--description-color, rgba(255, 255, 255, 0.7)); /* Use theme variable with fallback */
            margin-top: 2px;
        }
        .toggle-row {
            display: flex;
            gap: 10px;
            margin: 8px 0;
        }
        .toggle-btn {
            background: var(--button-background, rgba(255, 255, 255, 0.08)); /* Use theme variable with fallback */
            color: var(--text-color, #ffffff); /* Use theme variable with fallback */
            border: 1.5px solid var(--card-border, rgba(255, 255, 255, 0.2)); /* Use theme variable with fallback */
            border-radius: 12px;
            font-weight: 600;
            font-size: 14px;
            padding: 7px 18px;
            cursor: default;
            transition: all 0.2s ease;
        }
        .toggle-btn.active, .toggle-btn:hover {
            background: var(--button-hover-background, rgba(255, 255, 255, 0.15)); /* Use theme variable with fallback */
            color: var(--text-color, #fff); /* Use theme variable with fallback */
            border-color: var(--button-hover-border, rgba(255, 255, 255, 0.4)); /* Use theme variable with fallback */
        }
        .clear-data-btn {
            background: var(--button-background, rgba(255, 255, 255, 0.1)); /* Use theme variable with fallback */
            color: var(--text-color, #fff); /* Use theme variable with fallback */
            border: 1.5px solid var(--card-border, rgba(255, 255, 255, 0.2)); /* Use theme variable with fallback */
            border-radius: 12px;
            font-weight: 700;
            font-size: 15px;
            padding: 10px 22px;
            margin-top: 18px;
            cursor: default;
            box-shadow: 0 2px 12px var(--shadow-color, rgba(0, 0, 0, 0.15)); /* Use theme variable with fallback */
            transition: background 0.2s, color 0.2s;
        }
        .clear-data-btn:hover {
            background: var(--button-hover-background, rgba(255, 255, 255, 0.2)); /* Use theme variable with fallback */
            border-color: var(--button-hover-border, rgba(255, 255, 255, 0.3)); /* Use theme variable with fallback */
        }

        /* Profile Selection Styles */
        .profile-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 12px;
            margin-top: 8px;
        }

        .profile-option {
            background: var(--card-background, rgba(255, 255, 255, 0.08));
            border: 1.5px solid var(--card-border, rgba(255, 255, 255, 0.15));
            border-radius: 12px;
            padding: 16px;
            cursor: default;
            transition: all 0.2s ease;
            position: relative;
            overflow: hidden;
            backdrop-filter: blur(var(--glass-blur, 12px));
            -webkit-backdrop-filter: blur(var(--glass-blur, 12px));
        }

        .profile-option:hover {
            background: var(--button-hover-background, rgba(255, 255, 255, 0.12));
            border-color: var(--button-hover-border, rgba(255, 255, 255, 0.25));
            transform: translateY(-2px);
            box-shadow: 0 4px 12px var(--shadow-color, rgba(0, 0, 0, 0.15));
        }

        .profile-option.selected {
            background: var(--button-hover-background, rgba(255, 255, 255, 0.15));
            border-color: var(--accent-color, rgba(255, 255, 255, 0.3));
            box-shadow: 0 4px 16px var(--shadow-color, rgba(0, 0, 0, 0.2));
        }

        .profile-option.selected::before {
            content: '✓';
            position: absolute;
            top: 8px;
            right: 8px;
            width: 20px;
            height: 20px;
            background: var(--accent-color, #ffffff);
            color: var(--card-background, #000000);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: 700;
        }

        .profile-icon {
            font-size: 24px;
            margin-bottom: 8px;
            display: block;
        }

        .profile-name {
            font-size: 14px;
            font-weight: 600;
            color: var(--text-color, #ffffff);
            margin-bottom: 4px;
        }

        .profile-description {
            font-size: 11px;
            color: var(--description-color, rgba(255, 255, 255, 0.7));
            line-height: 1.3;
        }

        .profile-option.selected .profile-name {
            color: var(--text-color, #ffffff);
        }

        .profile-option.selected .profile-description {
            color: var(--description-color, rgba(255, 255, 255, 0.8));
        }
    `;

    static properties = {
        selectedProfile: { type: String },
        selectedLanguage: { type: String },
        selectedScreenshotInterval: { type: String },
        selectedImageQuality: { type: String },
        layoutMode: { type: String },
        keybinds: { type: Object },
        viewMode: { type: String },
        googleSearchEnabled: { type: Boolean },
        backgroundTransparency: { type: Number },
        fontSize: { type: Number },
        onProfileChange: { type: Function },
        onLanguageChange: { type: Function },
        onScreenshotIntervalChange: { type: Function },
        onImageQualityChange: { type: Function },
        onLayoutModeChange: { type: Function },
        advancedMode: { type: Boolean },
        onAdvancedModeChange: { type: Function },
        activeTab: { type: String },
        resumeFileName: { type: String },
        screenshotResponseStyle: { type: String },
        silenceThreshold: { type: String },
    };

    constructor() {
        super();
        this.selectedProfile = 'student';
        this.selectedLanguage = 'en-US';
        this.selectedScreenshotInterval = '5';
        this.selectedImageQuality = 'medium';
        this.layoutMode = 'normal';
        this.viewMode = 'scrolling';
        this.keybinds = this.getDefaultKeybinds();
        this.onProfileChange = () => { };
        this.onLanguageChange = () => { };
        this.onScreenshotIntervalChange = () => { };
        this.onImageQualityChange = () => { };
        this.onLayoutModeChange = () => { };
        this.onViewModeChange = () => { };
        this.onAdvancedModeChange = () => { };
        this.onScreenshotResponseStyleChange = () => { };

        // Default to "Code Only" as requested
        this.screenshotResponseStyle = 'code_only';

        // Google Search default
        this.googleSearchEnabled = true;

        // Advanced mode default
        this.advancedMode = false;

        // Background transparency default
        this.backgroundTransparency = 0.8;

        // Font size default (in pixels)
        this.fontSize = 20;

        this.loadKeybinds();
        this.loadGoogleSearchSettings();
        this.loadAdvancedModeSettings();
        this.loadBackgroundTransparency();
        this.loadFontSize();
        this.activeTab = 'profile';
        this.resumeFileName = localStorage.getItem('resumeFileName') || '';
        this.screenshotResponseStyle = localStorage.getItem('screenshotResponseStyle') || 'code_only';
        this.silenceThreshold = localStorage.getItem('silenceThreshold') || '0.5';
    }

    connectedCallback() {
        super.connectedCallback();
        // Load layout mode for display purposes
        this.loadLayoutMode();
        this.loadViewMode();
        // Resize window for this view
        resizeLayout();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        // Restore original theme values when leaving the CustomizeView
        if (window.originalThemeValues) {
            const root = document.documentElement;
            root.style.setProperty('--header-background', window.originalThemeValues.headerBackground);
            root.style.setProperty('--main-content-background', window.originalThemeValues.mainContentBackground);
            root.style.setProperty('--card-background', window.originalThemeValues.cardBackground);
            root.style.setProperty('--input-background', window.originalThemeValues.inputBackground);
            root.style.setProperty('--input-focus-background', window.originalThemeValues.inputFocusBackground);
            root.style.setProperty('--button-background', window.originalThemeValues.buttonBackground);
            root.style.setProperty('--preview-video-background', window.originalThemeValues.previewVideoBackground);
            root.style.setProperty('--screen-option-background', window.originalThemeValues.screenOptionBackground);
            root.style.setProperty('--screen-option-hover-background', window.originalThemeValues.screenOptionHoverBackground);
            root.style.setProperty('--scrollbar-background', window.originalThemeValues.scrollbarBackground);
        }
    }

    getProfiles() {
        return [
            {
                value: 'student',
                name: 'Student / Candidate',
                description: 'Act like a student/junior candidate (Imperfect, Eager, Resume-focused)',
                icon: '🎓',
                color: '#FFD700'
            },
            {
                value: 'interview',
                name: 'Job Interview',
                description: 'Get help with answering interview questions (Professional)',
                icon: '🧑‍💼',
                color: '#5865f2'
            },
            {
                value: 'coding',
                name: 'Coding Interview',
                description: 'Get help with programming questions and technical problems',
                icon: '💻',
                color: '#57f287'
            },
            {
                value: 'senior_architect',
                name: '10+ Years Exp (Architect)',
                description: 'Deep technical deep-dives, system design, and complex scenario-based Q&A.',
                icon: '🏛️',
                color: '#ED4245'
            },
        ];
    }

    getLanguages() {
        return [
            { value: 'en-US', name: 'English (US)' },
            { value: 'en-GB', name: 'English (UK)' },
            { value: 'en-AU', name: 'English (Australia)' },
            { value: 'en-IN', name: 'English (India)' },
            { value: 'de-DE', name: 'German (Germany)' },
            { value: 'es-US', name: 'Spanish (United States)' },
            { value: 'es-ES', name: 'Spanish (Spain)' },
            { value: 'fr-FR', name: 'French (France)' },
            { value: 'fr-CA', name: 'French (Canada)' },
            { value: 'hi-IN', name: 'Hindi (India)' },
            { value: 'pt-BR', name: 'Portuguese (Brazil)' },
            { value: 'ar-XA', name: 'Arabic (Generic)' },
            { value: 'id-ID', name: 'Indonesian (Indonesia)' },
            { value: 'it-IT', name: 'Italian (Italy)' },
            { value: 'ja-JP', name: 'Japanese (Japan)' },
            { value: 'tr-TR', name: 'Turkish (Turkey)' },
            { value: 'vi-VN', name: 'Vietnamese (Vietnam)' },
            { value: 'bn-IN', name: 'Bengali (India)' },
            { value: 'gu-IN', name: 'Gujarati (India)' },
            { value: 'kn-IN', name: 'Kannada (India)' },
            { value: 'ml-IN', name: 'Malayalam (India)' },
            { value: 'mr-IN', name: 'Marathi (India)' },
            { value: 'ta-IN', name: 'Tamil (India)' },
            { value: 'te-IN', name: 'Telugu (India)' },
            { value: 'nl-NL', name: 'Dutch (Netherlands)' },
            { value: 'ko-KR', name: 'Korean (South Korea)' },
            { value: 'cmn-CN', name: 'Mandarin Chinese (China)' },
            { value: 'pl-PL', name: 'Polish (Poland)' },
            { value: 'ru-RU', name: 'Russian (Russia)' },
            { value: 'th-TH', name: 'Thai (Thailand)' },
        ];
    }

    getProfileNames() {
        return {
            student: 'Student / Candidate',
            interview: 'Job Interview',
            coding: 'Coding Interview',
            senior_architect: '10+ Years Exp (Architect)',
            sales: 'Sales Call',
            meeting: 'Business Meeting',
            presentation: 'Presentation',
            negotiation: 'Negotiation',
        };
    }

    handleProfileSelect(profileValue) {
        this.selectedProfile = profileValue;
        localStorage.setItem('selectedProfile', this.selectedProfile);
        this.onProfileChange(this.selectedProfile);
    }

    handleLanguageSelect(e) {
        this.selectedLanguage = e.target.value;
        localStorage.setItem('selectedLanguage', this.selectedLanguage);
        this.onLanguageChange(this.selectedLanguage);
    }

    handleScreenshotIntervalSelect(e) {
        this.selectedScreenshotInterval = e.target.value;
        localStorage.setItem('selectedScreenshotInterval', this.selectedScreenshotInterval);
        this.onScreenshotIntervalChange(this.selectedScreenshotInterval);
    }

    handleScreenshotResponseStyleSelect(e) {
        this.screenshotResponseStyle = e.target.value;
        localStorage.setItem('screenshotResponseStyle', this.screenshotResponseStyle);

        // Notify main process immediately
        if (window.require) {
            try {
                const { ipcRenderer } = window.require('electron');
                ipcRenderer.invoke('update-screenshot-style', this.screenshotResponseStyle);
            } catch (error) {
                console.error('Failed to update screenshot style:', error);
            }
        }

        this.requestUpdate();
    }

    handleImageQualitySelect(e) {
        this.selectedImageQuality = e.target.value;
        this.onImageQualityChange(e.target.value);
    }

    handleLayoutModeSelect(e) {
        this.layoutMode = e.target.value;
        localStorage.setItem('layoutMode', this.layoutMode);
        this.onLayoutModeChange(e.target.value);
    }

    handleViewModeSelect(e) {
        this.viewMode = e.target.value;
        localStorage.setItem('viewMode', this.viewMode);
        // Dispatch event or callback if needed, but localStorage is main sync
        this.requestUpdate();
    }

    handleCustomPromptInput(e) {
        localStorage.setItem('customPrompt', e.target.value);
    }

    async handleResumeUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        // Store filename for UI feedback
        this.resumeFileName = file.name;

        // Show loading state
        const originalText = localStorage.getItem('resumeContext') || '';
        this.requestUpdate();

        if (window.require) {
            try {
                const { ipcRenderer } = window.require('electron');

                // Use file.path (Electron adds this to File objects)
                // Note: file.path is available in Electron renderer but not standard web
                if (file.path) {
                    const result = await ipcRenderer.invoke('read-file-content', file.path);

                    if (result && result.success) {
                        const parsedText = result.content;
                        // Save to localStorage and update UI
                        localStorage.setItem('resumeContext', parsedText);
                        this.requestUpdate(); // Re-render to show text in textarea
                        alert(`✓ Successfully parsed resume!`);
                    } else {
                        console.error('Failed to parse file:', result.error);
                        alert(`❌ Failed to read file: ${result.error}`);
                    }
                } else {
                    alert('Error: Cannot access file path. Are you running in Electron?');
                }
            } catch (error) {
                console.error('Error uploading/parsing resume:', error);
                alert(`Error: ${error.message}`);
            }
        } else {
            alert('File parsing is only available in the desktop application.');
        }

        // Reset file input so same file can be selected again
        e.target.value = '';
    }

    getDefaultKeybinds() {
        const isMac = window.interviewCracker?.isMacOS || navigator.platform.includes('Mac');
        return {
            moveUp: isMac ? 'Alt+Up' : 'Shift+Alt+Up',
            moveDown: isMac ? 'Alt+Down' : 'Shift+Alt+Down',
            moveLeft: isMac ? 'Alt+Left' : 'Shift+Alt+Left',
            moveRight: isMac ? 'Alt+Right' : 'Shift+Alt+Right',
            toggleVisibility: isMac ? 'Cmd+\\' : 'Ctrl+\\',
            toggleClickThrough: isMac ? 'Cmd+M' : 'Ctrl+M',
            nextStep: isMac ? 'Cmd+S' : 'Alt+S',
            previousResponse: isMac ? 'Cmd+[' : 'Ctrl+[',
            nextResponse: isMac ? 'Cmd+]' : 'Ctrl+]',
            scrollUp: isMac ? 'Cmd+Shift+Up' : 'Ctrl+Shift+Up',
            scrollDown: isMac ? 'Cmd+Shift+Down' : 'Ctrl+Shift+Down',
        };
    }

    loadKeybinds() {
        const savedKeybinds = localStorage.getItem('customKeybinds');
        if (savedKeybinds) {
            try {
                this.keybinds = { ...this.getDefaultKeybinds(), ...JSON.parse(savedKeybinds) };
            } catch (e) {
                console.error('Failed to parse saved keybinds:', e);
                this.keybinds = this.getDefaultKeybinds();
            }
        }
    }

    saveKeybinds() {
        localStorage.setItem('customKeybinds', JSON.stringify(this.keybinds));
        // Send to main process to update global shortcuts
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.send('update-keybinds', this.keybinds);
        }
    }

    handleKeybindChange(action, value) {
        this.keybinds = { ...this.keybinds, [action]: value };
        this.saveKeybinds();
        this.requestUpdate();
    }

    resetKeybinds() {
        this.keybinds = this.getDefaultKeybinds();
        localStorage.removeItem('customKeybinds');
        this.requestUpdate();
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.send('update-keybinds', this.keybinds);
        }
    }

    getKeybindActions() {
        return [
            {
                key: 'moveUp',
                name: 'Move Window Up',
                description: 'Move the application window up',
            },
            {
                key: 'moveDown',
                name: 'Move Window Down',
                description: 'Move the application window down',
            },
            {
                key: 'moveLeft',
                name: 'Move Window Left',
                description: 'Move the application window left',
            },
            {
                key: 'moveRight',
                name: 'Move Window Right',
                description: 'Move the application window right',
            },
            {
                key: 'toggleVisibility',
                name: 'Toggle Window Visibility',
                description: 'Show/hide the application window',
            },
            {
                key: 'toggleClickThrough',
                name: 'Toggle Click-through Mode',
                description: 'Enable/disable click-through functionality',
            },
            {
                key: 'nextStep',
                name: 'Ask Next Step',
                description: 'Take screenshot and ask AI for the next step suggestion',
            },
            {
                key: 'previousResponse',
                name: 'Previous Response',
                description: 'Navigate to the previous AI response',
            },
            {
                key: 'nextResponse',
                name: 'Next Response',
                description: 'Navigate to the next AI response',
            },
            {
                key: 'scrollUp',
                name: 'Scroll Response Up',
                description: 'Scroll the AI response content up',
            },
            {
                key: 'scrollDown',
                name: 'Scroll Response Down',
                description: 'Scroll the AI response content down',
            },
        ];
    }

    handleKeybindFocus(e) {
        e.target.placeholder = 'Press key combination...';
        e.target.select();
    }

    handleKeybindInput(e) {
        e.preventDefault();

        const modifiers = [];
        const keys = [];

        // Check modifiers
        if (e.ctrlKey) modifiers.push('Ctrl');
        if (e.metaKey) modifiers.push('Cmd');
        if (e.altKey) modifiers.push('Alt');
        if (e.shiftKey) modifiers.push('Shift');

        // Get the main key
        let mainKey = e.key;

        // Handle special keys
        switch (e.code) {
            case 'ArrowUp':
                mainKey = 'Up';
                break;
            case 'ArrowDown':
                mainKey = 'Down';
                break;
            case 'ArrowLeft':
                mainKey = 'Left';
                break;
            case 'ArrowRight':
                mainKey = 'Right';
                break;
            case 'Enter':
                mainKey = 'Enter';
                break;
            case 'Space':
                mainKey = 'Space';
                break;
            case 'Backslash':
                mainKey = '\\';
                break;
            case 'KeyS':
                if (e.shiftKey) mainKey = 'S';
                break;
            case 'KeyM':
                mainKey = 'M';
                break;
            default:
                if (e.key.length === 1) {
                    mainKey = e.key.toUpperCase();
                }
                break;
        }

        // Skip if only modifier keys are pressed
        if (['Control', 'Meta', 'Alt', 'Shift'].includes(e.key)) {
            return;
        }

        // Construct keybind string
        const keybind = [...modifiers, mainKey].join('+');

        // Get the action from the input's data attribute
        const action = e.target.dataset.action;

        // Update the keybind
        this.handleKeybindChange(action, keybind);

        // Update the input value
        e.target.value = keybind;
        e.target.blur();
    }

    loadGoogleSearchSettings() {
        const googleSearchEnabled = localStorage.getItem('googleSearchEnabled');
        if (googleSearchEnabled !== null) {
            this.googleSearchEnabled = googleSearchEnabled === 'true';
        }
    }

    async handleGoogleSearchChange(e) {
        this.googleSearchEnabled = e.target.checked;
        localStorage.setItem('googleSearchEnabled', this.googleSearchEnabled.toString());

        // Notify main process if available
        if (window.require) {
            try {
                const { ipcRenderer } = window.require('electron');
                await ipcRenderer.invoke('update-google-search-setting', this.googleSearchEnabled);
            } catch (error) {
                console.error('Failed to notify main process:', error);
            }
        }

        this.requestUpdate();
    }

    loadLayoutMode() {
        const savedLayoutMode = localStorage.getItem('layoutMode');
        if (savedLayoutMode) {
            this.layoutMode = savedLayoutMode;
        }
    }

    loadViewMode() {
        const savedViewMode = localStorage.getItem('viewMode');
        if (savedViewMode) {
            this.viewMode = savedViewMode;
        }
    }

    loadAdvancedModeSettings() {
        const advancedMode = localStorage.getItem('advancedMode');
        if (advancedMode !== null) {
            this.advancedMode = advancedMode === 'true';
        }
    }

    async handleAdvancedModeChange(e) {
        this.advancedMode = e.target.checked;
        localStorage.setItem('advancedMode', this.advancedMode.toString());
        this.onAdvancedModeChange(this.advancedMode);
        this.requestUpdate();
    }

    loadBackgroundTransparency() {
        const backgroundTransparency = localStorage.getItem('backgroundTransparency');
        if (backgroundTransparency !== null) {
            this.backgroundTransparency = parseFloat(backgroundTransparency) || 0.8;
        }
        this.updateBackgroundTransparency();
    }

    handleBackgroundTransparencyChange(e) {
        this.backgroundTransparency = parseFloat(e.target.value);
        localStorage.setItem('backgroundTransparency', this.backgroundTransparency.toString());
        this.updateBackgroundTransparency();
        this.requestUpdate();
    }

    updateBackgroundTransparency() {
        // Store original theme values when first loading the page if not already stored
        if (!window.originalThemeValues) {
            window.originalThemeValues = {
                headerBackground: getComputedStyle(document.documentElement).getPropertyValue('--header-background').trim(),
                mainContentBackground: getComputedStyle(document.documentElement).getPropertyValue('--main-content-background').trim(),
                cardBackground: getComputedStyle(document.documentElement).getPropertyValue('--card-background').trim(),
                inputBackground: getComputedStyle(document.documentElement).getPropertyValue('--input-background').trim(),
                inputFocusBackground: getComputedStyle(document.documentElement).getPropertyValue('--input-focus-background').trim(),
                buttonBackground: getComputedStyle(document.documentElement).getPropertyValue('--button-background').trim(),
                previewVideoBackground: getComputedStyle(document.documentElement).getPropertyValue('--preview-video-background').trim(),
                screenOptionBackground: getComputedStyle(document.documentElement).getPropertyValue('--screen-option-background').trim(),
                screenOptionHoverBackground: getComputedStyle(document.documentElement).getPropertyValue('--screen-option-hover-background').trim(),
                scrollbarBackground: getComputedStyle(document.documentElement).getPropertyValue('--scrollbar-background').trim()
            };
        }

        // Apply transparency settings only while in the CustomizeView
        const root = document.documentElement;
        const isDarkMode = !root.hasAttribute('data-theme') || root.getAttribute('data-theme') !== 'light';

        if (isDarkMode) {
            // Dark theme colors
            root.style.setProperty('--header-background', `rgba(0, 0, 0, ${this.backgroundTransparency})`);
            root.style.setProperty('--main-content-background', `rgba(0, 0, 0, ${this.backgroundTransparency})`);
            root.style.setProperty('--card-background', `rgba(255, 255, 255, ${this.backgroundTransparency * 0.05})`);
            root.style.setProperty('--input-background', `rgba(0, 0, 0, ${this.backgroundTransparency * 0.375})`);
            root.style.setProperty('--input-focus-background', `rgba(0, 0, 0, ${this.backgroundTransparency * 0.625})`);
            root.style.setProperty('--button-background', `rgba(0, 0, 0, ${this.backgroundTransparency * 0.625})`);
            root.style.setProperty('--preview-video-background', `rgba(0, 0, 0, ${this.backgroundTransparency * 1.125})`);
            root.style.setProperty('--screen-option-background', `rgba(0, 0, 0, ${this.backgroundTransparency * 0.5})`);
            root.style.setProperty('--screen-option-hover-background', `rgba(0, 0, 0, ${this.backgroundTransparency * 0.75})`);
            root.style.setProperty('--scrollbar-background', `rgba(0, 0, 0, ${this.backgroundTransparency * 0.5})`);
        } else {
            // Light theme colors with enhanced glass effect
            root.style.setProperty('--header-background', `rgba(255, 255, 255, ${this.backgroundTransparency * 0.65})`);
            root.style.setProperty('--main-content-background', `rgba(255, 255, 255, ${this.backgroundTransparency * 0.55})`);
            root.style.setProperty('--card-background', `rgba(255, 255, 255, ${this.backgroundTransparency * 0.45})`);
            root.style.setProperty('--input-background', `rgba(255, 255, 255, ${this.backgroundTransparency * 0.40})`);
            root.style.setProperty('--input-focus-background', `rgba(255, 255, 255, ${this.backgroundTransparency * 0.50})`);
            root.style.setProperty('--button-background', `rgba(255, 255, 255, ${this.backgroundTransparency * 0.40})`);
            root.style.setProperty('--preview-video-background', `rgba(255, 255, 255, ${this.backgroundTransparency * 0.45})`);
            root.style.setProperty('--screen-option-background', `rgba(255, 255, 255, ${this.backgroundTransparency * 0.40})`);
            root.style.setProperty('--screen-option-hover-background', `rgba(255, 255, 255, ${this.backgroundTransparency * 0.55})`);
            root.style.setProperty('--scrollbar-background', `rgba(255, 255, 255, ${this.backgroundTransparency * 0.40})`);

            // Add light theme specific variables with enhanced glass effect
            root.style.setProperty('--button-hover-background', `rgba(255, 255, 255, ${this.backgroundTransparency * 0.55})`);
            root.style.setProperty('--button-hover-border', `rgba(31, 41, 55, ${this.backgroundTransparency * 0.25})`);
            root.style.setProperty('--shadow-color', `rgba(0, 0, 0, ${this.backgroundTransparency * 0.08})`);
            root.style.setProperty('--border-color', `rgba(31, 41, 55, ${this.backgroundTransparency * 0.15})`);
            root.style.setProperty('--card-border', `rgba(31, 41, 55, ${this.backgroundTransparency * 0.12})`);
            root.style.setProperty('--button-border', `rgba(31, 41, 55, ${this.backgroundTransparency * 0.15})`);

            // Enhance backdrop filter for better glass effect
            document.body.style.backdropFilter = 'blur(12px)';
            document.body.style.webkitBackdropFilter = 'blur(12px)';
        }
    }

    loadFontSize() {
        const fontSize = localStorage.getItem('fontSize');
        if (fontSize !== null) {
            this.fontSize = parseInt(fontSize, 10) || 20;
        }
        this.updateFontSize();
    }

    handleFontSizeChange(e) {
        this.fontSize = parseInt(e.target.value, 10);
        localStorage.setItem('fontSize', this.fontSize.toString());
        this.updateFontSize();
        this.requestUpdate();
    }

    updateFontSize() {
        const root = document.documentElement;
        root.style.setProperty('--response-font-size', `${this.fontSize}px`);
    }

    handleSilenceChange(e) {
        this.silenceThreshold = e.target.value;
        localStorage.setItem('silenceThreshold', this.silenceThreshold);
        this.requestUpdate();
    }

    setTab(tab) {
        this.activeTab = tab;
    }

    handlePaste(e) {
        // Allow default paste behavior
        e.stopPropagation();
    }

    handleKeyDown(e) {
        // Allow copy/paste shortcuts
        const isCmdOrCtrl = e.ctrlKey || e.metaKey;
        const key = e.key.toLowerCase();
        const isShortcut = isCmdOrCtrl && (key === 'c' || key === 'v' || key === 'x' || key === 'a');

        if (isShortcut) {
            e.stopPropagation();
        }
    }

    async handleResumeUpload(e) {
        const file = e.target.files[0];
        if (file) {
            this.resumeFileName = file.name;
            localStorage.setItem('resumeFileName', file.name);

            // Check file type
            if (file.name.endsWith('.pdf') || file.name.endsWith('.doc') || file.name.endsWith('.docx')) {
                // For binary files, we can't parse them easily.
                // We'll clear the context and let the user paste it.
                localStorage.setItem('resumeContext', '');
                this.requestUpdate();
                return;
            }

            try {
                const text = await file.text();
                localStorage.setItem('resumeContext', text);
                this.requestUpdate();
            } catch (error) {
                console.error('Error reading file:', error);
                alert('Failed to read file. Please ensure it is a valid text file.');
            }
        }
    }

    handleResumeContentInput(e) {
        localStorage.setItem('resumeContext', e.target.value);
    }

    render() {
        const profiles = this.getProfiles();
        const languages = this.getLanguages();
        const profileNames = this.getProfileNames();
        const currentProfile = profiles.find(p => p.value === this.selectedProfile);
        const currentLanguage = languages.find(l => l.value === this.selectedLanguage);
        const keybindActions = this.getKeybindActions();
        return html`
            <div class="settings-tabs">
                <button class="tab-btn ${this.activeTab === 'profile' ? 'active' : ''}" @click=${() => this.setTab('profile')}>
                    <span>🧑‍💼</span> Profile
                </button>
                <button class="tab-btn ${this.activeTab === 'language' ? 'active' : ''}" @click=${() => this.setTab('language')}>
                    <span>🌐</span> Language
                </button>
                <button class="tab-btn ${this.activeTab === 'resume' ? 'active' : ''}" @click=${() => this.setTab('resume')}>
                    <span>📄</span> Resume
                </button>
                <button class="tab-btn ${this.activeTab === 'layout' ? 'active' : ''}" @click=${() => this.setTab('layout')}>
                    <span>🖥️</span> Layout
                </button>
                <button class="tab-btn ${this.activeTab === 'shortcuts' ? 'active' : ''}" @click=${() => this.setTab('shortcuts')}>
                    <span>⌨️</span> Shortcuts
                </button>
                <button class="tab-btn ${this.activeTab === 'advanced' ? 'active' : ''}" @click=${() => this.setTab('advanced')}>
                    <span>⚙️</span> Advanced
                </button>
                <button class="tab-btn ${this.activeTab === 'remote' ? 'active' : ''}" @click=${() => this.setTab('remote')}>
                    <span>🔗</span> Remote
                </button>
            </div>
            <div class="settings-tab-content">
                ${this.activeTab === 'profile' ? html`
                    <div class="settings-card">
                        <div class="card-title"><span>🧑‍💼</span> AI Profile & Behavior</div>
                        <div class="card-content">
                            <label class="form-label">Choose Your AI Profile</label>
                            <div class="profile-grid">
                                ${profiles.map(profile => html`
                                    <div class="profile-option ${this.selectedProfile === profile.value ? 'selected' : ''}" 
                                         @click=${() => this.handleProfileSelect(profile.value)}>
                                        <span class="profile-icon">${profile.icon}</span>
                                        <div class="profile-name">${profile.name}</div>
                                        <div class="profile-description">${profile.description}</div>
                                    </div>
                                `)}
                            </div>
                            <div class="form-group" style="margin-top: 20px;">
                                <label class="form-label">Custom AI Instructions</label>
                                <textarea class="form-control" placeholder="How should the AI behave? Be creative!" .value=${localStorage.getItem('customPrompt') || ''} rows="3" @input=${this.handleCustomPromptInput} @keydown=${this.handleKeyDown} @paste=${this.handlePaste}></textarea>
                                <div class="form-text">Example: "Act as a strict interviewer", "Be funny and casual"</div>
                            </div>
                        </div>
                    </div>
                ` : ''}
                ${this.activeTab === 'resume' ? html`
                    <div class="settings-card">
                        <div class="card-title"><span>📄</span> Upload Resume (Context)</div>
                        <div class="card-content">
                            <div class="form-group">
                                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
                                    <label class="toggle-btn" style="cursor: default; display: inline-flex; align-items: center; gap: 6px; width: 100%; justify-content: center; padding: 12px;">
                                        <span style="font-size: 1.2em;">📂</span> Upload Resume File
                                        <input type="file" accept=".txt,.md,.json,.pdf,.doc,.docx" style="display: none" @change=${this.handleResumeUpload} />
                                    </label>
                                </div>
                                
                                ${this.resumeFileName ? html`
                                    <div style="font-size: 13px; color: var(--accent-color); margin: 10px 0; text-align: center; font-weight: 500;">
                                        ✓ Loaded: ${this.resumeFileName}
                                    </div>
                                    
                                    ${(this.resumeFileName.endsWith('.pdf') || this.resumeFileName.endsWith('.doc') || this.resumeFileName.endsWith('.docx')) ? html`
                                        <div style="font-size: 12px; color: #ffab00; margin: 10px 0; padding: 10px; background: rgba(255, 171, 0, 0.1); border-radius: 6px; border: 1px solid rgba(255, 171, 0, 0.2);">
                                            ⚠️ <strong>Action Required:</strong> We cannot read this file type automatically. Please Copy & Paste the text from your resume into the box below.
                                        </div>
                                    ` : ''}
                                ` : ''}

                                <label class="form-label">Resume Text Content</label>
                                <textarea 
                                    class="form-control" 
                                    placeholder="Paste your full resume text here. The AI will use this to personalize your answers with the STAR method." 
                                    .value=${localStorage.getItem('resumeContext') || ''} 
                                    rows="12" 
                                    style="font-family: monospace; font-size: 13px; line-height: 1.4;"
                                    @input=${this.handleResumeContentInput} 
                                    @keydown=${this.handleKeyDown} 
                                    @paste=${this.handlePaste}
                                ></textarea>
                                <div class="form-text">The more details you provide here, the better the AI can simulate your actual experience.</div>
                            </div>
                        </div>
                    </div>
                ` : ''}
                ${this.activeTab === 'language' ? html`
                    <div class="settings-card">
                        <div class="card-title"><span>🌐</span> Language & Audio</div>
                        <div class="card-content">
                            <label class="form-label">Speech Language</label>
                            <select class="form-control" .value=${this.selectedLanguage} @change=${this.handleLanguageSelect}>
                                ${this.getLanguages().map(language => html`<option value=${language.value}>${language.name}</option>`)}
                            </select>
                            <div class="form-description">Choose how your AI sounds and understands you.</div>

                            <hr style="border: 0; border-top: 1px solid var(--card-border); margin: 16px 0;">

                            <div class="form-group">
                                <label class="form-label">Screenshot Response Style</label>
                                <select class="form-control" .value="${this.screenshotResponseStyle}" @change="${this.handleScreenshotResponseStyleSelect}">
                                    <option value="code_only">Code Only (Lowest Cost)</option>
                                    <option value="assignment">Assignment/Answer (Low Cost)</option>
                                    <option value="approach_solution">Approach & Solution (Medium Cost)</option>
                                    <option value="full_analysis">Full Analysis (High Cost)</option>
                                </select>
                                <div class="form-description">Controls detail level and token usage for screenshot analysis.</div>
                            </div>
                        </div>
                    </div>
                ` : ''}
                ${this.activeTab === 'layout' ? html`
                    <div class="settings-card">
                        <div class="card-title"><span>🖥️</span> Interface Layout</div>
                        <div class="card-content">
                            <label class="form-label">Layout Mode</label>
                            <div class="toggle-row">
                                <button class="toggle-btn ${this.layoutMode === 'normal' ? 'active' : ''}" @click=${() => this.handleLayoutModeSelect({ target: { value: 'normal' } })}>Normal</button>
                                <button class="toggle-btn ${this.layoutMode === 'compact' ? 'active' : ''}" @click=${() => this.handleLayoutModeSelect({ target: { value: 'compact' } })}>Compact</button>
                            </div>
                            <div class="form-description">Switch up the UI for your style. ✨</div>

                            <hr style="border: 0; border-top: 1px solid var(--card-border); margin: 16px 0;">

                            <label class="form-label">View Mode</label>
                            <div class="toggle-row">
                                <button class="toggle-btn ${this.viewMode === 'scrolling' ? 'active' : ''}" @click=${() => this.handleViewModeSelect({ target: { value: 'scrolling' } })}>Scrolling</button>
                                <button class="toggle-btn ${this.viewMode === 'pagination' ? 'active' : ''}" @click=${() => this.handleViewModeSelect({ target: { value: 'pagination' } })}>Pagination</button>
                            </div>
                            <div class="form-description">Choose "Pagination" to focus on one response at a time.</div>
                            
                            <div style="margin-top: 16px;">
                                <div class="slider-header">
                                    <label class="form-label">Background Transparency</label>
                                    <span class="slider-value">${Math.round(this.backgroundTransparency * 100)}%</span>
                                </div>
                                <div class="slider-container">
                                    <input type="range" class="slider-input" min="0.1" max="1" step="0.05" .value=${this.backgroundTransparency} @input=${this.handleBackgroundTransparencyChange} />
                                    <div class="slider-labels">
                                        <span>Transparent</span>
                                        <span>Solid Black</span>
                                    </div>
                                </div>
                                <div class="form-description">Adjust the background opacity. 100% is solid black (in dark mode).</div>
                            </div>
                        </div>
                    </div>
                ` : ''}
                ${this.activeTab === 'shortcuts' ? html`
                    <div class="settings-card">
                        <div class="card-title"><span>⌨️</span> Key Instructions</div>
                        <div class="card-content">
                            <table class="keybinds-table">
                                <thead>
                                    <tr><th>Action</th><th>Shortcut</th><th>Description</th></tr>
                                </thead>
                                <tbody>
                                    ${keybindActions.map(action => html`
                                        <tr>
                                            <td class="action-name">${action.name}</td>
                                            <td><input class="keybind-input" data-action="${action.key}" .value=${this.keybinds[action.key] || ''} @focus=${this.handleKeybindFocus} @keydown=${this.handleKeybindInput} readonly /></td>
                                            <td class="action-description">${action.description}</td>
                                        </tr>
                                    `)}
                                </tbody>
                            </table>
                            <button class="reset-keybinds-button" @click=${this.resetKeybinds}>Reset All Shortcuts</button>
                        </div>
                    </div>
                ` : ''}
                ${this.activeTab === 'advanced' ? html`
                    <div class="settings-card">
                        <div class="card-title"><span>⚙️</span> Advanced Settings</div>
                        <div class="card-content">
                            
                            <!-- Performance Section -->
                            <div style="margin-bottom: 24px;">
                                <h3 style="font-size: 14px; font-weight: 600; color: var(--accent-color); margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 8px;">
                                    <span>⚡</span> Performance Tuning
                                </h3>
                                
                                <div class="slider-header">
                                    <label class="form-label">Response Speed (Silence Trigger)</label>
                                    <span class="slider-value">${this.silenceThreshold}s</span>
                                </div>
                                <div class="slider-container">
                                    <input type="range" class="slider-input" min="0.1" max="1.0" step="0.1" .value=${this.silenceThreshold} @input=${this.handleSilenceChange} />
                                    <div class="slider-labels">
                                        <span>Instant (0.1s)</span>
                                        <span>Relaxed (1.0s)</span>
                                    </div>
                                </div>
                                <div class="form-description" style="margin-bottom: 16px;">How long to wait for silence before the AI responds. Lower = Faster.</div>

                                <div class="slider-header">
                                    <label class="form-label">Audio Latency (Chunk Speed)</label>
                                    <span class="slider-value">${this.audioChunkDuration || 0.25}s</span>
                                </div>
                                <div class="slider-container">
                                    <input type="range" class="slider-input" min="0.1" max="1.0" step="0.05" .value=${this.audioChunkDuration || 0.25} @input=${this.handleAudioChunkDurationChange} />
                                    <div class="slider-labels">
                                        <span>Extreme (0.1s)</span>
                                        <span>Stable (1.0s)</span>
                                    </div>
                                </div>
                                <div class="form-description">Controls processing frequency. 0.1s gives near real-time performance.</div>
                            </div>

                            <hr style="border: 0; border-top: 1px solid var(--card-border); margin: 0 0 24px 0;">

                            <!-- Interface Section -->
                            <div style="margin-bottom: 24px;">
                                <h3 style="font-size: 14px; font-weight: 600; color: var(--accent-color); margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 8px;">
                                    <span>🎨</span> Interface
                                </h3>

                                <div class="slider-header">
                                    <label class="form-label">Font Size</label>
                                    <span class="slider-value">${this.fontSize}px</span>
                                </div>
                                <div class="slider-container">
                                    <input type="range" class="slider-input" min="10" max="32" step="1" .value=${this.fontSize || 20} @input=${this.handleFontSizeChange} />
                                    <div class="slider-labels">
                                        <span>Small (10px)</span>
                                        <span>Large (32px)</span>
                                    </div>
                                </div>
                                <div class="form-description">Adjust text size for better readability.</div>
                            </div>

                            <hr style="border: 0; border-top: 1px solid var(--card-border); margin: 0 0 24px 0;">

                            <!-- Data Section -->
                            <div>
                                <h3 style="font-size: 14px; font-weight: 600; color: #ff6b6b; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 8px;">
                                    <span>⚠️</span> Danger Zone
                                </h3>
                                <button class="clear-data-btn" style="width: 100%; border-color: #ff6b6b; color: #ff6b6b;" @click=${() => { if (confirm('Reset all settings?')) { localStorage.clear(); location.reload(); } }}>
                                    Reset All App Data
                                </button>
                                <div class="form-description" style="text-align: center; margin-top: 8px;">This will wipe settings, resume context, and shortcuts.</div>
                            </div>
                        </div>
                    </div>
                ` : ''}
                ${this.activeTab === 'remote' ? html`
                    <remote-assistance-view></remote-assistance-view>
                ` : ''}
            </div>
        `;
    }
}

customElements.define('customize-view', CustomizeView);
