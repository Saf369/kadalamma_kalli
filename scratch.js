require('dotenv').config();
const { GoogleGenAI, Type } = require('@google/genai');

const ai = new GoogleGenAI({});

async function run() {
  try {
    // Generate a tiny valid transparent 1x1 png in base64
    const base64Data = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: "Read the text" },
            { inlineData: { data: base64Data, mimeType: 'image/png' } },
          ],
        },
      ],
    });
    console.log("Success:", response.text);
  } catch(e) {
    console.error("Crash:", e);
  }
}
run();
