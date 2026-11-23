import { isRecord } from './gemini.ts'

const jpegPrefix = 'data:image/jpeg;base64,'
export const tryOnBodyLimit = 3 * 1024 * 1024
const outputLimit = 8 * 1024 * 1024
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
const unavailable = { status: 502, error: 'The try-on provider could not make a preview. Try again later.' }

export function tryOnEndpoint(service?: string): URL | undefined {
  if (!service) return
  try {
    const url = new URL(service)
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    if (url.username || url.password || (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))) return
    return new URL('/tryon', url.origin)
  } catch { /* An invalid server configuration leaves try-on disabled. */ }
}

function jpegPhoto(value: unknown): Blob | undefined {
  if (typeof value !== 'string' || !value.startsWith(jpegPrefix)) return
  const encoded = value.slice(jpegPrefix.length)
  if (encoded.length > 2_000_000 || !/^\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(encoded)) return
  return new Blob([Buffer.from(encoded, 'base64')], { type: 'image/jpeg' })
}

async function readPng(response: Response) {
  if (!response.body || response.headers.get('content-type')?.split(';')[0] !== 'image/png') return
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let bytes = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      bytes += value.length
      if (bytes > outputLimit) {
        await reader.cancel()
        return
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const image = Buffer.concat(chunks, bytes)
  if (image.length > pngSignature.length && image.subarray(0, pngSignature.length).equals(pngSignature)) return image
}

export async function renderTryOn(input: unknown, service: string | undefined, signal: AbortSignal, send = fetch) {
  const endpoint = tryOnEndpoint(service)
  if (!endpoint) return { status: 503, error: 'Virtual try-on is offline on this server.' }
  if (!isRecord(input) || input.category !== 'Tops' || typeof input.name !== 'string' ||
      input.name.length > 80 || !input.name.trim()) {
    return { status: 400, error: 'Choose one top with a front photo.' }
  }
  const person = jpegPhoto(input.person)
  const garment = jpegPhoto(input.garment)
  if (!person || !garment) return { status: 400, error: 'Choose valid photos for yourself and the top.' }
  const form = new FormData()
  form.set('human_img', person, 'person.jpg')
  form.set('garm_img', garment, 'top.jpg')
  form.set('garment_des', input.name.trim())

  const deadline = AbortSignal.timeout(180_000)
  try {
    const response = await send(endpoint, { method: 'POST', redirect: 'error', body: form,
      signal: AbortSignal.any([signal, deadline]) })
    if (response.status === 429) {
      const detail: unknown = await response.json().catch(() => undefined)
      const quota = isRecord(detail) && detail.detail === 'shared_gpu_quota'
      return { status: 429, error: quota
        ? 'The shared try-on GPU has reached its quota. Try again later.'
        : 'Another try-on is running. Try again in a moment.' }
    }
    if (!response.ok) {
      await response.body?.cancel()
      switch (response.status) {
        case 400:
        case 413: return { status: response.status, error: 'Use a clear, larger photo that the try-on service can read.' }
        case 503: return { status: 503, error: 'The try-on service is offline. Try again later.' }
        case 504: return { status: 504, error: 'Try-on timed out. The GPU may be busy.' }
        default: return unavailable
      }
    }
    const image = await readPng(response)
    return image ? { status: 200, image } : unavailable
  } catch {
    if (signal.aborted) return { status: 499, error: 'Try-on canceled.' }
    if (deadline.aborted) return { status: 504, error: 'Try-on timed out. The GPU may be busy.' }
    return unavailable
  }
}
