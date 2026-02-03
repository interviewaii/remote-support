const { selectModel } = require('./src/utils/modelRouter');

const testCases = [
    { input: "Hello there", expected: "llama-3.1-8b-instant" }, // Simple
    { input: "Hi", expected: "llama-3.1-8b-instant" }, // Simple
    { input: "Can you help me?", expected: "llama-3.1-8b-instant" }, // Simple
    { input: "Write a python script to sort a list", expected: "llama-3.3-70b-versatile" }, // Code keyword
    { input: "Explain the difference between SQL and NoSQL", expected: "llama-3.3-70b-versatile" }, // Tech keyword
    { input: "I have a very long story to tell you about my day and how I went to the market and bought some apples and then came home to cook dinner.", expected: "llama-3.3-70b-versatile" }, // Long input
    { input: "What is the capital of France?", expected: "llama-3.1-8b-instant" }, // Simple fact (maybe debatable, but falls under simple heuristic)
    { input: "Design a scalable system for chat application", expected: "llama-3.3-70b-versatile" } // Design keyword
];

console.log("Running Model Router Tests...\n");

let passed = 0;
testCases.forEach((test, index) => {
    const result = selectModel(test.input);
    const splitInput = test.input.length > 50 ? test.input.substring(0, 47) + "..." : test.input;

    if (result === test.expected) {
        console.log(`✅ Test ${index + 1} Passed: "${splitInput}" -> ${result}`);
        passed++;
    } else {
        console.log(`❌ Test ${index + 1} Failed: "${splitInput}"`);
        console.log(`   Expected: ${test.expected}`);
        console.log(`   Got:      ${result}`);
    }
});

console.log(`\nResults: ${passed}/${testCases.length} passed.`);
