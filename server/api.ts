import type { IncomingMessage, ServerResponse } from 'node:http'
import { geminiConfig, type GeminiConfig } from './gemini.ts'
import { renderTryOn, tryOnBodyLimit, tryOnEndpoint } from './tryon.ts'
import { recommendOutfit } from './recommendations.ts'
import { suggestDetails } from './details.ts'
import { removePhotoBackground } from './cutout.ts'

export const apiPaths = ['/api/clothing-details', '/api/recommendations', '/api/clothing-cutout', '/api/tryon']
const counts = new Map<string, number>()
let resetAt = 0
let total = 0
export function admit(address: string, now = Date.now()) {
  if (now >= resetAt) {
    counts.clear()
    total = 0
    resetAt = now + 60_000
  }
  const count = counts.get(address) ?? 0
  if (count >= 20 || total >= 100) return false
  counts.set(address, count + 1)
  total++
  return true
}

function respond(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
  response.end(JSON.stringify(body))
}

type ApiConfig = GeminiConfig & { tryOnService?: string }

export function apiConfig(env: Record<string, string | undefined>): ApiConfig {
  return { ...geminiConfig(env), tryOnService: env.VTON_SERVICE_URL }
}

export async function handleApi(request: IncomingMessage, response: ServerResponse, config: ApiConfig) {
  const path = request.url?.split('?')[0]
  const cutout = path === '/api/clothing-cutout'
  const photo = path === '/api/clothing-details'
  const tryOn = path === '/api/tryon'
  if (tryOn && request.method === 'GET') {
    respond(response, 200, { configured: Boolean(tryOnEndpoint(config.tryOnService)) })
    return
  }
  const maxBodyBytes = tryOn ? tryOnBodyLimit : photo || cutout ? 512 * 1024 : 64 * 1024
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    respond(response, 405, { error: 'Use POST for this request.' })
    return
  }

  if (request.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    respond(response, 415, { error: 'Send JSON for this request.' })
    return
  }

  if (!cutout && !admit(request.socket.remoteAddress || 'local')) {
    response.setHeader('Retry-After', '60')
    respond(response, 429, { error: 'Too many requests. Try again in a minute.' })
    return
  }
  const chunks: Buffer[] = []
  let bytes = 0
  let input: unknown
  try {
    for await (const chunk of request.iterator({ destroyOnReturn: false })) {
      bytes += chunk.length
      if (bytes > maxBodyBytes) {
        response.setHeader('Connection', 'close')
        respond(response, 413, { error: 'The request is too large.' })
        return
      }
      chunks.push(chunk)
    }
    input = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    respond(response, 400, { error: 'The request must be valid JSON.' })
    return
  }

  if (tryOn) {
    if (response.destroyed) return
    const controller = new AbortController()
    const close = () => controller.abort()
    response.once('close', close)
    try {
      const result = await renderTryOn(input, config.tryOnService, controller.signal)
      if (response.destroyed) return
      if ('image' in result) {
        response.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' })
        response.end(result.image)
      } else {
        respond(response, result.status, { error: result.error })
      }
    } finally {
      response.off('close', close)
    }
    return
  }

  const { status, body } = cutout
    ? await removePhotoBackground(input)
    : await (photo ? suggestDetails : recommendOutfit)(input, config)
  respond(response, status, body)
}
