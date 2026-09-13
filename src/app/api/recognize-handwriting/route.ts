import { GoogleGenAI, Type } from '@google/genai';
import { NextResponse } from 'next/server';

// Initialize Gemini client (automatically uses process.env.GEMINI_API_KEY)
const ai = new GoogleGenAI({});

export async function POST(request: Request) {
  try {
    const { imageBase64 } = await request.json();

    if (!imageBase64) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    // Strip the data:image/png;base64, prefix if present
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    console.log(`Received image base64 length: ${base64Data.length}`);

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `You are a handwriting recognition system for an interactive beach game.

Look carefully at the handwritten text in this image.

Determine whether the user intended to write:

'Kadalamma Kalli'

The handwriting may be messy, cursive, imperfect, rotated, or have unusual spacing.

Return ONLY valid JSON in this exact format:

{
"recognizedText": "string",
"isKadalammaKalli": true,
"confidence": 0.0
}

Set isKadalammaKalli to true only when the handwriting reasonably represents 'Kadalamma Kalli'.

Do not guess when there is insufficient evidence.

confidence must be a number between 0 and 1.`,
            },
            {
              inlineData: {
                data: base64Data,
                mimeType: 'image/png',
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recognizedText: {
              type: Type.STRING,
            },
            isKadalammaKalli: {
              type: Type.BOOLEAN,
            },
            confidence: {
              type: Type.NUMBER,
            },
          },
          required: ['recognizedText', 'isKadalammaKalli', 'confidence'],
        },
      },
    });

    const jsonText = response.text;
    if (!jsonText) {
      throw new Error('No response text from Gemini');
    }

    const result = JSON.parse(jsonText);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Gemini API Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process image' },
      { status: 500 }
    );
  }
}
