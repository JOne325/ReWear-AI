import { isRecord, type GeminiConfig } from './gemini.ts'
import { clothingCategories, clothingNameLimit } from '../src/wardrobe.ts'

type ChatMessage = {
  role: 'user' | 'assistant'
  text: string
}

type ClosetPiece = {
  name: string
  category: string
  color: string
}

function parseCloset(raw: unknown): ClosetPiece[] | null {
  if (!Array.isArray(raw) || raw.length > 100) return null
  const result: ClosetPiece[] = []
  for (const item of raw) {
    if (!isRecord(item)) return null
    if (
      typeof item.name !== 'string' || !item.name.trim() || item.name.length > clothingNameLimit ||
      typeof item.category !== 'string' || !clothingCategories.some(c => c === item.category) ||
      typeof item.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(item.color)
    ) return null
    result.push({
      name: item.name.trim(),
      category: item.category,
      color: item.color,
    })
  }
  return result
}

function parseMessages(raw: unknown): ChatMessage[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 20) return null
  const result: ChatMessage[] = []
  for (const msg of raw) {
    if (!isRecord(msg)) return null
    if ((msg.role !== 'user' && msg.role !== 'assistant') || typeof msg.text !== 'string') return null
    const text = msg.text.trim()
    if (!text || text.length > 1000) return null
    result.push({ role: msg.role, text })
  }
  return result
}

export async function replyStylistChat(input: unknown, config: GeminiConfig, send = fetch) {
  if (!isRecord(input)) {
    return { status: 400, body: { error: 'Invalid chat request.' } }
  }

  const closet = parseCloset(input.items)
  const messages = parseMessages(input.messages)
  if (!closet || !messages) {
    return { status: 400, body: { error: 'Send your closet items and at least one message.' } }
  }

  if (!config.apiKey) {
    return { status: 503, body: { error: 'Stylist chat is unavailable until GEMINI_API_KEY is set in .env.' } }
  }

  const closetSummary = closet.length
    ? closet.map(i => `- ${i.name} (${i.category}, color ${i.color})`).join('\n')
    : '(The user currently has an empty closet.)'

  const systemInstruction = [
    'You are ReWear AI Stylist, a concise, practical personal wardrobe assistant.',
    'Here is the user’s current closet:',
    closetSummary,
    '',
    'Rules:',
    '1. Always prioritize styling outfits from items the user ALREADY owns first.',
    '2. If the user asks about an occasion, weather, or style that their current closet cannot cover well (for example, formal shoes, heavy winter outerwear, or a blazer), clearly name what they already have that works AND suggest 1–3 specific, versatile pieces they could buy to fill the gap.',
    '3. Keep replies concise, friendly, and scannable (under 140 words, using short bullet points).',
  ].join('\n')

  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.text }],
  }))

  const model = config.model || 'gemini-2.5-flash'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

  try {
    const response = await send(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': config.apiKey,
      },
      signal: AbortSignal.timeout(25_000),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 350,
        },
      }),
    })

    if (response.status === 429) {
      return { status: 429, body: { error: 'Too many requests right now. Wait a few seconds and try again.' } }
    }
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      console.error('[stylist-chat] Gemini error:', response.status, detail)
      return { status: 502, body: { error: 'Could not get a stylist reply right now.' } }
    }

    const payload: unknown = await response.json()
    const reply = isRecord(payload) &&
      Array.isArray(payload.candidates) &&
      isRecord(payload.candidates[0]) &&
      isRecord(payload.candidates[0].content) &&
      Array.isArray(payload.candidates[0].content.parts) &&
      isRecord(payload.candidates[0].content.parts[0]) &&
      typeof payload.candidates[0].content.parts[0].text === 'string'
      ? payload.candidates[0].content.parts[0].text.trim()
      : ''

    if (!reply) {
      return { status: 502, body: { error: 'The stylist returned an empty reply. Try again.' } }
    }

    return { status: 200, body: { reply } }
  } catch (cause) {
    if (cause instanceof Error && cause.name === 'TimeoutError') {
      return { status: 504, body: { error: 'Stylist chat timed out. Try again.' } }
    }
    return { status: 502, body: { error: 'Could not reach the stylist service.' } }
  }
}