require('dotenv').config();
const Groq = require('groq-sdk');

console.log('--- Debugging API Keys ---');

const keyBuckets = {
    '70B': process.env.GROQ_KEYS_70B,
    '8B': process.env.GROQ_KEYS_8B
};

async function testKey(bucketName, keysString) {
    if (!keysString) {
        console.log(`[${bucketName}] No keys found in environment variable.`);
        return;
    }

    const keys = keysString.split(',').map(k => k.trim()).filter(k => k.length > 0);
    console.log(`[${bucketName}] Found ${keys.length} keys.`);

    if (keys.length === 0) return;

    const testKey = keys[0];
    const maskedKey = testKey.substring(0, 8) + '...';
    console.log(`[${bucketName}] Testing first key: ${maskedKey}`);

    const groq = new Groq({ apiKey: testKey, dangerouslyAllowBrowser: true, timeout: 5000 });

    try {
        await groq.chat.completions.create({
            messages: [{ role: 'user', content: 'hi' }],
            model: bucketName === '70B' ? 'llama-3.3-70b-versatile' : 'llama-3.1-8b-instant',
            max_tokens: 1
        });
        console.log(`[${bucketName}] ✅ Success! Key is working.`);
    } catch (error) {
        console.log(`[${bucketName}] ❌ Failed! Error: ${error.message}`);
    }
}

(async () => {
    await testKey('70B', keyBuckets['70B']);
    console.log('---');
    await testKey('8B', keyBuckets['8B']);
})();
