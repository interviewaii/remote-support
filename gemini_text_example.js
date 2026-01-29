/**
 * gemini_text_example.js
 * 
 * A simple text-based example for quick testing of the Gemini API.
 * 
 * Prerequisites:
 * npm install @google/genai
 */

const { GoogleGenerativeAI } = require('@google/genai');

// Replace with your actual Gemini API Key
const API_KEY = 'YOUR_GEMINI_API_KEY';

async function runTextExample() {
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    const prompt = 'Explain how to integrate audio capture in an Electron app.';

    try {
        console.log('Sending prompt to Gemini...');
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        console.log('\n--- Gemini Response ---');
        console.log(text);
    } catch (error) {
        console.error('Error generating content:', error);
    }
}

runTextExample();
