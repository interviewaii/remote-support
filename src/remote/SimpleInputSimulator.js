const { screen } = require('electron');

/**
 * Reliable Windows Input Simulator using node-key-sender + Windows APIs
 * Works without native compilation
 */
class SimpleInputSimulator {
    constructor() {
        this.platform = process.platform;
        this.isWindows = this.platform === 'win32';
        this.isInitialized = false;
        this.ks = null;

        console.log('Initializing SimpleInputSimulator...');
    }

    async initialize() {
        try {
            if (this.isWindows) {
                // Load node-key-sender for keyboard
                this.ks = require('node-key-sender');
                console.log('SimpleInputSimulator: Initialized with node-key-sender');
                this.isInitialized = true;
            } else {
                console.warn('SimpleInputSimulator only works on Windows');
                this.isInitialized = false;
            }
        } catch (error) {
            console.error('SimpleInputSimulator: Initialization failed:', error.message);
            this.isInitialized = false;
        }
    }

    /**
     * Simulate mouse movement using Windows SetCursorPos
     */
    async simulateMouseMove(x, y) {
        if (!this.isWindows) return;

        try {
            const display = screen.getPrimaryDisplay();
            const { width, height } = display.size;
            const screenX = Math.round(x * width);
            const screenY = Math.round(y * height);

            // Use FFI to call SetCursorPos directly
            const ffi = require('ffi-napi');
            const user32 = ffi.Library('user32', {
                'SetCursorPos': ['bool', ['int', 'int']]
            });

            user32.SetCursorPos(screenX, screenY);
        } catch (error) {
            // FFI not available, skip
        }
    }

    /**
     * Simulate mouse click using Windows SendInput API
     */
    async simulateMouseClick(button, down) {
        if (!this.isWindows) return;

        try {
            // Use PowerShell with SendInput for reliable clicking
            const { exec } = require('child_process');
            const util = require('util');
            const execPromise = util.promisify(exec);

            // Map button events to Windows mouse event flags
            const eventMap = {
                'left': down ? 2 : 4,     // MOUSEEVENTF_LEFTDOWN : MOUSEEVENTF_LEFTUP
                'right': down ? 8 : 16,   // MOUSEEVENTF_RIGHTDOWN : MOUSEEVENTF_RIGHTUP
                'middle': down ? 32 : 64  // MOUSEEVENTF_MIDDLEDOWN : MOUSEEVENTF_MIDDLEUP
            };

            const event = eventMap[button] || eventMap['left'];

            // Use Windows Forms to simulate mouse click
            const script = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Cursor]::Position = [System.Windows.Forms.Cursor]::Position; Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern void mouse_event(int flags, int dx, int dy, int dwData, int extraInfo);' -Name M -Namespace W; [W.M]::mouse_event(${event}, 0, 0, 0, 0)`;

            await execPromise(`powershell -NoProfile -Command "${script}"`);
        } catch (error) {
            // Silently ignore to prevent crashes
        }
    }

    /**
     * Simulate keyboard key press
     */
    async simulateKeyPress(key) {
        if (!this.isWindows || !this.ks) return;

        try {
            // Map special keys
            const keyMap = {
                'Enter': '{enter}',
                'Backspace': '{backspace}',
                'Tab': '{tab}',
                'Escape': '{esc}',
                'Delete': '{delete}',
                'ArrowUp': '{up}',
                'ArrowDown': '{down}',
                'ArrowLeft': '{left}',
                'ArrowRight': '{right}',
                ' ': '{space}'
            };

            const mappedKey = keyMap[key] || key;
            await this.ks.sendKeys([mappedKey]);
        } catch (error) {
            console.error('Error simulating key:', error.message);
        }
    }

    /**
     * Simulate input event
     */
    async simulateEvent(event) {
        if (!this.isInitialized) {
            return;
        }

        try {
            switch (event.type) {
                case 'mousemove':
                    await this.simulateMouseMove(event.x, event.y);
                    break;

                case 'mousedown':
                    await this.simulateMouseClick(event.button || 'left', true);
                    break;

                case 'mouseup':
                    await this.simulateMouseClick(event.button || 'left', false);
                    break;

                case 'click':
                    await this.simulateMouseClick(event.button || 'left', true);
                    break;

                case 'keypress':
                case 'keydown':
                    await this.simulateKeyPress(event.key);
                    break;

                default:
                    // Ignore unknown event types
                    break;
            }
        } catch (error) {
            // Silently handle errors to prevent crashes
        }
    }

    /**
     * Register IPC handlers for input simulation
     */
    registerIpcHandlers(ipcMain) {
        ipcMain.on('simulate-input', (event, inputEvent) => {
            this.simulateEvent(inputEvent);
        });
        console.log('SimpleInputSimulator: IPC handlers registered');
    }
}

// Singleton instance
let inputSimulatorInstance = null;

/**
 * Get or create the input simulator instance
 */
function getInputSimulator() {
    if (!inputSimulatorInstance) {
        inputSimulatorInstance = new SimpleInputSimulator();
        inputSimulatorInstance.initialize();
    }
    return inputSimulatorInstance;
}

module.exports = { SimpleInputSimulator, getInputSimulator };
