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
  const invalid = { status: 502, body: { code: 'invalid_response', error: 'Gemini returned unreadable details. Try another garment view or enter details manually.' } }
  if (!config.apiKey) return { status: 503, body: { error: 'Photo suggestions are unavailable. Enter the details manually.' } }
  const model = encodeURIComponent(config.photoModel || config.model || 'gemini-3.5-flash')
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
  const body = JSON.stringify({
        contents: [{ parts: [
          { text: 'Identify the main garment. Suggest a short descriptive name including visible pattern or material when clear, category, and dominant color as #RRGGBB. Classify jackets and coats as Outerwear. Choose Unknown if uncertain about the category, and still give the name and color when recognizable.' },
          { inlineData: { mimeType: 'image/jpeg', data } },
        ] }],
        generationConfig: { responseMimeType: 'application/json', responseJsonSchema: {
          type: 'object', required: ['name', 'category', 'color'], properties: {
            name: { type: 'string' }, category: { type: 'string', enum: [...clothingCategories, 'Unknown'] }, color: { type: 'string' },
          },
        } },
  })
  const request = () => send(url, { method: 'POST', body,
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.apiKey! },
    signal: AbortSignal.timeout(25_000) })
  let response: Response
  try {
    response = await request()
    if ([500, 502, 503, 504].includes(response.status)) {
      await response.body?.cancel()
      response = await request()
    }
  } catch (cause) {
    if (cause instanceof Error && cause.name === 'TimeoutError') {
      return { status: 504, body: { code: 'timeout', error: 'Photo analysis timed out. Try again or enter details manually.' } }
    }
    return { status: 502, body: { code: 'network', error: 'Could not reach Gemini. Try again or enter details manually.' } }
  }
  if (response.status === 429) return { status: 429, body: { code: 'rate_limit', error: 'Gemini has reached its rate or quota limit. Wait before retrying, or enter details manually.' } }
  if (!response.ok) return { status: 502, body: { code: 'provider_error', error: `Gemini could not analyze the photo (HTTP ${response.status}). Try again or enter details manually.` } }

  try {
    const value: unknown = JSON.parse(getCandidateText(await response.json()))
    if (!isRecord(value)) return invalid
    const name = typeof value.name === 'string' && value.name.trim().length <= clothingNameLimit ? value.name.trim() : ''
    const category = clothingCategories.find(category => category === value.category)
    const color = typeof value.color === 'string' && /^#[0-9a-f]{6}$/i.test(value.color) ? value.color : undefined
    if (!name && !category && !color && value.category !== 'Unknown') return invalid
    const missing = [!name && 'name', !category && 'category', !color && 'color'].filter(Boolean)
    return { status: 200, body: { name: name || undefined, category, color,
      ...(missing.length ? { notice: `Gemini was unsure about: ${missing.join(', ')}. Review and complete those fields manually.` } : {}) } }
  } catch { return invalid }
}
