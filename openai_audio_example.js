/**
 * openai_audio_example.js
 * 
 * This script demonstrates how to use OpenAI's Whisper API for audio transcription
 * and GPT models for generating responses.
 * 
 * Prerequisites:
 * npm install openai
 */

const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

// Replace with your actual OpenAI API Key
const API_KEY = 'YOUR_OPENAI_API_KEY';

async function transcribeAudio() {
    const openai = new OpenAI({
        apiKey: API_KEY,
    });

    try {
        console.log('Transcribing audio with Whisper...');

        // Example: Transcribe an audio file
        // You need to provide an actual audio file path
        const audioFilePath = path.join(__dirname, 'sample_audio.mp3');

        if (!fs.existsSync(audioFilePath)) {
            console.log('⚠️  No audio file found at:', audioFilePath);
            console.log('Create a sample audio file or update the path to test transcription.');
            return;
        }

        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(audioFilePath),
            model: 'whisper-1',
        });

        console.log('\n--- Transcription ---');
        console.log(transcription.text);

        // Now send the transcription to GPT for a response
        console.log('\n--- Generating AI Response ---');
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: 'You are a helpful interview assistant.' },
                { role: 'user', content: transcription.text }
            ],
        });

        console.log('\n--- AI Response ---');
        console.log(response.choices[0].message.content);

    } catch (error) {
        console.error('Error:', error.message);
    }
}

async function streamingExample() {
    const openai = new OpenAI({
        apiKey: API_KEY,
    });

    try {
        console.log('\n--- Streaming Response Example ---');

        const stream = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: 'You are a helpful assistant.' },
                { role: 'user', content: 'Write a short poem about coding.' }
            ],
            stream: true,
        });

        process.stdout.write('AI: ');
        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            process.stdout.write(content);
        }
        console.log('\n');

    } catch (error) {
        console.error('Error:', error.message);
    }
}

// Run examples
async function runExamples() {
    await transcribeAudio();
    await streamingExample();
}

runExamples();
