export function parseResponse(text) {
  const raw = String(text || '').trim();
  if (!raw) {
    throw new Error('The model returned an empty response.');
  }

  const englishMatch = raw.match(/---ENGLISH PROMPTS?---([\s\S]*?)---JSON OUTPUT---/i);
  const jsonMatch = raw.match(/---JSON OUTPUT---([\s\S]*)/i);

  let englishText = englishMatch ? englishMatch[1].trim() : raw;
  let jsonText = jsonMatch ? jsonMatch[1].trim() : '';

  jsonText = jsonText.replace(/^```(?:json)?/im, '').replace(/```$/im, '').trim();

  if (!jsonText) {
    const objectMatch = raw.match(/\{[\s\S]*\}\s*$/);
    jsonText = objectMatch ? objectMatch[0] : '';
  }

  if (jsonText) {
    try {
      jsonText = JSON.stringify(JSON.parse(jsonText), null, 2);
    } catch {
      // Keep the raw JSON block when the model emits invalid JSON.
    }
  } else {
    jsonText = '{\n  "error": "Could not parse JSON output."\n}';
  }

  return { englishText, jsonText };
}
