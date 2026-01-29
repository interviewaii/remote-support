/**
 * Simple OpenAI API Test
 */

const OpenAI = require('openai');

const openai = new OpenAI({
    apiKey: "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",
});

async function simpleTest() {
    console.log('🔍 Testing OpenAI API Key...\n');
    console.log('API Key (masked):', 'sk-proj-O5Ctdx...co4wA\n');

    try {
        console.log('📡 Sending test request to OpenAI...');

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "user", content: "Say 'Hello! API is working!'" }
            ],
            max_tokens: 20,
        });

        console.log('\n✅ SUCCESS! OpenAI API is working!\n');
        console.log('Response:', response.choices[0].message.content);
        console.log('\n📊 Details:');
        console.log('  Model:', response.model);
        console.log('  Tokens used:', response.usage.total_tokens);
        console.log('\n🎉 Your OpenAI integration is ready to use!');

    } catch (error) {
        console.log('\n❌ ERROR: API test failed\n');
        console.log('Error type:', error.constructor.name);
        console.log('Error message:', error.message);

        if (error.status) {
            console.log('HTTP Status:', error.status);
        }

        if (error.code) {
            console.log('Error code:', error.code);
        }

        console.log('\n💡 Common issues:');
        console.log('  1. Invalid API key - Get a new one from https://platform.openai.com/api-keys');
        console.log('  2. No credits - Add payment method at https://platform.openai.com/account/billing');
        console.log('  3. Rate limit - Wait a moment and try again');

        process.exit(1);
    }
}

simpleTest();
