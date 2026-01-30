if (require('electron-squirrel-startup')) {
    process.exit(0);
}

const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { app, BrowserWindow, shell, ipcMain } = require('electron');
const { createWindow, updateGlobalShortcuts } = require('./utils/window');
const { setupOpenAIIpcHandlers, stopMacOSAudioCapture, sendToRenderer } = require('./utils/openai');

const openaiSessionRef = { current: null };
let mainWindow = null;

function createMainWindow() {
    mainWindow = createWindow(sendToRenderer, openaiSessionRef);
    return mainWindow;
}

app.whenReady().then(() => {
    createMainWindow();
    setupGeneralIpcHandlers(); // Register general handlers FIRST
    setupOpenAIIpcHandlers(openaiSessionRef);
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
