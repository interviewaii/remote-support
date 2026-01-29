/**
 * gemini_audio_example.js
 * 
 * This script demonstrates how to connect to Gemini Live using the @google/genai library,
 * send audio data (PCM), and handle real-time responses.
 * 
 * Prerequisites:
 * npm install @google/genai
 */

const { GoogleGenAI } = require('@google/genai');

// Replace with your actual Gemini API Key
const API_KEY = 'YOUR_GEMINI_API_KEY';

async function startGeminiLiveSession() {
    const client = new GoogleGenAI({
        apiKey: API_KEY,
    });

    try {
        console.log('Connecting to Gemini Live...');
        
        const session = await client.live.connect({
            model: 'gemini-2.0-flash-exp',
            callbacks: {
                onopen: () => {
                    console.log('✅ Connected to Gemini Live');
                },
                onmessage: (message) => {
                    // Handle transcription of what YOU said
                    if (message.serverContent?.inputTranscription?.text) {
                        console.log('You:', message.serverContent.inputTranscription.text);
                    }

                    // Handle Gemini's response parts
                    if (message.serverContent?.modelTurn?.parts) {
                        for (const part of message.serverContent.modelTurn.parts) {
                            if (part.text) {
                                process.stdout.write(part.text); // Stream response to console
                            }
                        }
                    }

                    // Handle completion of a turn
                    if (message.serverContent?.turnComplete) {
                        console.log('\n--- Turn Complete ---');
                    }
                },
                onerror: (error) => {
                    console.error('❌ Session Error:', error.message);
                },
                onclose: (event) => {
                    console.log('🔌 Session Closed:', event.reason);
                }
            },
            config: {
                responseModalities: ['TEXT'],
                inputAudioTranscription: {}, // Enable transcription of your voice
                systemInstruction: {
                    parts: [{ text: 'You are a helpful assistant. Keep responses concise.' }],
                },
            },
        });

        /**
         * To send audio, you need to provide base64 encoded PCM data (16-bit, 24kHz mono).
         * Example of sending a chunk:
         * 
         * await session.sendRealtimeInput({
         *     audio: {
         *         data: base64PcmData,
         *         mimeType: 'audio/pcm;rate=24000',
         *     },
         * });
         */
        
        console.log('Session ready. Waiting for audio input...');

    } catch (error) {
        console.error('Failed to initialize session:', error);
    }
}

startGeminiLiveSession();
