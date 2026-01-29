/**
 * test_openai_connection.js
 * 
 * Test script to verify OpenAI API connection and streaming responses
 */

const OpenAI = require('openai');

const openai = new OpenAI({
    apiKey: "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",
});

async function testOpenAI() {
    try {
        console.log('Testing OpenAI API connection...\n');

        // Test 1: Simple completion
        console.log('Test 1: Simple completion');
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini", // Using gpt-4o-mini as it's fast and cost-effective
            messages: [
                { role: "system", content: "You are a helpful assistant." },
                { role: "user", content: "Write a haiku about AI" }
            ],
        });

        console.log('Response:', response.choices[0].message.content);
        console.log('\n✅ Test 1 passed!\n');

        // Test 2: Streaming response
        console.log('Test 2: Streaming response');
        const stream = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "You are a helpful assistant." },
                { role: "user", content: "Explain AI in one sentence." }
            ],
            stream: true,
        });

        process.stdout.write('Streaming: ');
        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            process.stdout.write(content);
        }
        console.log('\n\n✅ Test 2 passed!\n');

        console.log('✅ All tests passed! OpenAI API is working correctly.');

    } catch (error) {
        console.error('❌ Error testing OpenAI API:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
    }
}

testOpenAI();
