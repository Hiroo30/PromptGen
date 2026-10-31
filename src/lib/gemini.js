export function getGeminiConfig() {
  const apiKey = String(import.meta.env.VITE_GEMINI_API_KEY || '').trim();
  const model = String(import.meta.env.VITE_GEMINI_MODEL || 'gemini-3.5-flash-lite').trim();
  return { apiKey, model, ready: Boolean(apiKey) };
}

export async function generateWithGemini(prompt, imageParts, signal) {
  const { apiKey, model, ready } = getGeminiConfig();
  if (!ready) {
    throw new Error('Add VITE_GEMINI_API_KEY to .env.local and restart the dev server.');
  }

  // Keep the SDK out of the first-load bundle. It is only needed after a user
  // has supplied media and requested a brief.
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }, ...imageParts],
      },
    ],
    config: {
      abortSignal: signal,
    },
  });

  const text = response.text?.trim();
  if (!text) {
    throw new Error('The model returned an empty response.');
  }
  return text;
}
