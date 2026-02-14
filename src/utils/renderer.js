// renderer.js
const { ipcRenderer } = require('electron');

let mediaStream = null;
let screenshotInterval = null;
let audioContext = null;
let audioProcessor = null;
let micAudioProcessor = null;
let audioBuffer = [];
const SAMPLE_RATE = 16000; // Standard Whisper Sample Rate
const AUDIO_CHUNK_DURATION = 0.25; // seconds - Optimized to 0.25s for "Immediate" (0.2s) analysis feel
const BUFFER_SIZE = 4096; // Increased buffer size for stability

let hiddenVideo = null;
let offscreenCanvas = null;
let offscreenContext = null;
let currentImageQuality = 'medium'; // Store current image quality for manual screenshots

const isLinux = process.platform === 'linux';
const isMacOS = process.platform === 'darwin';

// Token tracking system for rate limiting
let tokenTracker = {
    tokens: [], // Array of {timestamp, count, type} objects
    audioStartTime: null,

    // Add tokens to the tracker
    addTokens(count, type = 'image') {
        const now = Date.now();
        this.tokens.push({
            timestamp: now,
            count: count,
            type: type,
        });

        // Clean old tokens (older than 1 minute)
        this.cleanOldTokens();
    },

    // Calculate image tokens based on Gemini 2.0 rules
    calculateImageTokens(width, height) {
        // Images ≤384px in both dimensions = 258 tokens
        if (width <= 384 && height <= 384) {
            return 258;
        }

        // Larger images are tiled into 768x768 chunks, each = 258 tokens
        const tilesX = Math.ceil(width / 768);
        const tilesY = Math.ceil(height / 768);
        const totalTiles = tilesX * tilesY;

        return totalTiles * 258;
    },

    // Track audio tokens continuously
    trackAudioTokens() {
        if (!this.audioStartTime) {
            this.audioStartTime = Date.now();
            return;
        }

        const now = Date.now();
        const elapsedSeconds = (now - this.audioStartTime) / 1000;

        // Audio = 32 tokens per second
        const audioTokens = Math.floor(elapsedSeconds * 32);

        if (audioTokens > 0) {
            this.addTokens(audioTokens, 'audio');
            this.audioStartTime = now;
        }
    },

    // Clean tokens older than 1 minute
    cleanOldTokens() {
        const oneMinuteAgo = Date.now() - 60 * 1000;
        this.tokens = this.tokens.filter(token => token.timestamp > oneMinuteAgo);
    },

    // Get total tokens in the last minute
    getTokensInLastMinute() {
        this.cleanOldTokens();
        return this.tokens.reduce((total, token) => total + token.count, 0);
    },

    // Check if we should throttle based on settings
    shouldThrottle() {
        // Get rate limiting settings from localStorage
        const throttleEnabled = localStorage.getItem('throttleTokens') === 'true';
        if (!throttleEnabled) {
            return false;
        }

        const maxTokensPerMin = parseInt(localStorage.getItem('maxTokensPerMin') || '1000000', 10);
        const throttleAtPercent = parseInt(localStorage.getItem('throttleAtPercent') || '75', 10);

        const currentTokens = this.getTokensInLastMinute();
        const throttleThreshold = Math.floor((maxTokensPerMin * throttleAtPercent) / 100);

        console.log(`Token check: ${currentTokens}/${maxTokensPerMin} (throttle at ${throttleThreshold})`);

        return currentTokens >= throttleThreshold;
    },

    // Reset the tracker
    reset() {
        this.tokens = [];
        this.audioStartTime = null;
    },
};

// Track audio tokens every second for faster response
setInterval(() => {
    tokenTracker.trackAudioTokens();
}, 1000);

function interviewCrackerElement() {
    return document.getElementById('interview-ai');
}

function convertFloat32ToInt16(float32Array) {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
        // Improved scaling to prevent clipping
        const s = Math.max(-1, Math.min(1, float32Array[i]));
        int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return int16Array;
}

function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

async function initializeGemini(profile = 'interview', language = 'en-US') {
    // OpenAI API key - loaded from env in main process
    const apiKey = '';
    const silenceThreshold = localStorage.getItem('silenceThreshold') || '0.5';
    const success = await ipcRenderer.invoke('initialize-gemini', apiKey, localStorage.getItem('customPrompt') || '', localStorage.getItem('resumeContext') || '', profile, language, silenceThreshold);
    if (success) {
        interviewCrackerElement().setStatus('Live');
    } else {
        interviewCrackerElement().setStatus('error');
    }
}

// Listen for status updates
ipcRenderer.on('update-status', (event, status) => {
    console.log('Status update:', status);
    interviewCrackerElement().setStatus(status);
});

// Listen for user transcription updates (to show in UI)
ipcRenderer.on('update-transcription', (event, text) => {
    // console.log('User Transcription:', text);
    if (interviewCrackerElement().addUserMessage) {
        interviewCrackerElement().addUserMessage(text);
    }
});

// Listen for responses - REMOVED: This is handled in InterviewCrackerApp.js to avoid duplicates
// ipcRenderer.on('update-response', (event, response) => {
//     console.log('Gemini response:', response);
//     cheddar.e().setResponse(response);
//     // You can add UI elements to display the response if needed
// });

async function startCapture(screenshotIntervalSeconds = 2, imageQuality = 'medium') {
    console.log('🎤 [DEBUG] startCapture called with:', { screenshotIntervalSeconds, imageQuality });

    // Store the image quality for manual screenshots
    currentImageQuality = imageQuality;

    // Reset token tracker when starting new capture session
    tokenTracker.reset();
    console.log('🎯 Token tracker reset for new capture session');

    // EXPLICIT START SIGNAL: Reset backend flags
    ipcRenderer.invoke('start-listening').catch(err => console.error('Error starting listening:', err));

    try {
        console.log('🎤 [DEBUG] Platform detected:', process.platform);
        if (isMacOS) {
            // On macOS, use SystemAudioDump for audio and getDisplayMedia for screen
            console.log('Starting macOS capture with SystemAudioDump...');

            // Start macOS audio capture
            const audioResult = await ipcRenderer.invoke('start-macos-audio');
            if (!audioResult.success) {
                throw new Error('Failed to start macOS audio capture: ' + audioResult.error);
            }

            // Get screen capture for screenshots
            mediaStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    frameRate: 1,
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                },
                audio: false, // Don't use browser audio on macOS
            });

            console.log('macOS screen capture started - audio handled by SystemAudioDump');
        } else if (isLinux) {
            // Linux - use display media for screen capture and getUserMedia for microphone
            mediaStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    frameRate: 1,
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                },
                audio: false, // Don't use system audio loopback on Linux
            });

            // Get microphone input for Linux
            let micStream = null;
            try {
                micStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        sampleRate: SAMPLE_RATE,
                        channelCount: 1,
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                    },
                    video: false,
                });

                console.log('Linux microphone capture started');

                // Setup audio processing for microphone on Linux
                setupLinuxMicProcessing(micStream);
            } catch (micError) {
                console.warn('Failed to get microphone access on Linux:', micError);
                // Continue without microphone if permission denied
            }

            console.log('Linux screen capture started');
        } else {
            // Windows - use display media with loopback for system audio
            console.log('🎤 [DEBUG] Starting Windows audio capture...');
            try {
                console.log('🎤 [DEBUG] Requesting getDisplayMedia...');
                mediaStream = await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        frameRate: 1,
                        width: { ideal: 1920 },
                        height: { ideal: 1080 },
                    },
                    audio: {
                        sampleRate: SAMPLE_RATE,
                        channelCount: 1,
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                    },
                });
                console.log('✅ Windows system audio capture synchronized');
            } catch (err) {
                console.error('❌ Failed to get system audio:', err);
            }


            // Also get microphone for Windows
            // console.log('🎤 [DEBUG] Requesting microphone access...');
            let micStream = null;
            /* DISABLED PER USER REQUEST (System Audio Only)
            try {
                micStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        sampleRate: SAMPLE_RATE,
                        channelCount: 1,
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                    },
                    video: false,
                });
                console.log('✅ Windows microphone capture synchronized');
            } catch (micError) {
                console.error('❌ Failed to get microphone access on Windows:', micError);
            }
            */

            // Setup audio processing for Windows (System + Mic)
            console.log('🎤 [DEBUG] Setting up Windows audio processing...');
            setupWindowsAudioProcessing(mediaStream, null); // Pass null for Mic
            console.log('✅ Windows audio processing setup complete');
        }

        console.log('MediaStream obtained:', {
            hasVideo: mediaStream.getVideoTracks().length > 0,
            hasAudio: mediaStream.getAudioTracks().length > 0,
            videoTrack: mediaStream.getVideoTracks()[0]?.getSettings(),
        });

        // Start capturing screenshots - check if manual mode
        // FORCE MANUAL MODE: Comment out automatic logic to prevent ghost screenshots
        if (true || screenshotIntervalSeconds === 'manual' || screenshotIntervalSeconds === 'Manual') {
            console.log('Manual mode enabled - screenshots will be captured on demand only');
            // Don't start automatic capture in manual mode
        } else {
            // Automatic capture disabled for now
            const intervalMilliseconds = parseInt(screenshotIntervalSeconds) * 1000;
            // screenshotInterval = setInterval(() => captureScreenshot(imageQuality), intervalMilliseconds);
            // setTimeout(() => captureScreenshot(imageQuality), 100);
        }
    } catch (err) {
        console.error('Error starting capture:', err);
        interviewCrackerElement().setStatus('error');
    }
}

function setupLinuxMicProcessing(micStream) {
    // Setup microphone audio processing for Linux
    const micAudioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
    const micSource = micAudioContext.createMediaStreamSource(micStream);
    const micProcessor = micAudioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);

    let audioBuffer = [];
    const samplesPerChunk = SAMPLE_RATE * AUDIO_CHUNK_DURATION;

    micProcessor.onaudioprocess = async e => {
        const inputData = e.inputBuffer.getChannelData(0);
        audioBuffer.push(...inputData);

        // Process audio in chunks
        while (audioBuffer.length >= samplesPerChunk) {
            const chunk = audioBuffer.splice(0, samplesPerChunk);
            const pcmData16 = convertFloat32ToInt16(chunk);
            const base64Data = arrayBufferToBase64(pcmData16.buffer);

            await ipcRenderer.invoke('send-audio-content', {
                data: base64Data,
                mimeType: 'audio/pcm;rate=24000',
            });
        }
    };

    micSource.connect(micProcessor);
    micProcessor.connect(micAudioContext.destination);

    // Store processor reference for cleanup
    audioProcessor = micProcessor;
}

function setupWindowsAudioProcessing(systemStream, micStream) {
    // Setup audio processing for Windows (System + Mic)
    audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
    audioProcessor = audioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);

    // Create sources
    if (systemStream && systemStream.getAudioTracks().length > 0) {
        const systemSource = audioContext.createMediaStreamSource(systemStream);
        systemSource.connect(audioProcessor);
    }

    if (micStream && micStream.getAudioTracks().length > 0) {
        const micSource = audioContext.createMediaStreamSource(micStream);
        micSource.connect(audioProcessor);
    } else {
        console.warn('No microphone track available for mixing');
    }

    let audioBuffer = [];
    const samplesPerChunk = SAMPLE_RATE * AUDIO_CHUNK_DURATION;

    audioProcessor.onaudioprocess = async e => {
        const inputData = e.inputBuffer.getChannelData(0);

        // Simple Volume Filter: Check if there is actual sound (RMS volume check)
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
            sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);

        // Only buffer if sound is audible (Threshold: 0.005 - balanced sensitivity)
        if (rms > 0.005) {
            // console.log('🎤 Sound detected! RMS:', rms); // Uncomment for verbose debugging
            audioBuffer.push(...inputData);
        } else {
            // If it's silent, we still want to maintain timing but skip sending to Whisper
            // However, Whisper works better with continuous audio, so we only skip if it's LONG silence
            // For now, let's just push silence to keep the timing if the buffer isn't empty
            if (audioBuffer.length > 0) {
                audioBuffer.push(...inputData);
            }
        }

        // Process audio in chunks
        while (audioBuffer.length >= samplesPerChunk) {
            const chunk = audioBuffer.splice(0, samplesPerChunk);

            // Re-check chunk for silence before sending
            let chunkSum = 0;
            for (let i = 0; i < chunk.length; i++) {
                chunkSum += chunk[i] * chunk[i];
            }
            const chunkRms = Math.sqrt(chunkSum / chunk.length);

            if (chunkRms > 0.005) {
                const pcmData16 = convertFloat32ToInt16(chunk);
                const base64Data = arrayBufferToBase64(pcmData16.buffer);

                await ipcRenderer.invoke('send-audio-content', {
                    data: base64Data,
                    mimeType: 'audio/pcm;rate=16000',
                });
            }
        }
    };

    audioProcessor.connect(audioContext.destination);
}

async function captureScreenshot(imageQuality = 'medium', isManual = false, prompt = null) {
    console.log(`Capturing ${isManual ? 'manual' : 'automated'} screenshot...`);

    return new Promise(async (resolve, reject) => {
        try {
            if (!mediaStream) {
                console.warn('No media stream available for screenshot');
                resolve({ success: false, error: 'No media stream' });
                return;
            }

            // Check rate limiting for automated screenshots only
            if (!isManual && tokenTracker.shouldThrottle()) {
                console.log('⚠️ Automated screenshot skipped due to rate limiting');
                resolve({ success: false, skipped: true });
                return;
            }

            // Lazy init of video element
            if (!hiddenVideo) {
                hiddenVideo = document.createElement('video');
                hiddenVideo.srcObject = mediaStream;
                hiddenVideo.muted = true;
                hiddenVideo.playsInline = true;
                await hiddenVideo.play().catch(e => console.error('Error playing hidden video:', e));

                // Wait for video to be ready
                await new Promise(r => {
                    if (hiddenVideo.readyState >= 2) return r();
                    hiddenVideo.onloadedmetadata = () => r();
                    // Timeout fallback
                    setTimeout(r, 2000);
                });

                // Lazy init of canvas based on video dimensions
                offscreenCanvas = document.createElement('canvas');
                offscreenCanvas.width = hiddenVideo.videoWidth || 1920;
                offscreenCanvas.height = hiddenVideo.videoHeight || 1080;
                offscreenContext = offscreenCanvas.getContext('2d');
            }

            // Check if video is ready
            if (!hiddenVideo || hiddenVideo.readyState < 2) {
                console.warn('Video not ready yet, skipping screenshot');
                resolve({ success: false, error: 'Video not ready' });
                return;
            }

            // Draw to canvas
            if (offscreenContext && hiddenVideo) {
                offscreenContext.drawImage(hiddenVideo, 0, 0, offscreenCanvas.width, offscreenCanvas.height);
            } else {
                resolve({ success: false, error: 'Context or video missing' });
                return;
            }

            // Check if image was drawn properly by sampling a pixel
            const imageData = offscreenContext.getImageData(0, 0, 1, 1);
            const isBlank = imageData.data.every((value, index) => {
                // Check if all pixels are black (0,0,0) or transparent
                return index === 3 ? true : value === 0;
            });

            if (isBlank) {
                console.warn('Screenshot appears to be blank/black');
                if (isManual) {
                    alert('Screen capture failed (blank image). Please check your screen sharing permissions or try restarting the app.');
                    // Status update is handled by caller now
                    if (window.interviewCracker && window.interviewCracker.setStatus) {
                        window.interviewCracker.setStatus('Error: Blank screenshot');
                    }
                }
                resolve({ success: false, error: 'Blank image' });
                return;
            }

            let qualityValue;
            switch (imageQuality) {
                case 'high': qualityValue = 0.9; break;
                case 'medium': qualityValue = 0.7; break;
                case 'low': qualityValue = 0.5; break;
                default: qualityValue = 0.7;
            }

            // Execute toBlob logic
            offscreenCanvas.toBlob(
                async blob => {
                    if (!blob) {
                        console.error('Failed to create blob from canvas');
                        resolve({ success: false, error: 'Canvas blob creation failed' });
                        return;
                    }

                    const reader = new FileReader();
                    reader.onloadend = async () => {
                        const base64data = reader.result.split(',')[1];

                        // Validate base64 data
                        if (!base64data || base64data.length < 100) {
                            console.error('Invalid base64 data generated');
                            resolve({ success: false, error: 'Invalid base64 data' });
                            return;
                        }

                        // Optimization: Skip if image hasn't changed
                        if (!isManual && window.lastSentImage === base64data) {
                            resolve({ success: true, skipped: true });
                            return;
                        }
                        window.lastSentImage = base64data;

                        try {
                            const result = await ipcRenderer.invoke('send-image-content', {
                                data: base64data,
                                prompt: prompt,
                                imageQuality: imageQuality,
                            });

                            if (result.success) {
                                // Track image tokens after successful send
                                const imageTokens = tokenTracker.calculateImageTokens(offscreenCanvas.width, offscreenCanvas.height);
                                tokenTracker.addTokens(imageTokens, 'image');
                                console.log(`📊 Image sent successfully - ${imageTokens} tokens used (${offscreenCanvas.width}x${offscreenCanvas.height})`);
                            } else {
                                console.error('Failed to send image:', result.error);
                                // ALERT USER OF ERROR
                                if (window.interviewCracker && window.interviewCracker.setStatus) {
                                    window.interviewCracker.setStatus('Error: ' + result.error);
                                }
                                if (isManual) {
                                    alert('Screenshot Failed: ' + result.error);
                                }
                            }

                            // Resolve the main promise with the result
                            resolve(result);

                        } catch (err) {
                            console.error('IPC error in screenshot:', err);
                            resolve({ success: false, error: err.message });
                        }
                    };

                    reader.onerror = () => {
                        console.error('FileReader error');
                        resolve({ success: false, error: 'FileReader failed' });
                    };

                    reader.readAsDataURL(blob);
                },
                'image/jpeg',
                qualityValue
            );

        } catch (err) {
            console.error('Unexpected error in captureScreenshot:', err);
            resolve({ success: false, error: err.message });
        }
    }); // End Promise
}

async function captureManualScreenshot(imageQuality = null) {
    console.log('Manual screenshot triggered');

    // Show loading indicator
    if (window.setScreenshotProcessing) {
        window.setScreenshotProcessing(true);
    }

    // Update status to show processing
    if (window.interviewCracker && window.interviewCracker.setStatus) {
        window.interviewCracker.setStatus('Taking screenshot and analyzing question...');
    }

    const quality = imageQuality || currentImageQuality;
    const selectedProfile = localStorage.getItem('selectedProfile') || 'interview';
    let analysisPrompt;

    if (selectedProfile === 'student') {
        // STUDENT MODE: Direct Code + Output ONLY
        analysisPrompt = `Analyze this technical question.
Provide ONLY:
1. **Complete Code Solution** (correct, efficient, handling edge cases).
2. **Expected Output** (for the provided example or a standard test case).
DO NOT provide explanations, theory, or summaries. Code and Output ONLY.`;
    } else if (selectedProfile === 'coding') {
        // CODING INTERVIEW MODE: Structured Approach
        analysisPrompt = `Analyze this technical question.
Provide:
1. **Problem Analysis** (Brief constrains/edge cases).
2. **Approach** (Logic/Algorithm).
3. **Code Solution** (Clean, commented).
4. **Time/Space Complexity**.`;
    } else {
        // STANDARD INTERVIEW MODE (Default): Code + Summary + Output
        analysisPrompt = `Analyze this technical question/screenshot.
Provide:
1. **Direct Answer / Code Solution**: The core answer or complete code.
2. **Brief Summary**: Explain the approach/concept concisely (2-3 sentences).
3. **Output/Example**: Show the expected result or a usage example.
Keep the tone confident and professional.`;
    }

    try {
        await captureScreenshot(quality, true, analysisPrompt); // Pass true for isManual and the prompt

        // Update status to show AI processing (if successful and not already errored)
        if (window.interviewCracker && window.interviewCracker.setStatus) {
            // Note: captureScreenshot generally logs errors, but here we can just set a generic status
            // If it failed, the alert would have shown.
            window.interviewCracker.setStatus('AI analysis processing...');
        }
    } catch (error) {
        console.error('Manual screenshot failed:', error);
        if (window.interviewCracker && window.interviewCracker.setStatus) {
            window.interviewCracker.setStatus('Error: ' + (error.message || 'Unknown error'));
        }
    } finally {
        // ALWAYS hide loading indicator, no matter what happens
        if (window.setScreenshotProcessing) {
            window.setScreenshotProcessing(false);
        }
    }
}

// Expose functions to global scope for external access
window.captureManualScreenshot = captureManualScreenshot;

function stopCapture() {
    if (screenshotInterval) {
        clearInterval(screenshotInterval);
        screenshotInterval = null;
    }

    if (audioProcessor) {
        audioProcessor.disconnect();
        audioProcessor = null;
    }

    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }

    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }

    // Stop macOS audio capture if running
    if (isMacOS) {
        ipcRenderer.invoke('stop-macos-audio').catch(err => {
            console.error('Error stopping macOS audio:', err);
        });
    }

    // IMMEDIATE STOP: Clear all backend buffers and pending processing
    ipcRenderer.invoke('stop-processing').catch(err => {
        console.error('Error invoking stop-processing:', err);
    });

    // Clean up hidden elements
    if (hiddenVideo) {
        hiddenVideo.pause();
        hiddenVideo.srcObject = null;
        hiddenVideo = null;
    }
    offscreenCanvas = null;
    offscreenContext = null;
}

// Send text message to Gemini
async function sendTextMessage(text) {
    if (!text || text.trim().length === 0) {
        console.warn('Cannot send empty text message');
        return { success: false, error: 'Empty message' };
    }

    try {
        const result = await ipcRenderer.invoke('send-text-message', text);
        if (result.success) {
            console.log('Text message sent successfully');
        } else {
            console.error('Failed to send text message:', result.error);
        }
        return result;
    } catch (error) {
        console.error('Error sending text message:', error);
        return { success: false, error: error.message };
    }
}

// Conversation storage functions using IndexedDB
let conversationDB = null;

async function initConversationStorage() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('ConversationHistory', 1);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            conversationDB = request.result;
            resolve(conversationDB);
        };

        request.onupgradeneeded = event => {
            const db = event.target.result;

            // Create sessions store
            if (!db.objectStoreNames.contains('sessions')) {
                const sessionStore = db.createObjectStore('sessions', { keyPath: 'sessionId' });
                sessionStore.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };
    });
}

async function saveConversationSession(sessionId, conversationHistory) {
    if (!conversationDB) {
        await initConversationStorage();
    }

    const transaction = conversationDB.transaction(['sessions'], 'readwrite');
    const store = transaction.objectStore('sessions');

    const sessionData = {
        sessionId: sessionId,
        timestamp: parseInt(sessionId),
        conversationHistory: conversationHistory,
        lastUpdated: Date.now(),
    };

    return new Promise((resolve, reject) => {
        const request = store.put(sessionData);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

async function getConversationSession(sessionId) {
    if (!conversationDB) {
        await initConversationStorage();
    }

    const transaction = conversationDB.transaction(['sessions'], 'readonly');
    const store = transaction.objectStore('sessions');

    return new Promise((resolve, reject) => {
        const request = store.get(sessionId);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

async function getAllConversationSessions() {
    if (!conversationDB) {
        await initConversationStorage();
    }

    const transaction = conversationDB.transaction(['sessions'], 'readonly');
    const store = transaction.objectStore('sessions');
    const index = store.index('timestamp');

    return new Promise((resolve, reject) => {
        const request = index.getAll();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            // Sort by timestamp descending (newest first)
            const sessions = request.result.sort((a, b) => b.timestamp - a.timestamp);
            resolve(sessions);
        };
    });
}

// Listen for conversation data from main process
ipcRenderer.on('save-conversation-turn', async (event, data) => {
    try {
        await saveConversationSession(data.sessionId, data.fullHistory);
        console.log('Conversation session saved:', data.sessionId);
    } catch (error) {
        console.error('Error saving conversation session:', error);
    }
});

// Initialize conversation storage when renderer loads
initConversationStorage().catch(console.error);

window.interviewAI = window.interviewCracker = {
    initializeGemini,
    startCapture,
    stopCapture,
    sendTextMessage,
    // Conversation history functions
    getAllConversationSessions,
    getConversationSession,
    initConversationStorage,
    // Content protection function
    getContentProtection: () => {
        const contentProtection = localStorage.getItem('contentProtection');
        return contentProtection !== null ? contentProtection === 'true' : true;
    },
    isLinux: isLinux,
    isMacOS: isMacOS,
    e: interviewCrackerElement,
};


// AUTO-START AUDIO CAPTURE
// Wait for the page to fully load, then auto-start audio capture
console.log('🎤 [DEBUG] Renderer.js loaded - setting up auto-start timer...');
setTimeout(async () => {
    console.log('🎤 [AUTO-START] Attempting to auto-start audio capture...');
    try {
        // Initialize Gemini/Groq session first
        const profile = localStorage.getItem('selectedProfile') || 'interview';
        const language = localStorage.getItem('selectedLanguage') || 'en-US';

        console.log('🎤 [AUTO-START] Initializing session with profile:', profile);
        await window.interviewAI.initializeGemini(profile, language);

        console.log('🎤 [AUTO-START] Starting audio capture...');
        await window.interviewAI.startCapture(2, 'medium');

        console.log('✅ [AUTO-START] Audio capture started successfully!');
    } catch (error) {
        console.error('❌ [AUTO-START] Failed to auto-start audio:', error);
    }
}, 2000); // Wait 2 seconds for app to fully initialize
