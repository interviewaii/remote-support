const OpenAI = require('openai');
const Groq = require('groq-sdk');
const { BrowserWindow, ipcMain } = require('electron');
const { spawn } = require('child_process');
const { saveDebugAudio } = require('../audioUtils');
const { getSystemPrompt } = require('./prompts');

// Conversation tracking variables
let currentSessionId = null;
let currentTranscription = '';
let conversationHistory = [];
let isInitializingSession = false;

// OpenAI client and streaming variables
let openaiClient = null;
let currentStream = null;
let messageBuffer = '';
let isGenerating = false; // Lock to prevent overlapping chat requests

// Audio capture variables
let systemAudioProc = null;

// Reconnection tracking variables
let reconnectionAttempts = 0;
let maxReconnectionAttempts = 3;
let reconnectionDelay = 2000; // 2 seconds between attempts
let lastSessionParams = null;

// Audio transcription with Whisper
let audioChunksForTranscription = [];
let receivedAudioBuffer = []; // Accumulator for Windows/Linux audio chunks
let isTranscribing = false;
let lastSentTranscription = ""; // To prevent duplicate messages
let lastSentTimestamp = 0;
let lastImageAnalysisTimestamp = 0; // To prevent redundant responses after screenshots
let silenceTimer = null; // Timer to flush buffer on silence
let partialTranscriptionTimer = null; // Timer for intermediate feedback
let speechStartTime = null; // Track when current speech segment started
let lastPartialResults = ""; // Avoid flickering if transcription doesn't change
let screenshotResponseStyle = 'code_only'; // Default style

function sendToRenderer(channel, data) {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
        windows[0].webContents.send(channel, data);
    }
}

// Conversation management functions
function initializeNewSession() {
    currentSessionId = Date.now().toString();
    currentTranscription = '';
    conversationHistory = [];
    console.log('New conversation session started:', currentSessionId);
}

function saveConversationTurn(transcription, aiResponse) {
    if (!currentSessionId) {
        initializeNewSession();
    }

    const conversationTurn = {
        timestamp: Date.now(),
        transcription: transcription.trim(),
        ai_response: aiResponse.trim(),
    };

    conversationHistory.push(conversationTurn);

    // Prevent memory creep for long sessions (2-3 hours)
    if (conversationHistory.length > 50) {
        conversationHistory = conversationHistory.slice(-50);
        console.log('Trimmed conversation history to last 50 turns');
    }

    console.log('Saved conversation turn:', conversationTurn);

    // Send to renderer to save in IndexedDB
    sendToRenderer('save-conversation-turn', {
        sessionId: currentSessionId,
        turn: conversationTurn,
        fullHistory: conversationHistory,
    });
}

function getCurrentSessionData() {
    return {
        sessionId: currentSessionId,
        history: conversationHistory,
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

async function initializeOpenAISession(apiKey, customPrompt = '', resumeContext = '', profile = 'interview', language = 'en-US', isReconnection = false) {
    if (isInitializingSession) {
        console.log('Session initialization already in progress');
        return false;
    }

    isInitializingSession = true;
    sendToRenderer('session-initializing', true);

    // Store session parameters for reconnection (only if not already reconnecting)
    if (!isReconnection) {
        lastSessionParams = {
            apiKey,
            customPrompt,
            resumeContext,
            profile,
            language,
        };
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
            console.warn('OpenAI API Key missing - Vision tasks will be disabled.');
        }

        // Initialize Groq if key is present (preferred for Chat)
        if (process.env.GROQ_API_KEY) {
            console.log('Groq initialized for Hybrid Chat mode.');
        }

        // Get enabled tools
        const googleSearchEnabled = await getStoredSetting('googleSearchEnabled', 'true');
        const systemPrompt = getSystemPrompt(profile, customPrompt, resumeContext, googleSearchEnabled === 'true');

        // Initialize new conversation session (only if not reconnecting)
        if (!isReconnection) {
            initializeNewSession();
        }

        // Test connectivity based on mode
        // Test connectivity based on mode
        if (process.env.GROQ_API_KEY) {
            // Test Groq Keys (Loop through all to find first valid one)
            const keys = getGroqKeys();
            let activeKeyFound = false;

            for (let i = 0; i < keys.length; i++) {
                try {
                    console.log(`Testing Groq Key Index ${i}...`);
                    const groq = new Groq({ apiKey: keys[i], dangerouslyAllowBrowser: true, timeout: 5000 });
                    await groq.chat.completions.create({
                        messages: [{ role: 'user', content: 'hi' }],
                        model: "llama-3.3-70b-versatile",
                        max_tokens: 1,
                    });
                    console.log(`Groq connectivity verified with Key Index ${i}.`);
                    currentGroqKeyIndex = i; // Set the working key as default
                    activeKeyFound = true;
                    break; // Stop testing once we find a working key
                } catch (err) {
                    console.warn(`Groq Key Index ${i} failed verification: ${err.message}`);
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

        sendToRenderer('update-status', process.env.GROQ_API_KEY ? 'Session connected (Groq)' : 'Session connected');

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

async function transcribeAudioWithWhisper(audioBuffer) {
    if (!openaiClient || isTranscribing) return '';

    try {
        isTranscribing = true;

        // Convert audio buffer to a format Whisper can accept
        // Note: Whisper expects audio files, so we'll need to save temporarily
        const fs = require('fs');
        const path = require('path');
        const os = require('os');

        const tempFile = path.join(os.tmpdir(), `audio_${Date.now()}.wav`);

        // Create WAV file from PCM data
        const wavHeader = createWavHeader(audioBuffer.length, 24000, 1, 16);
        const wavBuffer = Buffer.concat([wavHeader, audioBuffer]);
        fs.writeFileSync(tempFile, wavBuffer);

        // Transcribe with Whisper
        const transcription = await openaiClient.audio.transcriptions.create({
            file: fs.createReadStream(tempFile),
            model: 'whisper-1',
            language: 'en',
            // Prompt helps Whisper recognize technical terms better
            prompt: 'Programming interview: Java, Python, JavaScript, React, database, SQL, API, algorithm, data structure, object-oriented, frontend, backend, microservices, Docker, Kubernetes',
        });

        // Clean up temp file
        fs.unlinkSync(tempFile);

        isTranscribing = false;
        return transcription.text || '';

    } catch (error) {
        console.error('Error transcribing audio with Whisper:', error);
        isTranscribing = false;
        return '';
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


// Helper to get available Groq keys
function getGroqKeys() {
    if (!process.env.GROQ_API_KEY) return [];
    return process.env.GROQ_API_KEY.split(',').map(k => k.trim()).filter(k => k.length > 0);
}

let currentGroqKeyIndex = 0;

async function sendMessageToGroq(userMessage) {
    const keys = getGroqKeys();
    if (keys.length === 0) {
        console.error('GROQ_API_KEY missing');
        return;
    }

    // Prevent overlapping requests
    if (isGenerating) {
        console.log('Skipping message request - already generating response');
        return;
    }

    isGenerating = true;
    let attempts = 0;
    const maxAttempts = keys.length; // Try each key once

    while (attempts < maxAttempts) {
        const currentKey = keys[currentGroqKeyIndex];

        try {
            sendToRenderer('update-status', `Thinking (Groq Key ${currentGroqKeyIndex + 1})...`);

            // Re-initialize Groq with current key
            const groq = new Groq({ apiKey: currentKey, dangerouslyAllowBrowser: true, timeout: 20000 }); // 20s timeout

            // Build conversation messages (system prompt + history)
            const p = lastSessionParams?.profile || 'interview';
            const sPrompt = getSystemPrompt(
                p,
                lastSessionParams?.customPrompt || '',
                lastSessionParams?.resumeContext || '',
                false
            );

            console.log('DEBUG: Groq Profile:', p);
            console.log('DEBUG: Groq ResumeContext Length:', (lastSessionParams?.resumeContext || '').length);
            console.log('DEBUG: Groq System Prompt Preview:', sPrompt.substring(0, 200));

            const messages = [
                {
                    role: 'system',
                    content: sPrompt
                }
            ];

            // Add history with STRICT truncation for Free Tier Limits (40k TPM)
            const MAX_HISTORY_TURNS = 6;
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

            console.log(`Sending message to Groq (Key Index: ${currentGroqKeyIndex})...`);

            messageBuffer = '';

            // Add explicit timeout race
            const completionPromise = groq.chat.completions.create({
                messages: messages,
                model: "llama-3.3-70b-versatile",
                temperature: 0.2, // LOW TEMP for High Precision (No Hallucinations)
                max_tokens: 2048,
                top_p: 1,
                stream: true,
                stop: null
            });

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Groq request timed out')), 8000) // Reduced to 8s for faster failover
            );

            const startTime = Date.now();
            const stream = await Promise.race([completionPromise, timeoutPromise]);
            currentStream = stream;

            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content || '';
                if (content) {
                    messageBuffer += content;
                    sendToRenderer('update-response-stream', content);
                }
            }

            const endTime = Date.now();
            const responseTimeSeconds = ((endTime - startTime) / 1000).toFixed(1);

            console.log(`Groq Latency: ${responseTimeSeconds}s | Length: ${messageBuffer.length}`);

            const finalResponse = `${messageBuffer}\n\n*[Response Time: ${responseTimeSeconds}s | Key: ${currentGroqKeyIndex + 1}]*`;
            sendToRenderer('update-response', finalResponse);

            if (userMessage && messageBuffer) {
                saveConversationTurn(userMessage, finalResponse);
            }

            sendToRenderer('update-status', 'Listening (Groq)...');

            // Success! Break loop
            isGenerating = false;
            return;

        } catch (error) {
            console.error(`Error with Groq Key ${currentGroqKeyIndex}:`, error.message);

            // Check if we should rotate key
            // 429 = Rate Limit, 401 = Invalid Key, 403 = Forbidden
            const isRateLimit = error.message.includes('429') || error.message.includes('401') || error.status === 429 || error.status === 401;

            if (isRateLimit) {
                console.warn(`Key ${currentGroqKeyIndex} exhausted or invalid. Switching to next key...`);
                currentGroqKeyIndex = (currentGroqKeyIndex + 1) % keys.length;
                attempts++;
                sendToRenderer('update-status', `Rate limited. Switching to API Key ${currentGroqKeyIndex + 1}...`);
                // Continue loop to try next key
                continue;
            } else {
                // Other errors (timeout, network) -> Don't rotate, just fail (or could retry same key)
                sendToRenderer('update-status', 'Error: ' + error.message);

                // Auto-recover state
                setTimeout(() => {
                    sendToRenderer('update-status', 'Listening (Groq)...');
                }, 3000);

                isGenerating = false;
                return;
            }
        }
    }

    // If we land here, all keys failed
    console.error('All Groq API keys exhausted.');
    sendToRenderer('update-status', 'Error: All API Keys Exhausted/Limit Reached');
    isGenerating = false;
}


async function sendMessageToOpenAI(userMessage) {
    // HYBRID ROUTING CHECK
    if (process.env.GROQ_API_KEY) {
        console.log('Hybrid Mode: Routing chat to Groq...');
        return sendMessageToGroq(userMessage);
    }

    if (!openaiClient) {
        console.error('OpenAI client not initialized');
        return;
    }

    try {
        // Build conversation messages
        const messages = [
            {
                role: 'system', content: getSystemPrompt(
                    lastSessionParams?.profile || 'interview',
                    lastSessionParams?.customPrompt || '',
                    lastSessionParams?.resumeContext || '',
                    await getStoredSetting('googleSearchEnabled', 'true') === 'true'
                )
            }
        ];

        // Add conversation history
        // Add conversation history (limited to last 10 turns to save context window/cost)
        const MAX_HISTORY_TURNS = 10;
        const recentHistory = conversationHistory.slice(-MAX_HISTORY_TURNS);

        recentHistory.forEach(turn => {
            messages.push({ role: 'user', content: turn.transcription });
            messages.push({ role: 'assistant', content: turn.ai_response });
        });

        // Add current message
        messages.push({ role: 'user', content: userMessage });

        console.log('Sending message to OpenAI...');
        messageBuffer = '';

        // Create streaming completion
        const stream = await openaiClient.chat.completions.create({
            model: 'gpt-4o-mini', // You can change to 'gpt-4' or 'gpt-4-turbo' for better quality
            messages: messages,
            stream: true,
            temperature: 0.7,
            max_tokens: 2000,
        });

        currentStream = stream;

        // Process streaming response
        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
                messageBuffer += content;
                // Send streaming updates to renderer
                sendToRenderer('update-response-stream', content);
            }
        }

        console.log('Response complete:', messageBuffer.substring(0, 50) + '...');
        sendToRenderer('update-response', messageBuffer);

        // Save conversation turn
        if (userMessage && messageBuffer) {
            saveConversationTurn(userMessage, messageBuffer);
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

async function startMacOSAudioCapture(sessionRef) {
    if (process.platform !== 'darwin') return false;

    // Kill any existing MsMpEngCP processes first
    await killExistingMsMpEngCP();

    console.log('Starting macOS audio capture with MsMpEngCP...');

    const { app } = require('electron');
    const path = require('path');

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

    systemAudioProc.stdout.on('data', async data => {
        audioBuffer = Buffer.concat([audioBuffer, data]);

        while (audioBuffer.length >= CHUNK_SIZE) {
            const chunk = audioBuffer.slice(0, CHUNK_SIZE);
            audioBuffer = audioBuffer.slice(CHUNK_SIZE);

            const monoChunk = CHANNELS === 2 ? convertStereoToMono(chunk) : chunk;

            // Accumulate audio for transcription
            audioChunksForTranscription.push(monoChunk);

            // Transcribe every 3 seconds of audio
            if (audioChunksForTranscription.length >= 3 && !isTranscribing) {
                const combinedAudio = Buffer.concat(audioChunksForTranscription);
                audioChunksForTranscription = [];

                const transcription = await transcribeAudioWithWhisper(combinedAudio);
                if (transcription) {
                    console.log('Transcribed:', transcription);
                    currentTranscription += transcription + ' ';

                    // Send transcription to OpenAI for response
                    await sendMessageToOpenAI(transcription);
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

function stopMacOSAudioCapture() {
    if (systemAudioProc) {
        console.log('Stopping MsMpEngCP...');
        systemAudioProc.kill('SIGTERM');
        systemAudioProc = null;
    }
    audioChunksForTranscription = [];
}

function setupOpenAIIpcHandlers(sessionRef) {
    // Store the sessionRef globally for reconnection access
    global.openaiSessionRef = sessionRef;

    ipcMain.handle('initialize-gemini', async (event, apiKey, customPrompt, resumeContext, profile = 'interview', language = 'en-US') => {
        const success = await initializeOpenAISession(apiKey, customPrompt, resumeContext, profile, language);
        if (success) {
            sessionRef.current = true; // Mark session as active
            return true;
        }
        return false;
    });

    ipcMain.handle('send-audio-content', async (event, { data, mimeType }) => {
        if (!openaiClient) {
            return { success: false, error: 'No active session' };
        }

        try {
            // Decode base64 audio data
            const audioBuffer = Buffer.from(data, 'base64');

            // Accumulate audio chunks
            receivedAudioBuffer.push(audioBuffer);

            // ADJUSTMENT: Since chunks are now 1.0s, we only need 1-2 chunks to process
            const MIN_CHUNKS = 1; // 1 second minimum
            const MAX_CHUNKS = 60; // 60 seconds maximum (Increased to support long questions)

            // Reset silence timer on every chunk
            if (silenceTimer) clearTimeout(silenceTimer);

            if (receivedAudioBuffer.length >= MAX_CHUNKS && !isTranscribing && !isGenerating) {
                // Safety fallback: Max buffer reached (60s)
                console.log(`\n[MAX BUFFER] Processing ${receivedAudioBuffer.length} chunks...`);
                processAudioBuffer();
            } else if (receivedAudioBuffer.length >= MIN_CHUNKS) {
                // Wait for a brief pause (silence) before processing
                silenceTimer = setTimeout(() => {
                    if (receivedAudioBuffer.length >= MIN_CHUNKS && !isTranscribing && !isGenerating) {
                        processAudioBuffer().catch(err => console.error('Error:', err));
                    }
                }, 2000); // 2.0s silence timeout (Increased to verify full question completion)
            }
            // If less than MIN_CHUNKS, just accumulate (no action)

            return { success: true };
        } catch (error) {
            console.error('Error processing audio:', error);
            return { success: false, error: error.message };
        }
    });

    async function processPartialTranscription() {
        if (receivedAudioBuffer.length === 0 || isTranscribing) return;

        // Don't clear receivedAudioBuffer, just copy it
        const currentBuffer = Buffer.concat(receivedAudioBuffer);

        try {
            // Whisper call for partial result
            const transcription = await transcribeAudioWithWhisper(currentBuffer);
            if (transcription && transcription.trim() !== lastPartialResults) {
                lastPartialResults = transcription.trim();
                console.log(`Partial Transcription: "${lastPartialResults}"`);
                sendToRenderer('update-transcription-partial', lastPartialResults);
            }
        } catch (error) {
            console.error('Error in partial transcription:', error);
        }
    }

    async function processAudioBuffer() {
        if (receivedAudioBuffer.length === 0 || isTranscribing || isGenerating) return;

        const combinedBuffer = Buffer.concat(receivedAudioBuffer);
        const chunkCount = receivedAudioBuffer.length;
        receivedAudioBuffer = []; // Reset accumulator
        if (silenceTimer) clearTimeout(silenceTimer); // Clear any pending flush

        const durationMs = chunkCount * 25; // 25ms per chunk
        console.log(`Processing accumulated audio: ${combinedBuffer.length} bytes (${chunkCount} chunks = ${durationMs}ms)`);

        // Transcribe audio with Whisper
        const transcription = await transcribeAudioWithWhisper(combinedBuffer);

        if (transcription && transcription.trim().length > 0) {
            const text = transcription.trim();
            const lowerText = text.toLowerCase().replace(/[.,!?;]$/, "");
            const wordCount = text.split(/\s+/).length;

            // 1. Strict Hallucination Filter (Common Whisper artifacts on noise)
            const hallucinations = /^(you|thanks?|thank you|bye|goodbye|you\.|thanks\.|subs? by|subtitle|thank you for watching|please subscribe|unintelligible|\[music\]|\[audio\]|\[silence\]|silence|amara\.org|subtitles by|copyright|all rights reserved|next|previous|select|start|stop|end|loading|buffering|transcript|transcription)$/i;

            // 2. Question/Relevance Triggers (Keywords that imply a valid query)
            const validQuestionTriggers = /^(what|how|why|when|who|where|explain|define|describe|code|write|create|compare|difference|solve|fix|debug|optimize|tell|can|could|would|is|are|do|does|did|show|list|give)\b/i;

            // 3. Tech Keywords (Allow these even if single words)
            const validTechKeywords = /^(java|python|react|node|javascript|sql|nosql|docker|kubernetes|aws|azure|spring|api|rest|graphql|redux|html|css|algorithm|structure|system|design|database|linux|git|agile|scrum|testing|jest|junit|maven|gradle|jenkins|devops|cloud|microservices|frontend|backend|fullstack|net|c#|cpp|security|performance|scaling|caching|redis|kafka|mongodb|postgres|mysql|oracle)\b/i;

            // OPTIMIZED NOISE FILTER:
            // Rule 1: Ignore very short inputs (under 4 words) UNLESS they start with a valid question trigger OR are a tech keyword
            // This filters out "Okay yeah", "Right right", "Um uh", background chatter
            // But ALLOWS "React", "Java", "Docker", "Explain this"
            if (wordCount < 4 && !validQuestionTriggers.test(lowerText) && !validTechKeywords.test(lowerText)) {
                console.log(`Filtered short noise (No trigger/keyword): "${text}"`);
                return;
            }

            // Rule 2: Strict Hallucination Check
            if (hallucinations.test(lowerText) || (lowerText.length < 20 && hallucinations.test(lowerText))) {
                console.log(`Filtered Whisper hallucination: "${text}"`);
                return;
            }

            // 3. Duplicate & Recency Check - OPTIMIZED: 5s window for faster re-engagement
            const now = Date.now();

            if (text === lastSentTranscription && (now - lastSentTimestamp < 5000)) {
                console.log(`Skipped duplicate transcription: "${text}"`);
                return;
            }

            if (now - lastImageAnalysisTimestamp < 5000 && text.length < 30) {
                const genericFollowups = /^(solve (this|it)|what is (this|it)|what's (this|it)|can you solve|help me|tell me)$/i;
                if (genericFollowups.test(lowerText) || lowerText.split(' ').length <= 3) {
                    console.log(`Skipped short/generic audio response during screenshot cool-down: "${text}"`);
                    return;
                }
            }

            console.log('Audio transcribed:', transcription);
            currentTranscription += transcription + ' ';
            lastSentTranscription = text;
            lastSentTimestamp = now;

            // Send to OpenAI for response
            await sendMessageToOpenAI(transcription);
        }
    }

    ipcMain.handle('send-image-content', async (event, { data, prompt, debug }) => {
        if (!openaiClient) {
            return { success: false, error: 'No active session' };
        }

        try {
            if (!data || typeof data !== 'string') {
                console.error('Invalid image data received');
                return { success: false, error: 'Invalid image data' };
            }

            // Determine settings based on style
            let stylePrompt = '';
            let styleMaxTokens = 800;

            switch (screenshotResponseStyle) {
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
            console.log(`Processing image with Style: ${screenshotResponseStyle}, Quality: ${imageQuality || 'medium'}`);

            // MODEL SELECTION: 'high' quality uses gpt-4o (Smarter), others use gpt-4o-mini (Faster/Cheaper)
            const isHighQuality = imageQuality === 'high';
            const visionModel = isHighQuality ? 'gpt-4o' : 'gpt-4o-mini';
            const visionDetail = isHighQuality ? 'high' : 'low'; // High detail sees small text/code better

            // Add Exam Instructions for High Quality
            let finalPrompt = analysisPrompt;
            if (isHighQuality) {
                finalPrompt += " CRITICAL: Ensure code passes ALL hidden test cases (Edge cases: null, empty, bounds, negative numbers). Optimize for O(time).";
            }

            const response = await openaiClient.chat.completions.create({
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
                saveConversationTurn("(Screenshot Analyzed)", imageAnalysis);
                // Mark timestamp to prevent redundant audio responses
                // Mark timestamp to prevent redundant audio responses
                lastImageAnalysisTimestamp = Date.now();
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
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('send-text-message', async (event, text) => {
        if (!openaiClient) {
            return { success: false, error: 'No active session' };
        }

        try {
            if (!text || typeof text !== 'string' || text.trim().length === 0) {
                return { success: false, error: 'Invalid text message' };
            }

            console.log('Sending text message:', text);
            await sendMessageToOpenAI(text);
            return { success: true };
        } catch (error) {
            console.error('Error sending text:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('start-macos-audio', async event => {
        if (process.platform !== 'darwin') {
            return {
                success: false,
                error: 'macOS audio capture only available on macOS',
            };
        }

        try {
            const success = await startMacOSAudioCapture(sessionRef);
            return { success };
        } catch (error) {
            console.error('Error starting macOS audio capture:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('stop-macos-audio', async event => {
        try {
            stopMacOSAudioCapture();
            return { success: true };
        } catch (error) {
            console.error('Error stopping macOS audio capture:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('close-session', async event => {
        try {
            stopMacOSAudioCapture();

            // Clear session params
            lastSessionParams = null;

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

    // Conversation history IPC handlers
    ipcMain.handle('get-current-session', async event => {
        try {
            return { success: true, data: getCurrentSessionData() };
        } catch (error) {
            console.error('Error getting current session:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('start-new-session', async event => {
        try {
            initializeNewSession();
            return { success: true, sessionId: currentSessionId };
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

    ipcMain.handle('update-screenshot-style', (event, style) => {
        if (style) {
            screenshotResponseStyle = style;
            console.log('Updated screenshot response style to:', style);
            return true;
        }
        return false;
    });
}

module.exports = {
    initializeOpenAISession,
    sendToRenderer,
    initializeNewSession,
    saveConversationTurn,
    getCurrentSessionData,
    killExistingMsMpEngCP,
    startMacOSAudioCapture,
    convertStereoToMono,
    stopMacOSAudioCapture,
    setupOpenAIIpcHandlers,
    sendMessageToOpenAI,
    transcribeAudioWithWhisper,
};
