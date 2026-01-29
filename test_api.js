/**
 * OpenAI API Test with JSON output
 */

const OpenAI = require('openai');
const fs = require('fs');

const openai = new OpenAI({
    apiKey: "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",
});

async function testAPI() {
    const result = {
        timestamp: new Date().toISOString(),
        apiKey: 'sk-proj-O5Ctdx...co4wA',
        status: 'testing',
        error: null,
        response: null,
    };

    try {
        console.log('Testing OpenAI API...');

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "user", content: "Say: Hello! API works!" }
            ],
            max_tokens: 20,
        });

        result.status = 'SUCCESS';
        result.response = {
            content: response.choices[0].message.content,
            model: response.model,
            tokens: response.usage.total_tokens,
        };

        console.log('\n=== SUCCESS ===');
        console.log('Response:', response.choices[0].message.content);
        console.log('Model:', response.model);
        console.log('Tokens:', response.usage.total_tokens);
        console.log('\nYour OpenAI integration is working perfectly!');

    } catch (error) {
        result.status = 'FAILED';
        result.error = {
            name: error.constructor.name,
            message: error.message,
            status: error.status || null,
            code: error.code || null,
            type: error.type || null,
        };

        console.log('\n=== FAILED ===');
        console.log('Error:', error.message);
        if (error.status) console.log('Status:', error.status);
        if (error.code) console.log('Code:', error.code);
        if (error.type) console.log('Type:', error.type);
    }

    // Save to JSON file
    fs.writeFileSync('test_result.json', JSON.stringify(result, null, 2));
    console.log('\nResults saved to test_result.json');

    return result.status === 'SUCCESS';
}

testAPI().then(success => {
    process.exit(success ? 0 : 1);
});
