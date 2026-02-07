const { exec } = require('child_process');
const { screen } = require('electron');
const util = require('util');
const execPromise = util.promisify(exec);

/**
 * Simple Windows Input Simulator using PowerShell
 * Fallback when robotjs/@nut-tree are not available
 */
class WindowsInputSimulator {
    constructor() {
        this.platform = process.platform;
        this.isWindows = this.platform === 'win32';

        if (!this.isWindows) {
            console.warn('WindowsInputSimulator only works on Windows');
        }

        console.log('Initialized Windows PowerShell input simulator');
    }

    /**
     * Simulate mouse movement using PowerShell
     */
    async simulateMouseMove(x, y) {
        if (!this.isWindows) return;

        const display = screen.getPrimaryDisplay();
        const { width, height } = display.size;
        const screenX = Math.round(x * width);
        const screenY = Math.round(y * height);

        const script = `
            Add-Type -AssemblyName System.Windows.Forms
            [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${screenX}, ${screenY})
        `;

        try {
            await execPromise(`powershell -Command "${script.replace(/\n/g, ' ')}"`);
        } catch (error) {
            // Ignore errors for performance
        }
    }

    /**
     * Simulate mouse click using PowerShell
     */
    async simulateMouseClick(button, down) {
        if (!this.isWindows) return;

        const eventMap = {
            left: down ? 0x0002 : 0x0004,   // MOUSEEVENTF_LEFTDOWN : MOUSEEVENTF_LEFTUP
            right: down ? 0x0008 : 0x0010,  // MOUSEEVENTF_RIGHTDOWN : MOUSEEVENTF_RIGHTUP
            middle: down ? 0x0020 : 0x0040  // MOUSEEVENTF_MIDDLEDOWN : MOUSEEVENTF_MIDDLEUP
        };

        const event = eventMap[button] || eventMap.left;

        // Define C# P/Invoke signature for mouse_event
        // formatted as a single line string to avoid PowerShell parsing issues with exec
        const typeDefinition = `
            using System;
            using System.Runtime.InteropServices;
            public class MouseSim {
                [DllImport("user32.dll")]
                public static extern void mouse_event(int dwFlags, int dx, int dy, int dwData, int dwExtraInfo);
            }
        `.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

        const script = `
            try {
                Add-Type -TypeDefinition '${typeDefinition}'
                [MouseSim]::mouse_event(${event}, 0, 0, 0, 0)
            } catch {
                # Ignore types already added errors
                [MouseSim]::mouse_event(${event}, 0, 0, 0, 0)
            }
        `;

        try {
            await execPromise(`powershell -Command "${script.replace(/\n/g, ' ')}"`);
        } catch (error) {
            console.error('Error simulating click:', error.message);
        }
    }

    /**
     * Simulate key press using PowerShell SendKeys
     */
    async simulateKeyPress(key) {
        if (!this.isWindows) return;

        // Map web keys to SendKeys format
        const keyMap = {
            'Enter': '{ENTER}',
            'Backspace': '{BACKSPACE}',
            'Tab': '{TAB}',
            'Escape': '{ESC}',
            'Delete': '{DELETE}',
            'ArrowUp': '{UP}',
            'ArrowDown': '{DOWN}',
            'ArrowLeft': '{LEFT}',
            'ArrowRight': '{RIGHT}',
            ' ': ' '
        };

        const mappedKey = keyMap[key] || key;

        const script = `
            Add-Type -AssemblyName System.Windows.Forms
            [System.Windows.Forms.SendKeys]::SendWait("${mappedKey}")
        `;

        try {
            await execPromise(`powershell -Command "${script.replace(/\n/g, ' ')}"`);
        } catch (error) {
            console.error('Error simulating key:', error.message);
        }
    }

    /**
     * Simulate input event
     */
    async simulateEvent(event) {
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
                    await new Promise(resolve => setTimeout(resolve, 50));
                    await this.simulateMouseClick(event.button || 'left', false);
                    break;

                case 'keypress':
                case 'keydown':
                    await this.simulateKeyPress(event.key);
                    break;

                default:
                    console.log('Unsupported event type:', event.type);
            }
        } catch (error) {
            console.error('Error in simulateEvent:', error);
        }
    }
}

module.exports = { WindowsInputSimulator };
