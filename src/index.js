if (require('electron-squirrel-startup')) {
    process.exit(0);
}

const path = require('node:path');
const { app, BrowserWindow, shell, ipcMain, desktopCapturer } = require('electron');

const envPath = app.isPackaged
    ? path.join(process.resourcesPath, '.env')
    : path.join(__dirname, '../.env');
require('dotenv').config({ path: envPath });
const { createWindow, updateGlobalShortcuts } = require('./utils/window');
const { setupOpenAIIpcHandlers, stopMacOSAudioCapture, sendToRenderer, triggerManualAnswer, setManualMode } = require('./utils/openai');
const { getInputSimulator } = require('./remote/SimpleInputSimulator');

const openaiSessionRef = {
    current: null,
    triggerManualAnswer: triggerManualAnswer,
    setManualMode: setManualMode
};
let mainWindow = null;

function createMainWindow() {
    mainWindow = createWindow(sendToRenderer, openaiSessionRef);
    return mainWindow;
}

// Disable hardware acceleration to prevent GPU process crashes (Fix for Black Window/Crash)
app.disableHardwareAcceleration();

app.whenReady().then(() => {
    createMainWindow();
    setupGeneralIpcHandlers(); // Register general handlers FIRST
    setupOpenAIIpcHandlers(openaiSessionRef);
    setupRemoteAssistanceHandlers(); // Setup remote assistance
});

app.on('window-all-closed', () => {
    stopMacOSAudioCapture();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    stopMacOSAudioCapture();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
    }
});

function setupGeneralIpcHandlers() {
    ipcMain.handle('quit-application', async event => {
        try {
            stopMacOSAudioCapture();
            app.quit();
            return { success: true };
        } catch (error) {
            console.error('Error quitting application:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('open-external', async (event, url) => {
        try {
            await shell.openExternal(url);
            return { success: true };
        } catch (error) {
            console.error('Error opening external URL:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.on('update-keybinds', (event, newKeybinds) => {
        if (mainWindow) {
            updateGlobalShortcuts(newKeybinds, mainWindow, sendToRenderer, openaiSessionRef);
        }
    });

    ipcMain.handle('update-content-protection', async event => {
        try {
            if (mainWindow) {
                // Get content protection setting from localStorage via window.cheddar
                const contentProtection = await mainWindow.webContents.executeJavaScript(
                    'window.interviewAI ? window.interviewAI.getContentProtection() : true'
                );
                mainWindow.setContentProtection(contentProtection);
                console.log('Content protection updated:', contentProtection);
            }
            return { success: true };
        } catch (error) {
            console.error('Error updating content protection:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('get-machine-id', async () => {
        try {
            const { machineIdSync } = require('node-machine-id');
            const machineId = machineIdSync();
            return machineId;
        } catch (error) {
            console.error('Error getting machine ID:', error);
            return null;
        }
    });
}

function setupRemoteAssistanceHandlers() {
    // Initialize input simulator
    const inputSimulator = getInputSimulator();
    inputSimulator.registerIpcHandlers(ipcMain);

    // Handle screen source requests for screen capture
    ipcMain.handle('get-screen-sources', async () => {
        try {
            const sources = await desktopCapturer.getSources({
                types: ['screen', 'window'], // Include both screens and windows
                thumbnailSize: { width: 150, height: 150 }
            });

            return sources.map(source => ({
                id: source.id,
                name: source.name,
                thumbnail: source.thumbnail.toDataURL(),
                type: source.id.startsWith('screen') ? 'screen' : 'window'
            }));
        } catch (error) {
            console.error('Error getting screen sources:', error);
            return [];
        }
    });

    // Handle request for main app window source specifically
    ipcMain.handle('get-app-window-source', async () => {
        try {
            const sources = await desktopCapturer.getSources({
                types: ['window'],
                thumbnailSize: { width: 150, height: 150 }
            });

            console.log('Available windows:', sources.map(s => s.name));

            // Get the main window's native window ID  
            if (mainWindow && !mainWindow.isDestroyed()) {
                const windowId = mainWindow.getMediaSourceId();
                console.log('Main window ID:', windowId);

                // Find by exact window ID match
                const appWindow = sources.find(source => source.id === windowId);

                if (appWindow) {
                    console.log('Found app window by ID:', appWindow.name);
                    return {
                        id: appWindow.id,
                        name: appWindow.name,
                        thumbnail: appWindow.thumbnail.toDataURL(),
                        type: 'window'
                    };
                }
            }

            // Fallback: Try to find by name
            const appWindow = sources.find(source =>
                source.name.toLowerCase().includes('interview') ||
                source.name.toLowerCase().includes('desire') ||
                source.name.toLowerCase().includes(app.getName().toLowerCase())
            );

            if (appWindow) {
                console.log('Found app window by name:', appWindow.name);
                return {
                    id: appWindow.id,
                    name: appWindow.name,
                    thumbnail: appWindow.thumbnail.toDataURL(),
                    type: 'window'
                };
            }

            console.warn('App window not found! Available windows:', sources.map(s => s.name));
            return null;
        } catch (error) {
            console.error('Error getting app window source:', error);
            return null;
        }
    });

    console.log('Remote assistance handlers initialized');
}

