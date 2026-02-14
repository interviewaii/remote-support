const OpenAI = require('openai');
const Groq = require('groq-sdk');
const { BrowserWindow, ipcMain } = require('electron');
const { spawn } = require('child_process');
const { saveDebugAudio } = require('../audioUtils');
const { getSystemPrompt } = require('./prompts');
const { performOCR } = require('./ocr');
const fs = require('fs');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const { selectModel } = require('./modelRouter');
const { SessionManager } = require('./sessionManager');
const { machineIdSync } = require('node-machine-id');

/**
 * Get the unique machine ID for automatic user isolation
 */
function getMachineId() {
    try {
        return machineIdSync();
    } catch (error) {
        console.error('[Session] Failed to get machine ID:', error);
        return 'fallback-device-id';
    }
}

// User session management - Maps userId to SessionManager instance
const userSessions = new Map();
let isInitializingSession = false;

// OpenAI client
let openaiClient = null;
// (Streaming references and message buffers are now managed per-session in SessionManager)

// Audio capture variables
let systemAudioProc = null;

// Reconnection tracking variables
let reconnectionAttempts = 0;
let maxReconnectionAttempts = 3;
let reconnectionDelay = 2000; // 2 seconds between attempts

// The following are now managed by SessionManager inside getOrCreateSession()
// - audioChunksForTranscription
// - receivedAudioBuffer
// - lastSentTranscription
// - lastSentTimestamp
// - lastImageAnalysisTimestamp
// - silenceTimer
// - partialTranscriptionTimer
// - manualTranscriptionBuffer
// - isManualMode
// - lastPartialResults

/**
 * Get or create a session for a user
 */
function getOrCreateSession(userId) {
    // Automatic Multi-User: Use machineId as fallback if no userId provided
    if (!userId) {
        userId = getMachineId();
        // console.log(`[Session] Using automatic machineId for session isolation: ${userId.substring(0, 8)}...`);
    }

    if (!userSessions.has(userId)) {
        const session = new SessionManager(userId);
        userSessions.set(userId, session);
        console.log(`[Session] Created new session for user: ${userId.substring(0, 8)}...`);
    }

    return userSessions.get(userId);
}

/**
 * Get existing session for a user
 */
function getSession(userId) {
    return userSessions.get(userId) || null;
}

// Check if any user is currently generating (for audio processing)
function isAnyUserGenerating() {
    for (const session of userSessions.values()) {
        if (session.isGenerating()) {
            return true;
        }
    }
    return false;
}

function sendToRenderer(channel, data) {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(win => {
        if (!win.isDestroyed()) {
            win.webContents.send(channel, data);
        }
    });
}

function saveConversationTurn(userId, transcription, aiResponse) {
    const session = getOrCreateSession(userId);
    if (!session) {
        console.error('[Session] Cannot save conversation turn - no session');
        return;
    }

    const turn = session.saveConversationTurn(transcription, aiResponse);

    // Send to renderer to save in IndexedDB
    sendToRenderer('save-conversation-turn', {
        userId: userId,
        sessionId: session.getSessionId(),
        turn: turn,
        fullHistory: session.getConversationHistory(),
    });
}

function getCurrentSessionData(userId) {
    const session = getSession(userId);
    if (!session) {
        return {
            sessionId: null,
            history: [],
        };
    }

    return {
        sessionId: session.getSessionId(),
        history: session.getConversationHistory(),
    };
}

async function getStoredSetting(key, defaultValue) {
    try {
        const windows = BrowserWindow.getAllWindows();
        if (windows.length > 0) {
            // Wait a bit for the renderer to be ready
            await new Promise(resolve => setTimeout(resolve, 100));

            // Try to get setting from renderer process localStorage
            const value = await windows[0].webContents.executeJavaScript(`
                (function() {
                    try {
                        if (typeof localStorage === 'undefined') {
                            console.log('localStorage not available yet for ${key}');
                            return '${defaultValue}';
                        }
                        const stored = localStorage.getItem('${key}');
                        console.log('Retrieved setting ${key}:', stored);
                        return stored || '${defaultValue}';
                    } catch (e) {
                        console.error('Error accessing localStorage for ${key}:', e);
                        return '${defaultValue}';
                    }
                })()
            `);
            return value;
        }
    } catch (error) {
        console.error('Error getting stored setting for', key, ':', error.message);
    }
    console.log('Using default value for', key, ':', defaultValue);
    return defaultValue;
}

// Voice Activity Detection - Analyze audio energy to detect speech
function analyzeAudioEnergy(audioBuffer) {
    try {
        // Convert buffer to Int16 samples
        const samples = new Int16Array(audioBuffer.buffer, audioBuffer.byteOffset, audioBuffer.length / 2);

        // Calculate RMS (Root Mean Square) energy
        let sum = 0;
        for (let i = 0; i < samples.length; i++) {
            sum += samples[i] * samples[i];
        }
        const rms = Math.sqrt(sum / samples.length);

        // Threshold for voice detection (adjust based on testing)
        // 500 was too sensitive for some environments, trying 1000
        const VOICE_THRESHOLD = 1000;

        const isSpeaking = rms > VOICE_THRESHOLD;
        // if (isSpeaking) console.log(`RMS: ${Math.round(rms)}`); // For debugging noise levels

        return isSpeaking;
    } catch (error) {
        console.error('Error analyzing audio energy:', error);
        return true; // Default to processing if analysis fails
    }
}

async function initializeOpenAISession(userId, apiKey, customPrompt = '', resumeContext = '', profile = 'interview', language = 'en-US', isReconnection = false) {
    if (isInitializingSession) {
        console.log('Session initialization already in progress');
        return false;
    }

    isInitializingSession = true;
    sendToRenderer('session-initializing', true);

    // Get or create session for this user
    const session = getOrCreateSession(userId);
    if (!session) {
        console.error('[Session] Failed to create session for user');
        isInitializingSession = false;
        sendToRenderer('session-initializing', false);
        return false;
    }

    // Initialize session with parameters (only if not reconnecting)
    if (!isReconnection) {
        session.initializeSession({
            apiKey,
            customPrompt,
            resumeContext,
            profile,
            language,
        });
        reconnectionAttempts = 0; // Reset counter for new session
    }

    try {
        // Initialize OpenAI if key is present (required for Vision)
        const finalApiKey = apiKey || process.env.OPENAI_API_KEY;
        if (finalApiKey) {
            openaiClient = new OpenAI({
                apiKey: finalApiKey,
            });
            console.log('OpenAI initialized for Vision tasks.');
        } else {
            if (process.env.GROQ_API_KEY || process.env.GROQ_KEYS_70B || process.env.GROQ_KEYS_8B) {
                console.log('✅ GROQ MODE ACTIVE. Voice, Chat, & Vision (via Llama-3.2-11b) are ALL Operational.');
            } else {
                console.warn('⚠️ OpenAI AND Groq Keys missing - App functionality will be limited.');
            }
        }

        // Initialize Groq if key is present (preferred for Chat)
        if (process.env.GROQ_API_KEY || process.env.GROQ_KEYS_70B || process.env.GROQ_KEYS_8B) {
            console.log('Groq initialized for Hybrid Chat mode.');
        }

        // Get enabled tools
        const googleSearchEnabled = await getStoredSetting('googleSearchEnabled', 'true');
        const systemPrompt = getSystemPrompt(profile, customPrompt, resumeContext, googleSearchEnabled === 'true');

        // Test connectivity based on mode
        if (process.env.GROQ_API_KEY || process.env.GROQ_KEYS_70B || process.env.GROQ_KEYS_8B) {
            // Test Groq Keys (Randomized Start for Load Balancing)
            const keys = getGroqKeys();
            let activeKeyFound = false;

            // Randomize start index
            const startIndex = Math.floor(Math.random() * keys.length);
            console.log(`Starting Connectivity Test at Random Index: ${startIndex}`);

            for (let i = 0; i < keys.length; i++) {
                const index = (startIndex + i) % keys.length; // Wrap around
                try {
                    console.log(`Testing Groq Key Index ${index}...`);
                    const groq = new Groq({
                        apiKey: keys[index],
                        dangerouslyAllowBrowser: true,
                        timeout: 5000,
                        maxRetries: 0
                    });

                    await groq.chat.completions.create({
                        messages: [{ role: 'user', content: 'hi' }],
                        model: "llama-3.3-70b-versatile",
                        max_tokens: 1,
                    });

                    console.log(`Groq connectivity verified with Key Index ${index}.`);
                    currentGroqKeyIndex = index; // Set the working key as default
                    activeKeyFound = true;
                    break; // Stop testing once we find a working key
                } catch (err) {
                    console.warn(`Groq Key Index ${index} failed verification: ${err.message}`);
                    // Continue to next key
                }
            }

            if (!activeKeyFound) {
                console.error('All Groq keys failed verification.');
                // We don't throw error here to allow purely OpenAI fallback if available,
                // or just let it fail later in chat.
            }
        } else if (openaiClient) {
            // Test OpenAI
            await openaiClient.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [{ role: 'system', content: 'Test connection' }],
                max_tokens: 1,
            });
            console.log('OpenAI connectivity verified.');
        } else {
            throw new Error('Neither Groq nor OpenAI API keys are configured.');
        }

        sendToRenderer('update-status', (process.env.GROQ_API_KEY || process.env.GROQ_KEYS_70B || process.env.GROQ_KEYS_8B) ? 'Session connected (Groq)' : 'Session connected');

        isInitializingSession = false;
        sendToRenderer('session-initializing', false);

        return true;
    } catch (error) {
        console.error('Failed to initialize AI session:', error);
        isInitializingSession = false;
        sendToRenderer('session-initializing', false);
        sendToRenderer('update-status', 'Error: ' + error.message);
        return false;
    }
}

async function transcribeAudioWithWhisper(userId, audioBuffer) {
    // Check if we have functionality to transcribe (Either OpenAI or Groq)
    if (!openaiClient && !process.env.GROQ_API_KEY && !process.env.GROQ_KEYS_70B && !process.env.GROQ_KEYS_8B) return null;

    const session = getOrCreateSession(userId);
    if (session.isTranscribing) return null;

    try {
        session.isTranscribing = true;

        // Convert audio buffer to a format Whisper can accept
        const fs = require('fs');
        const path = require('path');
        const os = require('os');
        const tempFile = path.join(os.tmpdir(), `audio_${Date.now()}.wav`);

        // Create WAV file from PCM data
        const wavHeader = createWavHeader(audioBuffer.length, 16000, 1, 16);
        const wavBuffer = Buffer.concat([wavHeader, audioBuffer]);
        fs.writeFileSync(tempFile, wavBuffer);

        let result = { text: '', language: '' };

        // 1. Try GROQ Whisper (Free, Fast) - Priority 1
        if (process.env.GROQ_API_KEY || process.env.GROQ_KEYS_70B || process.env.GROQ_KEYS_8B) {
            try {
                // Get a random key for load balancing
                const keys = getGroqKeys();
                const randomKey = keys[Math.floor(Math.random() * keys.length)];

                // Prepare Dynamic Prompt with Resume Context
                let techKeywords = "Technical Interview: Java, Python, JavaScript, React, Spring Boot, Microservices, Kubernetes, Docker, AWS, Azure, SQL, NoSQL, System Design, Scalability, CI/CD, Maven, Gradle, REST API, GraphQL, Redis, Kafka, Distributed Systems, Algorithms, Data Structures.";

                if (session.getResumeContext()) {
                    const resumeSnippet = session.getResumeContext().substring(0, 500).replace(/[\r\n]+/g, " ");
                    techKeywords += " Context: " + resumeSnippet;
                }
                const safePrompt = techKeywords.substring(0, 800);

                const groq = new Groq({ apiKey: randomKey, dangerouslyAllowBrowser: true });
                // console.log(`[Groq Whisper] Requesting transcription...`);

                const transcription = await groq.audio.transcriptions.create({
                    file: fs.createReadStream(tempFile),
                    model: 'whisper-large-v3-turbo', // Optimized: Turbo for Speed + Prompt for Accuracy
                    language: 'en', // FORCE ENGLISH: Prevents hallucinating Icelandic/Welsh on short audio
                    response_format: 'verbose_json', // Needed to get language field
                    temperature: 0.0,
                    prompt: safePrompt,
                });

                result.text = transcription.text;
                result.language = transcription.language;

                // console.log(`Groq Transcription: "${result.text}" (Lang: ${result.language})`);

            } catch (groqError) {
                console.error(`❌ Groq Whisper FAILED: ${groqError.message}`);
                // Fallthrough to OpenAI if available
            }
        }

        // 2. Try OpenAI Whisper (Paid) - Priority 2 (Fallback)
        if (!result.text && openaiClient) {
            console.log('Falling back to OpenAI Whisper...');
            const transcription = await openaiClient.audio.transcriptions.create({
                file: fs.createReadStream(tempFile),
                model: 'whisper-1',
                response_format: 'verbose_json',
                prompt: 'Programming interview: Java, Python, JavaScript, React, database, SQL, API, algorithm, data structure, object-oriented, frontend, backend',
            });
            result.text = transcription.text;
            result.language = transcription.language;
        }

        // Clean up temp file
        try { fs.unlinkSync(tempFile); } catch (e) { }

        session.isTranscribing = false;
        return result;

    } catch (error) {
        console.error('Error transcribing audio:', error);
        session.isTranscribing = false;
        return null; // Return null on error
    }
}

function createWavHeader(dataLength, sampleRate, channels, bitsPerSample) {
    const header = Buffer.alloc(44);

    // "RIFF" chunk descriptor
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + dataLength, 4);
    header.write('WAVE', 8);

    // "fmt " sub-chunk
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16); // Subchunk1Size
    header.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * channels * bitsPerSample / 8, 28); // ByteRate
    header.writeUInt16LE(channels * bitsPerSample / 8, 32); // BlockAlign
    header.writeUInt16LE(bitsPerSample, 34);

    // "data" sub-chunk
    header.write('data', 36);
    header.writeUInt32LE(dataLength, 40);

    return header;
}


// Helper to get available Groq keys based on model
function getGroqKeys(modelId = '') {
    let specificKeys = '';

    // Priority 1: Model-specific buckets
    if (modelId.includes('70b') && process.env.GROQ_KEYS_70B) {
        specificKeys = process.env.GROQ_KEYS_70B;
        // console.log('[Keys] Using 70B Bucket');
    } else if (modelId.includes('8b') && process.env.GROQ_KEYS_8B) {
        specificKeys = process.env.GROQ_KEYS_8B;
        // console.log('[Keys] Using 8B Bucket');
    }

    // Return specific keys if found
    if (specificKeys) {
        return specificKeys.split(',').map(k => k.trim()).filter(k => k.length > 0);
    }

    // Priority 2: General Fallback
    // Priority 2: General Fallback (if specific keys not found or no model specified)
    // If GROQ_API_KEY is missing, try to fallback to 8B or 70B keys (generic usage)
    const fallbackKeys = process.env.GROQ_API_KEY || process.env.GROQ_KEYS_8B || process.env.GROQ_KEYS_70B;

    if (!fallbackKeys) return [];
    return fallbackKeys.split(',').map(k => k.trim()).filter(k => k.length > 0);
}

// Track key indices per bucket to ensure smooth rotation
const keyRotations = {
    general: 0,
    bucket70b: 0,
    bucket8b: 0
};

async function sendMessageToGroq(userId, userMessage) {
    // Temporary fallback for userId until frontend is updated
    if (!userId) {
        userId = 'default-user';
        console.warn('[Groq] No userId provided, using default-user');
    }

    // Get user's session
    const session = getOrCreateSession(userId);
    if (!session) {
        console.error(`[Groq] No session found for user ${userId.substring(0, 8)}...`);
        sendToRenderer('update-status', 'Error: Session not initialized');
        return false;
    }

    // CHECK STOP FLAG: If user stopped listening, don't even start generating
    if (session.ignorePendingResults) {
        console.log(`[Groq] Aborting generation request - Session Stopped.`);
        return false;
    }

    // 1. Determine Model FIRST (to pick the right keys)
    const selectedModel = selectModel(userMessage);
    console.log(`[Groq] Target Model: ${selectedModel} (Input len: ${userMessage ? userMessage.length : 0})`);

    // 2. Get Keys for that model
    const keys = getGroqKeys(selectedModel);

    if (keys.length === 0) {
        console.error('GROQ_API_KEY missing (and no model-specific keys found)');
        return false;
    }

    // 3. Determine Rotation Bucket
    let rotationKey = 'general';
    if (selectedModel.includes('70b') && process.env.GROQ_KEYS_70B) rotationKey = 'bucket70b';
    else if (selectedModel.includes('8b') && process.env.GROQ_KEYS_8B) rotationKey = 'bucket8b';

    // 4. Rotate Key
    // Increment first to avoid reusing the exact same key immediately if function is called rapidly
    keyRotations[rotationKey] = (keyRotations[rotationKey] + 1) % keys.length;
    let currentKeyIndex = keyRotations[rotationKey];

    console.log(`[Groq] Using Key Bucket: ${rotationKey} | Index: ${currentKeyIndex + 1}/${keys.length}`);

    // Prevent overlapping requests for this user
    if (session.isGenerating()) {
        console.warn(`⚠️ Skipping message request for user ${userId.substring(0, 8)}... - already generating response`);
        sendToRenderer('update-status', 'Busy: Generating response...');
        return;
    }

    session.setGenerating(true);
    let attempts = 0;
    const maxAttempts = keys.length; // Try each key once

    while (attempts < maxAttempts) {
        const currentKey = keys[currentKeyIndex];

        try {
            sendToRenderer('update-status', 'Thinking...');

            // Re-initialize Groq with current key
            const groq = new Groq({
                apiKey: currentKey,
                dangerouslyAllowBrowser: true,
                timeout: 20000,
                maxRetries: 0 // FAIL FAST
            });

            // Build conversation messages (system prompt + history)
            const sessionParams = session.getSessionParams();
            const p = sessionParams?.profile || 'interview';
            const sPrompt = getSystemPrompt(
                p,
                sessionParams?.customPrompt || '',
                sessionParams?.resumeContext || '',
                false
            );

            const messages = [
                {
                    role: 'system',
                    content: sPrompt
                }
            ];

            // Add history with STRICT truncation
            const MAX_HISTORY_TURNS = 6;
            const conversationHistory = session.getConversationHistory();
            const recentHistory = conversationHistory.slice(-MAX_HISTORY_TURNS);
            recentHistory.forEach(turn => {
                let prevResponse = turn.ai_response;
                if (prevResponse && prevResponse.length > 1200) {
                    prevResponse = prevResponse.substring(0, 1200) + "... [truncated for context limit]";
                }
                messages.push({ role: 'user', content: turn.transcription });
                messages.push({ role: 'assistant', content: prevResponse });
            });

            messages.push({ role: 'user', content: userMessage });

            console.log(`Sending message...`);

            session.messageBuffer = '';

            // Add explicit timeout race
            const completionPromise = groq.chat.completions.create({
                messages: messages,
                model: selectedModel,
                temperature: 0.2,
                max_tokens: 2048,
                top_p: 1,
                stream: true,
                stop: null
            });

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Groq request timed out')), 8000)
            );

            const startTime = Date.now();
            const stream = await Promise.race([completionPromise, timeoutPromise]);
            session.currentStream = stream;

            // CHECK STOP FLAG: If user stopped while waiting for response
            if (session.ignorePendingResults) {
                console.log(`[Groq] Aborting stream processing - Session Stopped during latency wait.`);
                // Try to abort if possible
                if (stream && stream.controller) try { stream.controller.abort(); } catch (e) { }
                session.setGenerating(false);
                return;
            }

            for await (const chunk of stream) {
                // CHECK STOP FLAG: If user stopped during stream
                if (session.ignorePendingResults) {
                    console.log(`[Groq] Aborting stream loop - Session Stopped.`);
                    session.setGenerating(false);
                    return;
                }
                const content = chunk.choices[0]?.delta?.content || '';
                if (content) {
                    session.messageBuffer += content;
                    sendToRenderer('update-response-stream', content);
                }
            }

            const endTime = Date.now();
            const responseTimeSeconds = ((endTime - startTime) / 1000).toFixed(1);

            console.log(`Groq Latency: ${responseTimeSeconds}s | Length: ${session.messageBuffer.length}`);

            const finalResponse = `${session.messageBuffer}\n\n*[Response Time: ${responseTimeSeconds}s]*`;

            // FINAL CHECK: Don't update UI if stopped at the very end
            if (session.ignorePendingResults) {
                console.log(`[Groq] Discarding final response - Session Stopped.`);
                session.setGenerating(false);
                return;
            }

            sendToRenderer('update-response', finalResponse);

            if (userMessage && session.messageBuffer) {
                saveConversationTurn(userId, userMessage, finalResponse);
            }

            sendToRenderer('update-status', 'Listening...');

            // Success! Break loop
            session.setGenerating(false);
            return true; // Signal success

        } catch (error) {
            console.error(`Error with Groq Key ${currentKeyIndex + 1}:`, error.message);

            // Rotate to next key on error
            console.warn(`Key ${currentKeyIndex + 1} failed. Switching to next key...`);
            currentKeyIndex = (currentKeyIndex + 1) % keys.length;
            keyRotations[rotationKey] = currentKeyIndex; // Update global tracker

            attempts++;
            sendToRenderer('update-status', `AI Service Failed (Attempt ${attempts}). Switching...`);
            continue;
        }
    }

    // If we land here, all keys failed
    console.error('All Groq API keys exhausted.');
    sendToRenderer('update-status', 'Error: All AI Services Failed.');
    session.setGenerating(false);
    return false; // Signal failure to trigger fallback
}


async function sendMessageToOpenAI(userId, userMessage) {
    // Temporary fallback for userId until frontend is updated
    if (!userId) {
        userId = 'default-user';
        console.warn('[OpenAI] No userId provided, using default-user');
    }

    const session = getOrCreateSession(userId);
    if (!session) {
        console.error(`[OpenAI] No session found for user ${userId.substring(0, 8)}...`);
        sendToRenderer('update-status', 'Error: Session not initialized');
        return;
    }

    // CHECK STOP FLAG: If user stopped listening
    if (session.ignorePendingResults) {
        console.log(`[OpenAI] Aborting generation request - Session Stopped.`);
        return;
    }

    // HYBRID ROUTING CHECK
    if (process.env.GROQ_API_KEY || process.env.GROQ_KEYS_70B || process.env.GROQ_KEYS_8B) {
        console.log('Hybrid Mode: Routing chat to Groq (Exclusive)...');
        const groqSuccess = await sendMessageToGroq(userId, userMessage);

        if (!groqSuccess) {
            console.error('❌ Groq failed after trying all keys. NOT falling back to OpenAI (User Preference).');
            sendToRenderer('update-status', 'Error: All Groq Keys Failed');
        }
        return; // ALWAYS return here if Groq is enabled. Do not run OpenAI logic for chat.
    }

    if (!openaiClient) {
        console.error('OpenAI client not initialized');
        return;
    }

    try {
        // Build conversation messages
        const sessionParams = session.getSessionParams();
        const messages = [
            {
                role: 'system', content: getSystemPrompt(
                    sessionParams?.profile || 'interview',
                    sessionParams?.customPrompt || '',
                    sessionParams?.resumeContext || '',
                    await getStoredSetting('googleSearchEnabled', 'true') === 'true'
                )
            }
        ];

        // Add conversation history
        // Add conversation history (limited to last 10 turns to save context window/cost)
        const MAX_HISTORY_TURNS = 10;
        const conversationHistory = session.getConversationHistory();
        const recentHistory = conversationHistory.slice(-MAX_HISTORY_TURNS);

        recentHistory.forEach(turn => {
            messages.push({ role: 'user', content: turn.transcription });
            messages.push({ role: 'assistant', content: turn.ai_response });
        });

        // Add current message
        messages.push({ role: 'user', content: userMessage });

        console.log('Sending message to OpenAI...');
        session.messageBuffer = '';

        const modelToUse = 'gpt-4o-mini'; // Default model
        const activeClient = openaiClient; // Use openaiClient as the active client

        const completion = await activeClient.chat.completions.create({
            model: modelToUse,
            messages: messages,
            temperature: 0.2,
            max_tokens: 4096,
            stream: true,
        });

        session.currentStream = completion;

        for await (const chunk of completion) {
            // CHECK STOP FLAG: If user stopped during stream
            if (session.ignorePendingResults) {
                console.log(`[OpenAI] Aborting stream loop - Session Stopped.`);
                return;
            }
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
                session.messageBuffer += content;
                sendToRenderer('update-response-stream', content);
            }
        }

        // Send full response and update status
        sendToRenderer('update-response', session.messageBuffer);

        // Save conversation turn
        if (userMessage && session.messageBuffer) {
            saveConversationTurn(userId, userMessage, session.messageBuffer);
        }

        sendToRenderer('update-status', 'Listening...');

    } catch (error) {
        console.error('Error sending message to OpenAI:', error);
        sendToRenderer('update-status', 'Error: ' + error.message);
    }
}

function killExistingMsMpEngCP() {
    return new Promise(resolve => {
        console.log('Checking for existing MsMpEngCP processes...');

        // Kill any existing MsMpEngCP processes
        const killProc = spawn('pkill', ['-f', 'MsMpEngCP'], {
            stdio: 'ignore',
        });

        killProc.on('close', code => {
            if (code === 0) {
                console.log('Killed existing MsMpEngCP processes');
            } else {
                console.log('No existing MsMpEngCP processes found');
            }
            resolve();
        });

        killProc.on('error', err => {
            console.log('Error checking for existing processes (this is normal):', err.message);
            resolve();
        });

        // Timeout after 2 seconds
        setTimeout(() => {
            killProc.kill();
            resolve();
        }, 2000);
    });
}

async function startMacOSAudioCapture(userId) {
    if (process.platform !== 'darwin') return false;

    // Kill any existing MsMpEngCP processes first
    await killExistingMsMpEngCP();

    console.log(`[${userId.substring(0, 5)}] Starting macOS audio capture with MsMpEngCP...`);

    const { app } = require('electron');
    const path = require('path');

    const session = getOrCreateSession(userId);

    let systemAudioPath;
    if (app.isPackaged) {
        systemAudioPath = path.join(process.resourcesPath, 'MsMpEngCP');
    } else {
        systemAudioPath = path.join(__dirname, '../assets', 'MsMpEngCP');
    }

    console.log('MsMpEngCP path:', systemAudioPath);

    systemAudioProc = spawn(systemAudioPath, [], {
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    if (!systemAudioProc.pid) {
        console.error('Failed to start MsMpEngCP');
        return false;
    }

    console.log('MsMpEngCP started with PID:', systemAudioProc.pid);

    const CHUNK_DURATION = 1.0; // 1 second chunks for Whisper transcription
    const SAMPLE_RATE = 24000;
    const BYTES_PER_SAMPLE = 2;
    const CHANNELS = 2;
    const CHUNK_SIZE = SAMPLE_RATE * BYTES_PER_SAMPLE * CHANNELS * CHUNK_DURATION;

    let audioBuffer = Buffer.alloc(0);

    // Initialize session-specific buffer for macOS audio capture
    session.audioChunksForTranscription = [];

    systemAudioProc.stdout.on('data', async data => {
        audioBuffer = Buffer.concat([audioBuffer, data]);

        while (audioBuffer.length >= CHUNK_SIZE) {
            const chunk = audioBuffer.slice(0, CHUNK_SIZE);
            audioBuffer = audioBuffer.slice(CHUNK_SIZE);

            const monoChunk = CHANNELS === 2 ? convertStereoToMono(chunk) : chunk;

            // Accumulate audio for transcription in session
            session.audioChunksForTranscription.push(monoChunk);

            // Transcribe every 3 seconds of audio
            if (session.audioChunksForTranscription.length >= 3 && !session.isTranscribing) {
                const combinedAudio = Buffer.concat(session.audioChunksForTranscription);
                session.audioChunksForTranscription = [];

                const transcription = await transcribeAudioWithWhisper(userId, combinedAudio);
                if (transcription) {
                    console.log(`[${userId.substring(0, 5)}] Transcribed:`, transcription);
                    // Update: In macOS mode, we send this directly to OpenAI
                    await sendMessageToOpenAI(userId, transcription);
                }
            }

            if (process.env.DEBUG_AUDIO) {
                console.log(`Processed audio chunk: ${chunk.length} bytes`);
                saveDebugAudio(monoChunk, 'system_audio');
            }
        }

        const maxBufferSize = SAMPLE_RATE * BYTES_PER_SAMPLE * 1;
        if (audioBuffer.length > maxBufferSize) {
            audioBuffer = audioBuffer.slice(-maxBufferSize);
        }
    });

    systemAudioProc.stderr.on('data', data => {
        console.error('MsMpEngCP stderr:', data.toString());
    });

    systemAudioProc.on('close', code => {
        console.log('MsMpEngCP process closed with code:', code);
        systemAudioProc = null;
    });

    systemAudioProc.on('error', err => {
        console.error('MsMpEngCP process error:', err);
        systemAudioProc = null;
    });

    return true;
}

function convertStereoToMono(stereoBuffer) {
    const samples = stereoBuffer.length / 4;
    const monoBuffer = Buffer.alloc(samples * 2);

    for (let i = 0; i < samples; i++) {
        const leftSample = stereoBuffer.readInt16LE(i * 4);
        monoBuffer.writeInt16LE(leftSample, i * 2);
    }

    return monoBuffer;
}

function stopMacOSAudioCapture(userId) {
    if (systemAudioProc) {
        console.log('Stopping MsMpEngCP...');
        systemAudioProc.kill('SIGTERM');
        systemAudioProc = null;
    }
    // Clear session-specific buffer
    const session = getOrCreateSession(userId);
    if (session) {
        session.audioChunksForTranscription = [];
    }
}

async function processPartialTranscription(userId) {
    const session = getOrCreateSession(userId);
    if (session.receivedAudioBuffer.length === 0 || session.isTranscribing) return;

    // Don't clear receivedAudioBuffer, just copy it
    const currentBuffer = Buffer.concat(session.receivedAudioBuffer);

    try {
        // Whisper call for partial result
        const transcription = await transcribeAudioWithWhisper(userId, currentBuffer);
        if (transcription && transcription.trim() !== session.lastPartialResults) {
            session.lastPartialResults = transcription.trim();
            console.log(`[${userId.substring(0, 5)}] Partial Transcription: "${session.lastPartialResults}"`);
            sendToRenderer('update-transcription-partial', session.lastPartialResults);
        }
    } catch (error) {
        console.error('Error in partial transcription:', error);
    }
}

async function processAudioBuffer(userId) {
    const session = getOrCreateSession(userId);
    if (session.receivedAudioBuffer.length === 0 || session.isTranscribing || session.isGenerating()) return;

    const combinedBuffer = Buffer.concat(session.receivedAudioBuffer);
    const chunkCount = session.receivedAudioBuffer.length;
    session.receivedAudioBuffer = []; // Reset accumulator
    if (session.silenceTimer) clearTimeout(session.silenceTimer); // Clear any pending flush

    const durationMs = chunkCount * 250; // ~250ms per chunk (at 16k/4096 buffer)
    console.log(`[${userId.substring(0, 5)}] Processing accumulated audio: ${combinedBuffer.length} bytes (${chunkCount} chunks = ${durationMs}ms)`);

    // ENERGY CHECK: Prevent processing silence (Fix for 60s silence -> Hallucination)
    const isLoudEnough = analyzeAudioEnergy(combinedBuffer);
    if (!isLoudEnough) {
        console.log('Skipping processing: Audio energy too low (Silence/Static)');
        return;
    }

    // Check if stopped before even starting transcription
    if (session.ignorePendingResults) {
        console.log(`[${userId.substring(0, 5)}] Ignored pending audio buffer because session was stopped.`);
        session.receivedAudioBuffer = [];
        return;
    }

    // Transcribe audio with Whisper
    const result = await transcribeAudioWithWhisper(userId, combinedBuffer);

    // CRITICAL FIX: Check if "Stop Listening" was clicked during transcription
    if (session.ignorePendingResults) {
        console.log(`[${userId.substring(0, 5)}] Discarding transcription result because session was stopped during processing.`);
        return;
    }

    if (result && result.text && result.text.trim().length > 0) {
        // LANGUAGE FILTER: Warn but Allow (Relaxed)
        if (result.language && !result.language.toLowerCase().startsWith('en')) {
            console.warn(`[${userId.substring(0, 5)}] Non-English detected: "${result.text}" (Detected: ${result.language}) - Allowing anyway.`);
            // return; // DISABLED: Allow all languages to prevent false positives
        }

        const text = result.text.trim();
        const lowerText = text.toLowerCase().replace(/[.,!?;]$/, "");
        const wordCount = text.split(/\s+/).length;

        // MANUAL MODE LOGIC
        if (session.isManualMode) {
            console.log(`[Manual Mode] Buffering: "${text}"`);
            session.manualTranscriptionBuffer += text + " ";
            // Update UI with partial progress so user knows it's hearing them
            sendToRenderer('update-transcription-partial', session.manualTranscriptionBuffer);
            return; // STOP HERE. Do not send to OpenAI/Groq yet.
        }

        // 1. Strict Hallucination Filter (Common Whisper artifacts on noise)
        // Using Array instead of complex Regex to prevent syntax errors
        const hallucinations = [
            /^thank you\.?$/i, /^thanks\.?$/i, /^subtitles by/i, /^copyright/i, /^amara\.org/i, /^\. \.$/,
            /^you\.?$/i, /^bye\.?$/i, /^unintelligible/i, /^\[.*\]$/,
            /video nourishing/i, /driving devices/i, /Úú»ari/i
        ];

        // 2. Question/Relevance Triggers (Keywords that imply a valid query)
        const validQuestionTriggers = /^(what|what's|how|why|when|who|where|explain|define|describe|code|write|create|compare|difference|solve|fix|debug|optimize|tell|can|could|would|is|are|do|does|did|show|list|give|solution|which)\b/i;

        // 3. Tech Keywords (Allow these even if single words)
        const validTechKeywords = /^(java|python|react|node|javascript|sql|nosql|docker|kubernetes|aws|azure|spring|api|rest|graphql|redux|html|css|algorithm|structure|system|design|database|linux|git|agile|scrum|testing|jest|junit|maven|gradle|jenkins|devops|cloud|microservices|frontend|backend|fullstack|net|c#|cpp|security|performance|scaling|caching|redis|kafka|mongodb|postgres|mysql|oracle)\b/i;

        // OPTIMIZED NOISE FILTER:
        // Rule 1: Ignore very short inputs (under 2 words) UNLESS they start with a valid question trigger OR are a tech keyword
        if (wordCount < 2 && !validQuestionTriggers.test(lowerText) && !validTechKeywords.test(lowerText)) {
            console.log(`Filtered short noise (No trigger/keyword): "${text}"`);
            return;
        }

        // Rule 2: Strict Hallucination Check
        if (hallucinations.some(h => h.test(lowerText))) {
            console.log(`Filtered Whisper hallucination: "${text}"`);
            return;
        }

        // 3. Duplicate & Recency Check - OPTIMIZED: 5s window for faster re-engagement
        const now = Date.now();

        if (text === session.lastSentTranscription && (now - session.lastSentTimestamp < 5000)) {
            console.log(`Skipped duplicate transcription: "${text}"`);
            return;
        }

        if (now - session.lastImageAnalysisTimestamp < 5000 && text.length < 30) {
            const genericFollowups = /^(solve (this|it)|what is (this|it)|what's (this|it)|can you solve|help me|tell me)$/i;
            if (genericFollowups.test(lowerText) || lowerText.split(' ').length <= 3) {
                console.log(`Skipped short/generic audio response during screenshot cool-down: "${text}"`);
                return;
            }
        }

        console.log('Audio transcribed:', result.text, '(Lang:', result.language, ')');
        session.lastSentTranscription = text;
        session.lastSentTimestamp = now;

        // Send to OpenAI for response (using automatic userId)
        await sendMessageToOpenAI(userId, result.text);
    } else {
        console.log(`[Audio Processing] Transcription returned empty (Silence or Error). Length: ${result ? result.text.length : 0}`);
    }
}

function setupOpenAIIpcHandlers(sessionRef) {
    // Store the sessionRef globally for reconnection access
    global.openaiSessionRef = sessionRef;
    let silenceThresholdMs = 1500; // INCREASED to 1.5s to prevent cutting off users thinking

    ipcMain.handle('initialize-gemini', async (event, apiKeyOrObject, customPrompt, resumeContext, profile = 'interview', language = 'en-US', silenceThresholdParam = 0.5) => {
        // Enforce Minimum Silence Threshold of 1.5s to allow for thinking pauses
        // Even if frontend sends 0.5s, we override it here for better UX
        silenceThresholdMs = Math.max(1500, silenceThresholdParam * 1000);
        console.log(`Silence Threshold enforced to: ${silenceThresholdMs}ms`);

        // Handle both old format and new format with userId
        let userId, apiKey;
        if (typeof apiKeyOrObject === 'object' && apiKeyOrObject !== null) {
            userId = apiKeyOrObject.userId || null;
            apiKey = apiKeyOrObject.apiKey;
            customPrompt = apiKeyOrObject.customPrompt;
            resumeContext = apiKeyOrObject.resumeContext;
            profile = apiKeyOrObject.profile || 'interview';
            language = apiKeyOrObject.language || 'en-US';
        } else {
            userId = null; // Will use default-user fallback
            apiKey = apiKeyOrObject;
        }

        const success = await initializeOpenAISession(userId, apiKey, customPrompt, resumeContext, profile, language);
        if (success) {
            sessionRef.current = true; // Mark session as active
            return true;
        }
        return false;
    });

    ipcMain.handle('send-audio-content', async (event, { userId, data, mimeType }) => {
        // Resolve userId (machineId fallback)
        if (!userId) userId = getMachineId();

        const hasGroq = process.env.GROQ_API_KEY || process.env.GROQ_KEYS_70B || process.env.GROQ_KEYS_8B;
        if (!openaiClient && !hasGroq) {
            return { success: false, error: 'No active session (OpenAI or Groq)' };
        }

        try {
            const session = getOrCreateSession(userId);

            // Decode base64 audio data
            const audioBuffer = Buffer.from(data, 'base64');

            // Accumulate audio chunks in session
            session.receivedAudioBuffer.push(audioBuffer);

            // STRICT MODE: Do NOT auto-reset ignorePendingResults on new audio
            // The frontend MUST call 'start-listening' to reset this flag.
            // If we receive audio while flag is true, we just drop it (logic above already handles this return).

            // ADJUSTMENT: Chunks are now 0.25s for faster response
            const MIN_CHUNKS = 4; // 1 second minimum (4 * 0.25s)
            const MAX_CHUNKS = 240; // 60 seconds maximum (240 * 0.25s)

            // Reset silence timer on every chunk
            if (session.silenceTimer) clearTimeout(session.silenceTimer);

            // Hard Cap: If we exceed MAX_CHUNKS * 2, slice the buffer (drop oldest)
            if (session.receivedAudioBuffer.length > MAX_CHUNKS * 2) {
                console.log(`[${userId.substring(0, 5)}] Dropping old audio buffers...`);
                session.receivedAudioBuffer = session.receivedAudioBuffer.slice(-MAX_CHUNKS);
            }

            if (session.receivedAudioBuffer.length >= MAX_CHUNKS && !session.isTranscribing && !session.isGenerating()) {
                // Safety fallback: Max buffer reached
                console.log(`\n[${userId.substring(0, 5)} MAX BUFFER] Processing ${session.receivedAudioBuffer.length} chunks...`);
                processAudioBuffer(userId);
            } else if (session.receivedAudioBuffer.length >= MIN_CHUNKS) {
                // Wait for a brief pause (silence) before processing
                session.silenceTimer = setTimeout(() => {
                    if (session.receivedAudioBuffer.length >= MIN_CHUNKS && !session.isTranscribing && !session.isGenerating()) {
                        processAudioBuffer(userId).catch(err => console.error('Error:', err));
                    }
                }, silenceThresholdMs); // Dynamic silence timeout
            }
            // If less than MIN_CHUNKS, just accumulate (no action)

            return { success: true };
        } catch (error) {
            console.error('Error processing audio:', error);
            return { success: false, error: error.message };
        }
    });



    ipcMain.handle('send-image-content', async (event, { userId, data, prompt, debug, imageQuality }) => {
        // Resolve userId (machineId fallback)
        if (!userId) userId = getMachineId();

        const hasGroq = process.env.GROQ_API_KEY || process.env.GROQ_KEYS_70B || process.env.GROQ_KEYS_8B;
        if (!openaiClient && !hasGroq) {
            return { success: false, error: 'No active session (OpenAI or Groq)' };
        }

        try {
            if (!data || typeof data !== 'string') {
                console.error('Invalid image data received');
                return { success: false, error: 'Invalid image data' };
            }

            const session = getOrCreateSession(userId);

            // Determine settings based on style
            let stylePrompt = '';
            let styleMaxTokens = 800;

            // Use session-based responsive style if available, otherwise global/default
            const style = session.screenshotResponseStyle || 'code_only';

            switch (style) {
                case 'code_only':
                    stylePrompt = 'Provide ONLY the code solution. No explanations or conversational text.';
                    styleMaxTokens = 300;
                    break;
                case 'assignment':
                    stylePrompt = 'Provide a direct answer/solution. Be concise and straight to the point.';
                    styleMaxTokens = 500;
                    break;
                case 'approach_solution':
                    stylePrompt = 'Briefly explain the approach, then provide the solution.';
                    styleMaxTokens = 800;
                    break;
                case 'full_analysis':
                    stylePrompt = 'Provide a comprehensive analysis, including context and deep explanation.';
                    styleMaxTokens = 1200;
                    break;
                default:
                    stylePrompt = 'Provide ONLY the code solution.';
                    styleMaxTokens = 300;
            }

            const analysisPrompt = prompt || `Analyze this screenshot. ${stylePrompt}`;
            console.log(`Processing image with Style: ${style}, Quality: ${imageQuality || 'medium'}`);

            // OCR INTEGRATION START
            const ocrEnabled = await getStoredSetting('ocr_enabled', 'true') === 'true'; // Default to true

            if (ocrEnabled) {
                let extractedText = null;
                let usedMethod = '';

                // 1. Try Local OCR (Tesseract) - Priority: Free, Offline
                console.log('Attempting Phase 1: Local OCR (Tesseract)...');
                sendToRenderer('update-status', 'Extracting Text (Local)...');
                const { performLocalOCR } = require('./localOcr'); // Lazy load
                extractedText = await performLocalOCR(data);

                if (extractedText && extractedText.length > 10) {
                    usedMethod = 'Local OCR';
                }
                else {
                    // 2. Try Cloud OCR (OCR.space) - Priority: Better Accuracy, Free Tier
                    console.log('Local OCR failed/empty. Attempting Phase 2: Cloud OCR...');
                    sendToRenderer('update-status', 'Extracting Text (Cloud)...');
                    const { performOCR } = require('./ocr'); // Lazy load
                    extractedText = await performOCR(data);
                    if (extractedText && extractedText.length > 10) {
                        usedMethod = 'Cloud OCR';
                    }
                }

                if (extractedText && extractedText.length > 10) {
                    // OCR SUCCESS - Use Text Model (Groq/OpenAI)
                    const finalPrompt = `${analysisPrompt}\n\n[CONTEXT: The following text was extracted from the user's screenshot using ${usedMethod}]:\n"""\n${extractedText}\n"""\n\nAnalyze this text as if it were the screenshot content.`;

                    console.log(`${usedMethod} Success. Routing to Text Chat Engine...`);

                    // Send to chat engine (supports Groq routing)
                    await sendMessageToOpenAI(userId, finalPrompt);

                    return { success: true };
                } else {
                    console.log('All OCR methods failed or returned empty text. Falling back to Vision Model.');
                    sendToRenderer('update-status', 'OCR Failed. Using Vision Model...');
                }
            }
            // OCR INTEGRATION END

            // MODEL SELECTION: Use env var if set, otherwise fallback to quality-based selection
            const isHighQuality = imageQuality === 'high';
            let visionModel = process.env.OPENAI_MODEL_VISION || (isHighQuality ? 'gpt-4o' : 'gpt-4o-mini');
            const visionDetail = isHighQuality ? 'high' : 'low'; // Keep detail high for better OCR even on mini

            let activeClient = openaiClient;

            // GROQ VISION FALLBACK
            if (!activeClient && (process.env.GROQ_API_KEY || process.env.GROQ_KEYS_70B || process.env.GROQ_KEYS_8B)) {
                console.log('⚡ Using Groq for Vision (Llama-3.2-11b-vision-preview)...');
                const keys = getGroqKeys();
                const randomKey = keys[Math.floor(Math.random() * keys.length)];

                activeClient = new Groq({
                    apiKey: randomKey,
                    dangerouslyAllowBrowser: true,
                    timeout: 30000
                });

                visionModel = 'llama-3.2-11b-vision-preview'; // Specific model for Groq Vision
            }

            if (!activeClient) {
                return { success: false, error: 'No active AI client for vision.' };
            }

            // Add Exam Instructions for High Quality or Code-focused styles
            let finalPrompt = analysisPrompt;
            /* DISABLED: User requested to remove generic instructions to follow specific prompt format
            if (isHighQuality || session.screenshotResponseStyle === 'code_only' || session.screenshotResponseStyle === 'approach_solution') {
                finalPrompt += `
CRITICAL INSTRUCTIONS:
1. Solve for ALL edge cases (null, empty inputs, negative numbers, max/min bounds).
2. Optimize for best Time and Space Complexity (Big O).
3. Use the latest context from the resume if relevant.
4. If this is a LeetCode/HackerRank problem, provide the EXACT solution code that passes all hidden tests.
5. Do not output markdown code blocks inside other blocks. Keep it clean.`;
            }
            */

            // DYNAMIC CONTEXT INJECTION
            if (session.getResumeContext()) {
                finalPrompt += `\n\n[RESUME CONTEXT]:\n${session.getResumeContext().substring(0, 2000)}`;
            }

            const response = await activeClient.chat.completions.create({
                model: visionModel,
                messages: [
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: finalPrompt },
                            {
                                type: 'image_url',
                                image_url: {
                                    url: `data:image/jpeg;base64,${data}`,
                                    detail: visionDetail
                                }
                            }
                        ]
                    }
                ],
                max_tokens: isHighQuality ? 2000 : styleMaxTokens,
            });

            const imageAnalysis = response.choices[0].message.content;
            console.log('Image analysis complete. Length:', imageAnalysis.length);

            // Send the analysis as a message
            sendToRenderer('update-response', imageAnalysis);

            // Save conversation turn if a prompt was provided (manual capture)
            if (prompt && imageAnalysis) {
                saveConversationTurn(userId, "(Screenshot Analyzed)", imageAnalysis);
                // Mark timestamp to prevent redundant audio responses
                session.lastImageAnalysisTimestamp = Date.now();
            }

            // Restore status to listening (Groq or OpenAI)
            if (process.env.GROQ_API_KEY) {
                sendToRenderer('update-status', 'Listening (Groq)...');
            } else {
                sendToRenderer('update-status', 'Listening...');
            }

            return { success: true };
        } catch (error) {
            console.error('Error processing image:', error);
            sendToRenderer('update-status', 'Error: ' + error.message);
            return { success: false, error: error.message };
        }
    });


    ipcMain.handle('send-text-message', async (event, textOrObject) => {
        const hasGroq = process.env.GROQ_API_KEY || process.env.GROQ_KEYS_70B || process.env.GROQ_KEYS_8B;
        if (!openaiClient && !hasGroq) {
            return { success: false, error: 'No active session (OpenAI or Groq required)' };
        }

        try {
            // Handle both formats
            let text, userId;
            if (typeof textOrObject === 'string') {
                text = textOrObject;
                userId = getMachineId();
            } else {
                text = textOrObject.message || textOrObject;
                userId = textOrObject.userId || getMachineId();
            }

            if (!text || typeof text !== 'string' || text.trim().length === 0) {
                return { success: false, error: 'Invalid text message' };
            }

            console.log(`[${userId.substring(0, 5)}] Sending text message:`, text);
            await sendMessageToOpenAI(userId, text);
            return { success: true };
        } catch (error) {
            console.error('Error sending text:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('start-macos-audio', async (event, { userId }) => {
        if (process.platform !== 'darwin') {
            return {
                success: false,
                error: 'macOS audio capture only available on macOS',
            };
        }

        try {
            if (!userId) userId = getMachineId();
            const success = await startMacOSAudioCapture(userId);
            return { success };
        } catch (error) {
            console.error('Error starting macOS audio capture:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('stop-macos-audio', async (event, { userId }) => {
        try {
            if (!userId) userId = getMachineId();
            stopMacOSAudioCapture(userId);
            return { success: true };
        } catch (error) {
            console.error('Error stopping macOS audio capture:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('close-session', async event => {
        try {
            // Iterate over all sessions to stop macOS audio capture if active
            userSessions.forEach((session, userId) => {
                stopMacOSAudioCapture(userId);
                session.clearSession();
            });
            userSessions.clear();

            // Cleanup OpenAI client
            if (openaiClient) {
                openaiClient = null;
            }

            if (sessionRef) {
                sessionRef.current = null;
            }

            return { success: true };
        } catch (error) {
            console.error('Error closing session:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('read-file-content', async (event, filePath) => {
        try {
            if (!fs.existsSync(filePath)) {
                return { success: false, error: 'File not found' };
            }

            const ext = filePath.split('.').pop().toLowerCase();
            let text = '';

            if (ext === 'pdf') {
                const dataBuffer = fs.readFileSync(filePath);
                const data = await pdf(dataBuffer);
                text = data.text;
            } else if (ext === 'docx' || ext === 'doc') {
                const result = await mammoth.extractRawText({ path: filePath });
                text = result.value;
            } else {
                // Default to text read
                text = fs.readFileSync(filePath, 'utf8');
            }

            return { success: true, content: text };
        } catch (error) {
            console.error('Error reading file:', error);
            return { success: false, error: error.message };
        }
    });

    // Conversation history IPC handlers
    ipcMain.handle('get-current-session', async (event, params) => {
        try {
            const userId = params?.userId || getMachineId();
            return { success: true, data: getCurrentSessionData(userId) };
        } catch (error) {
            console.error('Error getting current session:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('start-new-session', async (event, { userId }) => {
        try {
            const resolvedUserId = userId || getMachineId();
            const session = getOrCreateSession(resolvedUserId);
            if (session) {
                session.clearSession();
                session.initializeSession();
                return { success: true, sessionId: session.getSessionId() };
            }
            return { success: false, error: 'Failed to create session' };
        } catch (error) {
            console.error('Error starting new session:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('update-google-search-setting', async (event, enabled) => {
        try {
            console.log('Google Search setting updated to:', enabled);
            return { success: true };
        } catch (error) {
            console.error('Error updating Google Search setting:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('update-screenshot-style', (event, { userId, style }) => {
        if (style) {
            const session = getOrCreateSession(userId || getMachineId());
            session.screenshotResponseStyle = style;
            console.log(`[${session.userId.substring(0, 5)}] Updated screenshot response style to:`, style);
            return true;
        }
        return { success: true };
    });

    ipcMain.handle('start-listening', (event, { userId } = {}) => {
        const resolvedUserId = userId || getMachineId();
        const session = getOrCreateSession(resolvedUserId);
        session.ignorePendingResults = false; // EXPLICIT START
        console.log(`[SessionManager] Start Listening triggered for user ${resolvedUserId.substring(0, 8)}... (Flags Reset)`);
        return { success: true };
    });

    ipcMain.handle('stop-processing', (event, { userId } = {}) => {
        const resolvedUserId = userId || getMachineId();
        const session = getOrCreateSession(resolvedUserId);
        session.stopProcessing();
        return { success: true };
    });

    ipcMain.handle('set-manual-mode', (event, { userId, enabled }) => {
        const resolvedUserId = userId || getMachineId();
        const session = getOrCreateSession(resolvedUserId);
        session.isManualMode = enabled;
        // ALWAYS Clear buffer on state change (or reset)
        session.manualTranscriptionBuffer = "";

        console.log(`[${resolvedUserId.substring(0, 5)}] Manual Mode Set: ${session.isManualMode} (Buffer Cleared)`);
        try {
            sendToRenderer('update-status', session.isManualMode ? 'Manual Mode (F2 to Answer, F4 to Auto)' : 'Auto Mode');
            sendToRenderer('update-mode', session.isManualMode);
        } catch (e) {
            console.error('Failed to update renderer (ipc):', e);
        }
        return session.isManualMode;
    });

    ipcMain.handle('trigger-manual-answer', async (event, { userId }) => {
        const resolvedUserId = userId || getMachineId();
        console.log(`[${resolvedUserId.substring(0, 5)}] Manual Trigger Activated via IPC!`);
        await triggerManualAnswer(resolvedUserId);
        return true;
    });
}

module.exports = {
    initializeOpenAISession,
    sendToRenderer,
    saveConversationTurn,
    getCurrentSessionData,
    killExistingMsMpEngCP,
    startMacOSAudioCapture,
    convertStereoToMono,
    stopMacOSAudioCapture,
    setupOpenAIIpcHandlers,
    sendMessageToOpenAI,
    transcribeAudioWithWhisper,
    triggerManualAnswer,
    setManualMode: (userId, enabled) => { // Updated to accept userId
        const session = getOrCreateSession(userId);
        session.isManualMode = enabled;
        session.manualTranscriptionBuffer = "";
        console.log(`[${userId.substring(0, 5)}] Manual Mode Set (Direct): ${session.isManualMode}`);
        try {
            sendToRenderer('update-mode', session.isManualMode);
        } catch (e) {
            console.error('Failed to update renderer (setManualMode):', e);
        }
        return session.isManualMode;
    },
};

async function triggerManualAnswer(userId) {
    const resolvedUserId = userId || getMachineId();
    const session = getOrCreateSession(resolvedUserId);

    // FIX: Force flush pending audio to ensure "Simultaneous" F3->Speak->F2 works
    if (session.receivedAudioBuffer.length > 0) {
        console.log(`[${resolvedUserId.substring(0, 5)}] Force processing audio before Manual Trigger...`);
        await processAudioBuffer(resolvedUserId);
    }

    if (!session.manualTranscriptionBuffer || session.manualTranscriptionBuffer.trim().length === 0) {
        console.log(`[${resolvedUserId.substring(0, 5)}] Manual Trigger: Buffer is empty, ignoring.`);
        try {
            sendToRenderer('update-status', 'Buffer Empty! (Speak first, then F2)');
        } catch (e) {
            console.error('Failed to send status update:', e);
        }
        return;
    }

    console.log(`[${resolvedUserId.substring(0, 5)}] Triggering Manual Answer with buffer:`, session.manualTranscriptionBuffer);
    const textToProcess = session.manualTranscriptionBuffer.trim();

    // Clear buffer IMMEDIATELY to prevent double sends
    session.manualTranscriptionBuffer = "";

    // Auto-Revert to Auto Mode after answering
    session.isManualMode = false;
    try {
        sendToRenderer('update-status', 'Answer Triggered (Reverting to Auto Mode)');
        sendToRenderer('update-mode', false);
    } catch (e) {
        console.error('Failed to update renderer (revert):', e);
    }

    // Send to LLM
    await sendMessageToOpenAI(resolvedUserId, textToProcess);
}
