console.log('\n' + '='.repeat(70));
console.log('  🚨 STILL GETTING 401 ERROR - HERE\'S WHY');
console.log('='.repeat(70));
console.log('');

console.log('❌ The app is STILL using the old Gemini key: AIzaSyAx...dzW0');
console.log('');
console.log('This is because the old key is saved in your app settings.');
console.log('You need to CLEAR it first!');
console.log('');

console.log('='.repeat(70));
console.log('  ⚡ FOLLOW THESE STEPS EXACTLY:');
console.log('='.repeat(70));
console.log('');

console.log('STEP 1: Close the app');
console.log('  → Press Ctrl+C in the terminal where app is running');
console.log('');

console.log('STEP 2: Clear the saved settings');
console.log('  → Run this command in PowerShell:');
console.log('');
console.log('  Remove-Item -Recurse -Force "$env:APPDATA\\interview-ai" -ErrorAction SilentlyContinue');
console.log('');

console.log('STEP 3: Start the app again');
console.log('  → Run: npm start');
console.log('');

console.log('STEP 4: Enter your OpenAI API key');
console.log('  → When the app asks for API key, paste this:');
console.log('');
console.log('  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');
console.log('');

console.log('='.repeat(70));
console.log('  📝 COPY THIS COMMAND:');
console.log('='.repeat(70));
console.log('');
console.log('Remove-Item -Recurse -Force "$env:APPDATA\\interview-ai" -ErrorAction SilentlyContinue');
console.log('');

console.log('='.repeat(70));
console.log('  💡 WHY YOU NEED TO DO THIS:');
console.log('='.repeat(70));
console.log('');
console.log('The app saves your API key in:');
console.log('  C:\\Users\\YOUR_USERNAME\\AppData\\Roaming\\interview-ai');
console.log('');
console.log('The old Gemini key is still there!');
console.log('We need to delete this folder to clear the old key.');
console.log('');

console.log('='.repeat(70));
console.log('  ⚠️  IMPORTANT:');
console.log('='.repeat(70));
console.log('');
console.log('Just restarting the app WON\'T fix it!');
console.log('You MUST clear the app data first!');
console.log('');

console.log('='.repeat(70));
console.log('');
