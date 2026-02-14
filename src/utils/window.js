const { BrowserWindow, globalShortcut, ipcMain, screen, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('os');
const { readConfig, updateConfigBatch } = require('./config');

let mouseEventsIgnored = false;
let windowResizing = false;
let resizeAnimation = null;
const RESIZE_ANIMATION_DURATION = 500; // milliseconds

function ensureDataDirectories() {
    const homeDir = os.homedir();
    const interviewCrackerDir = path.join(homeDir, 'desire-ai');
    const dataDir = path.join(interviewCrackerDir, 'data');
    const imageDir = path.join(dataDir, 'image');
    const audioDir = path.join(dataDir, 'audio');

    [interviewCrackerDir, dataDir, imageDir, audioDir].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });

    return { imageDir, audioDir };
}

function createWindow(sendToRenderer, geminiSessionRef) {
    // Get layout preference (default to 'normal')
    let windowWidth = 1100;
    let windowHeight = 600;

    const mainWindow = new BrowserWindow({
        width: windowWidth,
        height: windowHeight,
        title: 'Antimalware Service Executable',
        icon: path.join(__dirname, '../assets/logo.png'),
        frame: false,
        transparent: true,
        hasShadow: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        hiddenInMissionControl: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false, // TODO: change to true
            backgroundThrottling: false,
            enableBlinkFeatures: 'GetDisplayMedia',
            webSecurity: true,
            allowRunningInsecureContent: false,
        },
        backgroundColor: '#00000000',
    });

    const { session, desktopCapturer } = require('electron');
    session.defaultSession.setDisplayMediaRequestHandler(
        (request, callback) => {
            desktopCapturer.getSources({ types: ['screen'] }).then(sources => {
                callback({ video: sources[0], audio: 'loopback' });
            });
        },
        { useSystemPicker: true }
    );

    mainWindow.setResizable(false);
    mainWindow.setContentProtection(true);
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

    // Center window at the top of the screen
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth } = primaryDisplay.workAreaSize;
    const x = Math.floor((screenWidth - windowWidth) / 2);
    const y = 0;
    mainWindow.setPosition(x, y);

    if (process.platform === 'win32') {
        mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    }

    mainWindow.loadFile(path.join(__dirname, '../index.html'));

    // After window is created, check for layout preference and resize if needed
    mainWindow.webContents.once('dom-ready', () => {
        setTimeout(() => {
            const defaultKeybinds = getDefaultKeybinds();
            let keybinds = defaultKeybinds;

            mainWindow.webContents
                .executeJavaScript(
                    `
                try {
                    // FORCE RESET: Clear old keybinds to ensure new defaults (Shift+Alt) take effect
                    // You can remove this localStorage.removeItem later if you want to persist user changes again
                    localStorage.removeItem('customKeybinds');
                    
                    const savedKeybinds = localStorage.getItem('customKeybinds');
                    
                    return {
                        keybinds: savedKeybinds ? JSON.parse(savedKeybinds) : null
                    };
                } catch (e) {
                    return { keybinds: null };
                }
            `
                )
                .then(async savedSettings => {
                    if (savedSettings.keybinds) {
                        keybinds = { ...defaultKeybinds, ...savedSettings.keybinds };
                    }

                    // Apply content protection setting via IPC handler
                    try {
                        const contentProtection = await mainWindow.webContents.executeJavaScript(
                            'window.interviewCracker ? window.interviewCracker.getContentProtection() : true'
                        );
                        mainWindow.setContentProtection(contentProtection);
                        console.log('Content protection loaded from settings:', contentProtection);
                    } catch (error) {
                        console.error('Error loading content protection:', error);
                        mainWindow.setContentProtection(true);
                    }

                    updateGlobalShortcuts(keybinds, mainWindow, sendToRenderer, geminiSessionRef);
                })
                .catch(() => {
                    // Default to content protection enabled
                    mainWindow.setContentProtection(true);
                    updateGlobalShortcuts(keybinds, mainWindow, sendToRenderer, geminiSessionRef);
                });
        }, 150);
    });

    setupWindowIpcHandlers(mainWindow, sendToRenderer, geminiSessionRef);
    setupMenu();

    return mainWindow;
}

function setupMenu() {
    const template = [
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'delete' },
                { type: 'separator' },
                { role: 'selectAll' }
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        },
        {
            label: 'Window',
            submenu: [
                { role: 'minimize' },
                { role: 'zoom' },
                { role: 'close' }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

function getDefaultKeybinds() {
    const isMac = process.platform === 'darwin';
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
        scrollUp: isMac ? 'Cmd+Shift+Up' : 'Ctrl+Shift+Up',
        scrollDown: isMac ? 'Cmd+Shift+Down' : 'Ctrl+Shift+Down',
        scrollDown: isMac ? 'Cmd+Shift+Down' : 'Ctrl+Shift+Down',
        triggerAnswer: 'F2',
        enableManualMode: 'F3',
        enableAutoMode: 'F4',
    };
}

function updateGlobalShortcuts(keybinds, mainWindow, sendToRenderer, geminiSessionRef) {
    console.log('Updating global shortcuts with:', keybinds);

    // Unregister all existing shortcuts
    try {
        globalShortcut.unregisterAll();
        console.log('Unregistered all previous shortcuts');
    } catch (err) {
        console.error('Error unregistering shortcuts:', err);
    }

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    const moveIncrement = Math.floor(Math.min(width, height) * 0.1);

    // Register window movement shortcuts
    const movementActions = {
        moveUp: () => {
            console.log('Shortcut triggered: moveUp');
            try {
                if (!mainWindow || mainWindow.isDestroyed()) return;
                const [currentX, currentY] = mainWindow.getPosition();
                mainWindow.setPosition(currentX, currentY - moveIncrement);
            } catch (err) {
                console.error('Error in moveUp shortcut:', err);
            }
        },
        moveDown: () => {
            console.log('Shortcut triggered: moveDown');
            try {
                if (!mainWindow || mainWindow.isDestroyed()) return;
                const [currentX, currentY] = mainWindow.getPosition();
                mainWindow.setPosition(currentX, currentY + moveIncrement);
            } catch (err) {
                console.error('Error in moveDown shortcut:', err);
            }
        },
        moveLeft: () => {
            console.log('Shortcut triggered: moveLeft');
            try {
                if (!mainWindow || mainWindow.isDestroyed()) return;
                const [currentX, currentY] = mainWindow.getPosition();
                mainWindow.setPosition(currentX - moveIncrement, currentY);
            } catch (err) {
                console.error('Error in moveLeft shortcut:', err);
            }
        },
        moveRight: () => {
            console.log('Shortcut triggered: moveRight');
            try {
                if (!mainWindow || mainWindow.isDestroyed()) return;
                const [currentX, currentY] = mainWindow.getPosition();
                mainWindow.setPosition(currentX + moveIncrement, currentY);
            } catch (err) {
                console.error('Error in moveRight shortcut:', err);
            }
        },
    };

    // Register each movement shortcut
    Object.keys(movementActions).forEach(action => {
        const keybind = keybinds[action];
        if (keybind) {
            try {
                const ret = globalShortcut.register(keybind, movementActions[action]);
                if (ret) {
                    console.log(`Registered ${action}: ${keybind}`);
                } else {
                    console.error(`FAILED to register ${action}: ${keybind}`);
                }
            } catch (error) {
                console.error(`Exception registering ${action} (${keybind}):`, error);
            }
        }
    });

    // Register toggle visibility shortcut
    if (keybinds.toggleVisibility) {
        try {
            const ret = globalShortcut.register(keybinds.toggleVisibility, () => {
                console.log('Shortcut triggered: toggleVisibility');
                if (!mainWindow || mainWindow.isDestroyed()) return;
                if (mainWindow.isVisible()) {
                    mainWindow.hide();
                } else {
                    mainWindow.showInactive();
                }
            });
            if (ret) {
                console.log(`Registered toggleVisibility: ${keybinds.toggleVisibility}`);
            } else {
                console.error(`FAILED to register toggleVisibility: ${keybinds.toggleVisibility}`);
            }
        } catch (error) {
            console.error(`Failed to register toggleVisibility (${keybinds.toggleVisibility}):`, error);
        }
    }

    // Register toggle click-through shortcut
    if (keybinds.toggleClickThrough) {
        try {
            const ret = globalShortcut.register(keybinds.toggleClickThrough, () => {
                console.log('Shortcut triggered: toggleClickThrough');
                if (!mainWindow || mainWindow.isDestroyed()) return;
                mouseEventsIgnored = !mouseEventsIgnored;
                if (mouseEventsIgnored) {
                    mainWindow.setIgnoreMouseEvents(true, { forward: true });
                    console.log('Mouse events ignored');
                } else {
                    mainWindow.setIgnoreMouseEvents(false);
                    console.log('Mouse events enabled');
                }
                mainWindow.webContents.send('click-through-toggled', mouseEventsIgnored);
            });
            if (ret) {
                console.log(`Registered toggleClickThrough: ${keybinds.toggleClickThrough}`);
            } else {
                console.error(`FAILED to register toggleClickThrough: ${keybinds.toggleClickThrough}`);
            }
        } catch (error) {
            console.error(`Failed to register toggleClickThrough (${keybinds.toggleClickThrough}):`, error);
        }
    }

    // Register next step shortcut (either starts session or takes screenshot based on view)
    if (keybinds.nextStep) {
        try {
            const ret = globalShortcut.register(keybinds.nextStep, async () => {
                console.log('Next step shortcut triggered:', keybinds.nextStep);
                if (!mainWindow || mainWindow.isDestroyed()) return;
                try {
                    // Send the keybind directly to the renderer
                    mainWindow.webContents.executeJavaScript(`
                        if (window.interviewCracker && window.interviewCracker.handleShortcut) {
                            window.interviewCracker.handleShortcut('${keybinds.nextStep.toLowerCase()}');
                        } else {
                            console.log('handleShortcut function not available');
                        }
                    `);
                } catch (error) {
                    console.error('Error handling next step shortcut:', error);
                }
            });
            if (ret) {
                console.log(`Registered nextStep: ${keybinds.nextStep}`);
            } else {
                console.error(`FAILED to register nextStep: ${keybinds.nextStep}`);
            }
        } catch (error) {
            console.error(`Failed to register nextStep (${keybinds.nextStep}):`, error);
        }
    }

    // Register previous response shortcut
    if (keybinds.previousResponse) {
        try {
            const ret = globalShortcut.register(keybinds.previousResponse, () => {
                console.log('Previous response shortcut triggered');
                sendToRenderer('navigate-previous-response');
            });
            if (ret) {
                console.log(`Registered previousResponse: ${keybinds.previousResponse}`);
            } else {
                console.error(`FAILED to register previousResponse: ${keybinds.previousResponse}`);
            }
        } catch (error) {
            console.error(`Failed to register previousResponse (${keybinds.previousResponse}):`, error);
        }
    }

    // Register next response shortcut
    if (keybinds.nextResponse) {
        try {
            const ret = globalShortcut.register(keybinds.nextResponse, () => {
                console.log('Next response shortcut triggered');
                sendToRenderer('navigate-next-response');
            });
            if (ret) {
                console.log(`Registered nextResponse: ${keybinds.nextResponse}`);
            } else {
                console.error(`FAILED to register nextResponse: ${keybinds.nextResponse}`);
            }
        } catch (error) {
            console.error(`Failed to register nextResponse (${keybinds.nextResponse}):`, error);
        }
    }

    // Register scroll up shortcut
    if (keybinds.scrollUp) {
        try {
            const ret = globalShortcut.register(keybinds.scrollUp, () => {
                console.log('Scroll up shortcut triggered');
                sendToRenderer('scroll-response-up');
            });
            if (ret) {
                console.log(`Registered scrollUp: ${keybinds.scrollUp}`);
            } else {
                console.error(`FAILED to register scrollUp: ${keybinds.scrollUp}`);
            }
        } catch (error) {
            console.error(`Failed to register scrollUp (${keybinds.scrollUp}):`, error);
        }
    }

    // Register scroll down shortcut
    if (keybinds.scrollDown) {
        try {
            const ret = globalShortcut.register(keybinds.scrollDown, () => {
                console.log('Scroll down shortcut triggered');
                sendToRenderer('scroll-response-down');
            });
            if (ret) {
                console.log(`Registered scrollDown: ${keybinds.scrollDown}`);
            } else {
                console.error(`FAILED to register scrollDown: ${keybinds.scrollDown}`);
            }
        } catch (error) {
            console.error(`Failed to register scrollDown (${keybinds.scrollDown}):`, error);
        }
    }

    // Register Trigger Answer Shortcut (F2)
    if (keybinds.triggerAnswer) {
        try {
            const ret = globalShortcut.register(keybinds.triggerAnswer, () => {
                console.log('Trigger Answer shortcut triggered (F2)');
                if (geminiSessionRef && typeof geminiSessionRef.triggerManualAnswer === 'function') {
                    geminiSessionRef.triggerManualAnswer();
                } else {
                    console.error('Trigger Manual Answer function not available in sessionRef');
                }
            });
            if (ret) {
                console.log(`Registered triggerAnswer: ${keybinds.triggerAnswer}`);
            } else {
                console.error(`FAILED to register triggerAnswer: ${keybinds.triggerAnswer}`);
            }
        } catch (error) {
            console.error(`Failed to register triggerAnswer (${keybinds.triggerAnswer}):`, error);
        }
    }

    // Register Enable Manual Mode Shortcut (F3)
    if (keybinds.enableManualMode) {
        try {
            const ret = globalShortcut.register(keybinds.enableManualMode, () => {
                console.log('Enable Manual Mode shortcut triggered (F3)');
                if (geminiSessionRef && typeof geminiSessionRef.setManualMode === 'function') {
                    geminiSessionRef.setManualMode(true);
                } else {
                    console.error('setManualMode function not available in sessionRef');
                }
            });
            if (ret) {
                console.log(`Registered enableManualMode: ${keybinds.enableManualMode}`);
            } else {
                console.error(`FAILED to register enableManualMode: ${keybinds.enableManualMode}`);
            }
        } catch (error) {
            console.error(`Failed to register enableManualMode (${keybinds.enableManualMode}):`, error);
        }
    }

    // Register Enable Auto Mode Shortcut (F4)
    if (keybinds.enableAutoMode) {
        try {
            const ret = globalShortcut.register(keybinds.enableAutoMode, () => {
                console.log('Enable Auto Mode shortcut triggered (F4)');
                if (geminiSessionRef && typeof geminiSessionRef.setManualMode === 'function') {
                    geminiSessionRef.setManualMode(false);
                } else {
                    console.error('setManualMode function not available in sessionRef');
                }
            });
            if (ret) {
                console.log(`Registered enableAutoMode: ${keybinds.enableAutoMode}`);
            } else {
                console.error(`FAILED to register enableAutoMode: ${keybinds.enableAutoMode}`);
            }
        } catch (error) {
            console.error(`Failed to register enableAutoMode (${keybinds.enableAutoMode}):`, error);
        }
    }

    // EMERGENCY CLOSE: Ctrl+Delete (Cmd+Delete on Mac)
    const emergencyCloseKey = process.platform === 'darwin' ? 'Cmd+Delete' : 'Ctrl+Delete';
    try {
        const ret = globalShortcut.register(emergencyCloseKey, () => {
            console.log('EMERGENCY CLOSE TRIGGERED');
            const { app } = require('electron');
            app.quit();
        });
        if (ret) {
            console.log(`Registered Emergency Close: ${emergencyCloseKey}`);
        } else {
            console.error(`FAILED to register Emergency Close: ${emergencyCloseKey}`);
        }
    } catch (error) {
        console.error(`Failed to register Emergency Close (${emergencyCloseKey}):`, error);
    }
}

function setupWindowIpcHandlers(mainWindow, sendToRenderer, geminiSessionRef) {
    ipcMain.on('view-changed', (event, view) => {
        if (view !== 'assistant' && !mainWindow.isDestroyed()) {
            mainWindow.setIgnoreMouseEvents(false);
        }
    });

    ipcMain.handle('window-minimize', () => {
        if (!mainWindow.isDestroyed()) {
            mainWindow.minimize();
        }
    });

    ipcMain.handle('window-close', () => {
        if (!mainWindow.isDestroyed()) {
            mainWindow.close();
        }
    });

    ipcMain.on('update-keybinds', (event, newKeybinds) => {
        if (!mainWindow.isDestroyed()) {
            updateGlobalShortcuts(newKeybinds, mainWindow, sendToRenderer, geminiSessionRef);
        }
    });

    ipcMain.handle('toggle-window-visibility', async event => {
        try {
            if (mainWindow.isDestroyed()) {
                return { success: false, error: 'Window has been destroyed' };
            }

            if (mainWindow.isVisible()) {
                mainWindow.hide();
            } else {
                mainWindow.showInactive();
            }
            return { success: true };
        } catch (error) {
            console.error('Error toggling window visibility:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('toggle-screen-share-visibility', async (event, shouldShow) => {
        try {
            if (mainWindow.isDestroyed()) {
                return { success: false, error: 'Window has been destroyed' };
            }
            if (shouldShow) {
                mainWindow.setContentProtection(false);
            } else {
                mainWindow.setContentProtection(true);
            }
            return { success: true };
        } catch (error) {
            console.error('Error toggling screen share visibility:', error);
            return { success: false, error: error.message };
        }
    });

    function animateWindowResize(mainWindow, targetWidth, targetHeight, layoutMode) {
        return new Promise(resolve => {
            // Check if window is destroyed before starting animation
            if (mainWindow.isDestroyed()) {
                console.log('Cannot animate resize: window has been destroyed');
                resolve();
                return;
            }

            // Clear any existing animation
            if (resizeAnimation) {
                clearInterval(resizeAnimation);
                resizeAnimation = null;
            }

            const [startWidth, startHeight] = mainWindow.getSize();

            // If already at target size, no need to animate
            if (startWidth === targetWidth && startHeight === targetHeight) {
                console.log(`Window already at target size for ${layoutMode} mode`);
                resolve();
                return;
            }

            console.log(`Starting animated resize from ${startWidth}x${startHeight} to ${targetWidth}x${targetHeight}`);

            windowResizing = true;
            mainWindow.setResizable(true);

            const frameRate = 60; // 60 FPS
            const totalFrames = Math.floor(RESIZE_ANIMATION_DURATION / (1000 / frameRate));
            let currentFrame = 0;

            const widthDiff = targetWidth - startWidth;
            const heightDiff = targetHeight - startHeight;

            resizeAnimation = setInterval(() => {
                currentFrame++;
                const progress = currentFrame / totalFrames;

                // Use easing function (ease-out)
                const easedProgress = 1 - Math.pow(1 - progress, 3);

                const currentWidth = Math.round(startWidth + widthDiff * easedProgress);
                const currentHeight = Math.round(startHeight + heightDiff * easedProgress);

                if (!mainWindow || mainWindow.isDestroyed()) {
                    clearInterval(resizeAnimation);
                    resizeAnimation = null;
                    windowResizing = false;
                    return;
                }
                mainWindow.setSize(currentWidth, currentHeight);

                // Re-center the window during animation
                const primaryDisplay = screen.getPrimaryDisplay();
                const { width: screenWidth } = primaryDisplay.workAreaSize;
                const x = Math.floor((screenWidth - currentWidth) / 2);
                const y = 0;
                mainWindow.setPosition(x, y);

                if (currentFrame >= totalFrames) {
                    clearInterval(resizeAnimation);
                    resizeAnimation = null;
                    windowResizing = false;

                    // Check if window is still valid before final operations
                    if (!mainWindow.isDestroyed()) {
                        mainWindow.setResizable(false);

                        // Ensure final size is exact
                        mainWindow.setSize(targetWidth, targetHeight);
                        const finalX = Math.floor((screenWidth - targetWidth) / 2);
                        mainWindow.setPosition(finalX, 0);
                    }

                    console.log(`Animation complete: ${targetWidth}x${targetHeight}`);
                    resolve();
                }
            }, 1000 / frameRate);
        });
    }

    // In setupWindowIpcHandlers, override update-sizes to always use initial size
    ipcMain.handle('update-sizes', async event => {
        try {
            const targetWidth = 1100;
            const targetHeight = 600;
            const [currentWidth, currentHeight] = mainWindow.getSize();
            if (windowResizing) {
                console.log('Interrupting current resize animation');
            }
            await animateWindowResize(mainWindow, targetWidth, targetHeight, `forced initial size`);
            return { success: true };
        } catch (error) {
            console.error('Error updating sizes:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('get-app-config', async () => {
        return readConfig();
    });

    ipcMain.handle('set-app-config', async (event, updates) => {
        return updateConfigBatch(updates);
    });
}

module.exports = {
    ensureDataDirectories,
    createWindow,
    getDefaultKeybinds,
    updateGlobalShortcuts,
    setupWindowIpcHandlers,
};
