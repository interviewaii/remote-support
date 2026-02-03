const Tesseract = require('tesseract.js');

/**
 * Perform Local OCR using Tesseract.js
 * @param {string} base64Image - Base64 encoded image string (without data prefix)
 * @returns {Promise<string|null>} - Extracted text or null if failed
 */
async function performLocalOCR(base64Image) {
    try {
        console.log('Starting Local OCR (Tesseract.js)...');

        // Construct standard data URI
        const imageUri = `data:image/jpeg;base64,${base64Image}`;

        // Simple recognize call (creates/destroys worker automatically for safety)
        // For higher performance, we could manage a persistent worker, but for stability in Electron,
        // independent calls are safer to prevent memory leaks or hung workers.
        const { data: { text } } = await Tesseract.recognize(
            imageUri,
            'eng',
            {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        // console.log(`Local OCR Progress: ${(m.progress * 100).toFixed(0)}%`);
                    }
                },
                errorHandler: err => console.error('Tesseract Inner Error:', err)
            }
        );

        if (text && text.trim().length > 0) {
            console.log(`Local OCR Success: extracted ${text.length} chars`);
            return text.trim();
        }

        return null;

    } catch (error) {
        console.error('Local OCR Failed:', error);
        return null;
    }
}

module.exports = {
    performLocalOCR
};
