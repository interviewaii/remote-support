/**
 * openai_text_example.js
 * 
 * A simple text-based example for quick testing of the OpenAI API.
 * 
 * Prerequisites:
 * npm install openai
 */

const OpenAI = require('openai');

// Replace with your actual OpenAI API Key
const API_KEY = 'YOUR_OPENAI_API_KEY';

async function runTextExample() {
    const openai = new OpenAI({
        apiKey: API_KEY,
    });

    const prompt = 'Explain how to integrate audio capture in an Electron app.';

    try {
        console.log('Sending prompt to OpenAI...');

        // Non-streaming example
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini', // Fast and cost-effective
            messages: [
                { role: 'system', content: 'You are a helpful coding assistant.' },
                { role: 'user', content: prompt }
            ],
        });

        const text = response.choices[0].message.content;

        console.log('\n--- OpenAI Response ---');
        console.log(text);
    } catch (error) {
        console.error('Error generating content:', error.message);
    }
}

runTextExample();
