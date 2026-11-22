export type GeminiConfig = { apiKey?: string; model?: string }

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
