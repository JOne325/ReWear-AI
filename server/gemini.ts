export type GeminiConfig = {
  apiKey?: string
  model?: string
  photoModel?: string
  outfitModel?: string
  fallbackModels?: readonly string[]
}

const defaultModel = 'gemini-3.8-flash'
const defaultFallbacks = ['gemini-3.6-flash', 'gemini-3.5-flash-lite']

export function geminiConfig(env: Record<string, string | undefined>): GeminiConfig {
  return { apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL,
    photoModel: env.GEMINI_PHOTO_MODEL, outfitModel: env.GEMINI_OUTFIT_MODEL,
    fallbackModels: env.GEMINI_FALLBACK_MODELS?.split(',') ?? defaultFallbacks }
}

export async function generateWithModelFallback(
  config: GeminiConfig, override: string | undefined, payload: { generationConfig: object }, send: typeof fetch,
  retryStatuses: readonly number[] = [],
) {
  const normalize = (model: string) => model.trim().replace(/^models\//, '')
  const primary = normalize(override ?? '') || normalize(config.model ?? '') || defaultModel
  const models = [...new Set([primary, ...(config.fallbackModels ?? []).map(normalize).filter(Boolean)])].slice(0, 3)
  const deadline = AbortSignal.timeout(50_000)
  const request = (model: string, timeout: number) => send(
    'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.apiKey! },
      body: JSON.stringify(model === 'gemini-3.8-flash' ? {
        ...payload,
        generationConfig: { ...payload.generationConfig, thinkingConfig: { thinkingLevel: 'LOW' } },
      } : payload),
      signal: AbortSignal.any([deadline, AbortSignal.timeout(timeout)]),
    },
  )
  let retried = false
  async function attempt(index: number): Promise<Response> {
    const model = models[index]
    const hasFallback = index + 1 < models.length
    const timeout = hasFallback ? 15_000 : 25_000
    let response: Response
    try {
      response = await request(model, timeout)
      if (!retried && retryStatuses.includes(response.status)) {
        await response.body?.cancel()
        retried = true
        response = await request(model, timeout)
      }
    } catch (cause) {
      if (hasFallback && !deadline.aborted && cause instanceof Error && cause.name === 'TimeoutError') {
        return attempt(index + 1)
      }
      throw cause
    }
    if (hasFallback && !deadline.aborted && (response.status === 429 || response.status === 503)) {
      await response.body?.cancel()
      return attempt(index + 1)
    }
    return response
  }

  return attempt(0)
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function getCandidateText(data: unknown) {
  if (!isRecord(data) || !Array.isArray(data.candidates)) return ''
  const candidate: unknown = data.candidates[0]
  if (!isRecord(candidate) || !isRecord(candidate.content) || !Array.isArray(candidate.content.parts)) return ''
  return candidate.content.parts
    .flatMap((part: unknown) => isRecord(part) && !part.thought && typeof part.text === 'string' ? [part.text] : [])
    .join('')
}
