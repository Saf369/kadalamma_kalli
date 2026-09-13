const { GoogleGenAI, Type } = require('@google/genai');
const ai = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY});
async function run() {
  const response = await ai.models.generateContent({
    model: 'gemini-3.5-flash',
    contents: [
      {
        role: 'user',
        parts: [
          { text: 'Analyze this image.' },
          { inlineData: { data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', mimeType: 'image/png' } }
        ]
      }
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          recognizedText: { type: Type.STRING },
          isKadalammaKalli: { type: Type.BOOLEAN },
          confidence: { type: Type.NUMBER },
        },
        required: ['recognizedText', 'isKadalammaKalli', 'confidence'],
      },
    }
  });
  console.log(response.text);
}
run().catch(console.error);
