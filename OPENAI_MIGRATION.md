# Migration from Gemini to OpenAI (ChatGPT)

## Overview
This project has been migrated from Google's Gemini API to OpenAI's ChatGPT API. The migration includes:

- **Chat Completions**: Using GPT-4o-mini for fast, cost-effective responses
- **Audio Transcription**: Using Whisper API for speech-to-text
- **Vision Capabilities**: Using GPT-4o for image analysis

## Setup Instructions

### 1. Install OpenAI Package
```bash
npm install openai
```

### 2. Get Your OpenAI API Key
1. Go to [OpenAI API Keys](https://platform.openai.com/account/api-keys)
2. Create a new API key
3. Copy the key (it starts with `sk-proj-...` or `sk-...`)

### 3. Update API Key in Application
Replace the API key in your application settings with your OpenAI API key.

## API Models Used

### Chat Completions
- **Model**: `gpt-4o-mini`
- **Purpose**: Fast, cost-effective text responses
- **Alternative**: `gpt-4o` or `gpt-4-turbo` for higher quality

### Audio Transcription
- **Model**: `whisper-1`
- **Purpose**: Convert speech to text
- **Supported formats**: mp3, mp4, mpeg, mpga, m4a, wav, webm

### Vision Analysis
- **Model**: `gpt-4o`
- **Purpose**: Analyze images and screenshots
- **Input**: Base64-encoded JPEG images

## Key Differences from Gemini

| Feature | Gemini | OpenAI |
|---------|--------|--------|
| **Real-time Audio** | Native WebSocket streaming | Whisper API (file-based) |
| **Response Mode** | Streaming via WebSocket | Streaming via Server-Sent Events |
| **Vision** | Inline in chat | GPT-4o with vision |
| **Tools** | Google Search built-in | Requires custom implementation |

## Code Changes

### Main Changes
1. **`src/utils/openai.js`**: New file replacing `src/utils/gemini.js`
2. **`src/index.js`**: Updated imports and references
3. **Audio Processing**: Now uses Whisper for transcription instead of real-time streaming

### Key Functions

#### Initialize Session
```javascript
await initializeOpenAISession(apiKey, customPrompt, resumeContext, profile, language);
```

#### Send Text Message
```javascript
await sendMessageToOpenAI(userMessage);
```

#### Transcribe Audio
```javascript
const transcription = await transcribeAudioWithWhisper(audioBuffer);
```

## Testing

### Test OpenAI Connection
```bash
node test_openai_connection.js
```

### Test Text Example
```bash
node openai_text_example.js
```

### Test Audio Example
```bash
node openai_audio_example.js
```

## Important Notes

### Audio Processing
- OpenAI's Whisper API requires audio files, not real-time streaming
- Audio chunks are accumulated and sent in 3-second batches
- This may introduce slight latency compared to Gemini's real-time processing

### Cost Considerations
- **GPT-4o-mini**: ~$0.15 per 1M input tokens, ~$0.60 per 1M output tokens
- **Whisper**: ~$0.006 per minute of audio
- **GPT-4o (vision)**: ~$2.50 per 1M input tokens, ~$10 per 1M output tokens

### Rate Limits
- Free tier: 3 requests per minute
- Tier 1: 500 requests per minute
- Check your limits at [OpenAI Rate Limits](https://platform.openai.com/account/rate-limits)

## Troubleshooting

### Invalid API Key Error
```
Error: Incorrect API key provided
```
**Solution**: Verify your API key at https://platform.openai.com/account/api-keys

### Rate Limit Error
```
Error: Rate limit exceeded
```
**Solution**: Wait a moment and try again, or upgrade your OpenAI plan

### Audio Transcription Error
```
Error: Invalid file format
```
**Solution**: Ensure audio is in WAV format with proper headers (handled automatically in the code)

## Migration Checklist

- [x] Install OpenAI package
- [x] Create `src/utils/openai.js`
- [x] Update `src/index.js` imports
- [x] Replace Gemini session references
- [x] Update IPC handlers
- [x] Test API connection
- [ ] Update API key in application
- [ ] Test full application flow
- [ ] Verify audio transcription
- [ ] Test image analysis

## Support

For OpenAI API documentation, visit:
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- [Chat Completions Guide](https://platform.openai.com/docs/guides/chat)
- [Whisper API Guide](https://platform.openai.com/docs/guides/speech-to-text)
- [Vision Guide](https://platform.openai.com/docs/guides/vision)

## License
Same as the original project (GPL-3.0)
