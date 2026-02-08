const { screen } = require('electron');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

/**
 * Ultra-Simple Input Simulator using Python for all input simulation
 * Base64 encodes JSON to avoid PowerShell quote escaping issues
 */
class UltraSimpleInputSimulator {
    constructor() {
        this.platform = process.platform;
        this.isWindows = this.platform === 'win32';
        this.isInitialized = false;

        console.log('Initializing UltraSimpleInputSimulator...');
    }

    async initialize() {
        try {
            if (this.isWindows) {
                console.log('UltraSimpleInputSimulator: Initialized (using Python for all input)');
                this.isInitialized = true;
            } else {
                console.warn('UltraSimpleInputSimulator only works on Windows');
                this.isInitialized = false;
            }
        } catch (error) {
            console.error('UltraSimpleInputSimulator: Initialization failed:', error.message);
            this.isInitialized = false;
        }
    }

    /**
     * Simulate mouse movement using Python script
     */
    async simulateMouseMove(x, y) {
        if (!this.isWindows) return;

        try {
            const path = require('path');
            const pythonScript = path.join(__dirname, 'python_input.py');

            const event = {
                type: 'mousemove',
                x: x,
                y: y
            };

            // Base64 encode to avoid PowerShell quote escaping issues
            const eventJson = JSON.stringify(event);
            const base64Event = Buffer.from(eventJson).toString('base64');
            await execPromise(`python "${pythonScript}" "${base64Event}"`);
        } catch (error) {
            // Silently ignore mouse move errors
        }
    }

    /**
     * Simulate mouse click using Python script
     */
    async simulateMouseClick(button, down) {
        if (!this.isWindows) return;

        try {
            const path = require('path');
            const pythonScript = path.join(__dirname, 'python_input.py');

            const event = {
                type: down ? 'mousedown' : 'mouseup',
                button: button || 'left'
            };

            // Base64 encode to avoid PowerShell quote escaping issues
            const eventJson = JSON.stringify(event);
            const base64Event = Buffer.from(eventJson).toString('base64');
            await execPromise(`python "${pythonScript}" "${base64Event}"`);
        } catch (error) {
            console.error('❌ Click error:', error.message);
        }
    }

    /**
     * Simulate keyboard key press using Python script
     */
    async simulateKeyPress(key) {
        if (!this.isWindows) return;

        try {
            console.log('⌨️ Simulating key press:', key);

            const path = require('path');
            const pythonScript = path.join(__dirname, 'python_input.py');

            const event = {
                type: 'keypress',
                key: key
            };

            // Base64 encode to avoid PowerShell quote escaping issues
            const eventJson = JSON.stringify(event);
            const base64Event = Buffer.from(eventJson).toString('base64');
            await execPromise(`python "${pythonScript}" "${base64Event}"`);

            console.log('✅ Key sent:', key);
        } catch (error) {
            console.error('❌ Key error:', error.message);
        }
    }

    /**
     * Simulate input event
     */
    async simulateEvent(event) {
        console.log('🎯 simulateEvent called:', event.type, 'initialized:', this.isInitialized);

        if (!this.isInitialized) {
            console.warn('⚠️ Simulator not initialized!');
            return;
        }

        try {
            switch (event.type) {
                case 'mousemove':
                    await this.simulateMouseMove(event.x, event.y);
                    break;

                case 'mousedown':
                    console.log('🖱️ Mouse down detected');
                    await this.simulateMouseClick(event.button || 'left', true);
                    break;

                case 'mouseup':
                    console.log('🖱️ Mouse up detected');
                    await this.simulateMouseClick(event.button || 'left', false);
                    break;

                case 'click':
                    console.log('🖱️ Click detected');
                    await this.simulateMouseClick(event.button || 'left', true);
                    await new Promise(resolve => setTimeout(resolve, 50));
                    await this.simulateMouseClick(event.button || 'left', false);
                    break;

                case 'keypress':
                case 'keydown':
                    console.log('⌨️ Keyboard event detected, key:', event.key);
                    await this.simulateKeyPress(event.key);
                    break;

                default:
                    console.log('❓ Unknown event type:', event.type);
                    break;
            }
        } catch (error) {
            console.error('❌ Error in simulateEvent:', error);
        }
    }

    /**
     * Register IPC handlers for input simulation
     */
    registerIpcHandlers(ipcMain) {
        ipcMain.on('simulate-input', (event, inputEvent) => {
            console.log('🎮 IPC RECEIVED simulate-input event:', inputEvent.type, inputEvent);
            this.simulateEvent(inputEvent);
        });
        console.log('UltraSimpleInputSimulator: IPC handlers registered');
    }
}

// Singleton instance
let inputSimulatorInstance = null;

/**
 * Get or create the input simulator instance
 */
function getInputSimulator() {
    if (!inputSimulatorInstance) {
        inputSimulatorInstance = new UltraSimpleInputSimulator();
        inputSimulatorInstance.initialize();
    }
    return inputSimulatorInstance;
}

module.exports = { UltraSimpleInputSimulator, getInputSimulator };
