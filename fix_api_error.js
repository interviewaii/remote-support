console.log('\n' + '='.repeat(70));
console.log('  ❌ API KEY ERROR DETECTED');
console.log('='.repeat(70));
console.log('');

console.log('🔍 PROBLEM FOUND:');
console.log('  Your app is using the OLD Gemini API key:');
console.log('  ❌ AIzaSyAx...dzW0 (Gemini - won\'t work with OpenAI)');
console.log('');
console.log('  But you need to use the NEW OpenAI API key:');
console.log('  ✅ sk-proj-O5Ctdx...co4wA (OpenAI - correct!)');
console.log('');

console.log('='.repeat(70));
console.log('  💡 WHY THIS HAPPENED');
console.log('='.repeat(70));
console.log('');
console.log('  1. Your app previously used Gemini API');
console.log('  2. The Gemini API key was saved in app settings');
console.log('  3. We migrated the code to OpenAI');
console.log('  4. But the old Gemini key is still saved');
console.log('  5. App tries to use Gemini key with OpenAI → ERROR!');
console.log('');

console.log('='.repeat(70));
console.log('  ✅ SOLUTION (Choose One)');
console.log('='.repeat(70));
console.log('');

console.log('OPTION 1: Clear Settings in the App (Easiest)');
console.log('  1. Look for Settings/Advanced in your app');
console.log('  2. Find "Clear All Data" or "Reset Settings"');
console.log('  3. Click it');
console.log('  4. Restart the app');
console.log('  5. Enter your OpenAI API key when prompted');
console.log('');

console.log('OPTION 2: Clear App Data Manually');
console.log('  1. Close the app (Ctrl+C in terminal)');
console.log('  2. Run this command:');
console.log('     Remove-Item -Recurse -Force "$env:APPDATA\\interview-ai"');
console.log('  3. Start app: npm start');
console.log('  4. Enter your OpenAI API key');
console.log('');

console.log('='.repeat(70));
console.log('  📋 YOUR OPENAI API KEY (Copy This!)');
console.log('='.repeat(70));
console.log('');
console.log('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');
console.log('');
console.log('  ⚠️  This is your OpenAI key - NOT the old Gemini key!');
console.log('');

console.log('='.repeat(70));
console.log('  🔑 KEY DIFFERENCES');
console.log('='.repeat(70));
console.log('');
console.log('  Gemini API keys:  AIzaSy... (OLD - won\'t work)');
console.log('  OpenAI API keys:  sk-proj-... or sk-... (NEW - use this!)');
console.log('');

console.log('='.repeat(70));
console.log('  ⚡ QUICK FIX COMMAND');
console.log('='.repeat(70));
console.log('');
console.log('Close the app, then run:');
console.log('');
console.log('Remove-Item -Recurse -Force "$env:APPDATA\\interview-ai" -ErrorAction SilentlyContinue; npm start');
console.log('');
console.log('Then enter your OpenAI key when prompted.');
console.log('');

console.log('='.repeat(70));
console.log('  📚 MORE INFO');
console.log('='.repeat(70));
console.log('');
console.log('  Read: FIX_API_KEY_ERROR.md for detailed instructions');
console.log('');

console.log('='.repeat(70));
console.log('');
