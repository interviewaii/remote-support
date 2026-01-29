/**
 * OpenAI Configuration Template
 * 
 * Copy this file to config.js and add your API key
 * DO NOT commit config.js to version control!
 */

module.exports = {
    // Your OpenAI API Key
    // Get it from: https://platform.openai.com/account/api-keys
    OPENAI_API_KEY: 'YOUR_OPENAI_API_KEY_HERE',

    // Model Configuration
    MODELS: {
        // For chat completions (default)
        CHAT: 'gpt-4o-mini',  // Fast and cost-effective
        // Alternative: 'gpt-4o' or 'gpt-4-turbo' for higher quality

        // For audio transcription
        WHISPER: 'whisper-1',

        // For image analysis
        VISION: 'gpt-4o',
    },

    // Response Configuration
    RESPONSE_CONFIG: {
        temperature: 0.7,      // Creativity (0.0 - 2.0)
        max_tokens: 2000,      // Maximum response length
        stream: true,          // Enable streaming responses
    },

    // Audio Configuration
    AUDIO_CONFIG: {
        chunkDuration: 1.0,    // Seconds of audio per chunk
        sampleRate: 24000,     // Hz
        channels: 1,           // Mono
        bitsPerSample: 16,     // 16-bit PCM
        batchSize: 3,          // Transcribe every N chunks
    },

    // Session Configuration
    SESSION_CONFIG: {
        profile: 'interview',  // Default profile
        language: 'en-US',     // Default language
    },
};
