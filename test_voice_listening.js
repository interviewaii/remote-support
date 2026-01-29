const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

// API Key from src/utils/renderer.js
const API_KEY = "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";

async function verifyVoiceFlow() {
    const openai = new OpenAI({
        apiKey: API_KEY,
    });

    try {
        console.log('--- Phase 1: Verify Connection ---');
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: "Say 'Connection successful'" }],
        });
        console.log('AI Response:', completion.choices[0].message.content);

        console.log('\n--- Phase 2: Verify Transcription (Whisper) ---');
        const audioFilePath = path.join(__dirname, 'sample_speech.wav');

        if (!fs.existsSync(audioFilePath)) {
            console.error('❌ Error: sample_speech.wav not found! Please ensure the file was downloaded successfully.');
            return;
        }

        console.log('Transcribing sample_speech.wav...');
        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(audioFilePath),
            model: 'whisper-1',
        });

        console.log('Transcription Text:', transcription.text);
        console.log('✅ Transcription successful!');

        console.log('\n--- Phase 3: Verify AI Reasoning with Transcription ---');
        const reasonResponse = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: 'You are an interview assistant.' },
                { role: 'user', content: `The following text was transcribed from an audio: "${transcription.text}". Please summarize what was said and give a short mock interview tip based on it.` }
            ],
        });

        console.log('AI Reasoning Summary:');
        console.log(reasonResponse.choices[0].message.content);

        console.log('\n✅ Full Voice Listening Flow Verified Successfully!');

    } catch (error) {
        console.error('❌ Test Failed:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        }
    }
}

verifyVoiceFlow();
