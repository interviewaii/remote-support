const { getSystemPrompt } = require('./src/utils/prompts');

const testScenarios = [
    {
        name: "Custom Bullet Point Override",
        profile: "interview",
        customPrompt: "Please answer in bullet points.",
        resume: "Senior Java Developer",
        expected: "USER OVERRIDE INSTRUCTIONS (PRIORITY: HIGH)"
    },
    {
        name: "Default Behavior (No Override)",
        profile: "interview",
        customPrompt: "",
        resume: "Senior Java Developer",
        expected: "**DEFAULT**: Use Paragraphs"
    }
];

console.log("Running Formatting Override Tests...\n");

testScenarios.forEach((test, index) => {
    const prompt = getSystemPrompt(test.profile, test.customPrompt, test.resume);

    if (prompt.includes(test.expected)) {
        console.log(`✅ Test ${index + 1} Passed: [${test.name}]`);
        if (test.customPrompt) {
            console.log(`   --> Override section found.`);
        }
    } else {
        console.log(`❌ Test ${index + 1} Failed: [${test.name}]`);
        console.log(`   --> Expected to find: "${test.expected}"`);
    }
});
