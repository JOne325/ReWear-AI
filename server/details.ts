import { clothingCategories, clothingNameLimit } from '../src/wardrobe.ts'
import { getCandidateText, isRecord, type GeminiConfig } from './gemini.ts'

export async function suggestDetails(input: unknown, config: GeminiConfig, send = fetch) {
  const prefix = 'data:image/jpeg;base64,'
  if (!isRecord(input) || typeof input.photo !== 'string' || !input.photo.startsWith(prefix)) {
    return { status: 400, body: { error: 'Choose and crop a JPEG photo first.' } }
  }
  const data = input.photo.slice(prefix.length)
  if (data.length > 500_000 || !data.startsWith('/9j/') || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
    return { status: 400, body: { error: 'The cropped image is invalid or too large.' } }
  }
  const failure = { status: 502, body: { error: 'Could not suggest details. Enter them manually or try again.' } }
  if (!config.apiKey) return { status: 503, body: { error: 'Photo suggestions are unavailable. Enter the details manually.' } }
  try {
    const model = encodeURIComponent(config.model || 'gemini-3.5-flash-lite')
    const response = await send(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.apiKey },
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({
        contents: [{ parts: [
          { text: 'Identify the main garment. Suggest a short descriptive name including visible pattern or material when clear, category, and dominant color as #RRGGBB. Choose Unknown for unsupported or unclear garments.' },
          { inlineData: { mimeType: 'image/jpeg', data } },
        ] }],
        generationConfig: { responseMimeType: 'application/json', responseJsonSchema: {
          type: 'object', required: ['name', 'category', 'color'], properties: {
            name: { type: 'string' }, category: { type: 'string', enum: [...clothingCategories, 'Unknown'] }, color: { type: 'string' },
          },
        } },
      }),
    })
    if (!response.ok) return failure
    const value: unknown = JSON.parse(getCandidateText(await response.json()))
    if (!isRecord(value) || typeof value.name !== 'string' || !value.name.trim() || value.name.length > clothingNameLimit ||
        !clothingCategories.some(category => category === value.category) || typeof value.color !== 'string' ||
        !/^#[0-9a-f]{6}$/i.test(value.color)) return failure
    return { status: 200, body: { name: value.name.trim(), category: value.category, color: value.color } }
  } catch { return failure }
}
