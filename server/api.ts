import type { IncomingMessage, ServerResponse } from 'node:http'
import type { GeminiConfig } from './gemini.ts'
import { recommendOutfit } from './recommendations.ts'
import { suggestDetails } from './details.ts'
import { removePhotoBackground } from './cutout.ts'
import { replyStylistChat } from './stylistChat.ts'

export const apiPaths = ['/api/clothing-details', '/api/recommendations', '/api/clothing-cutout', '/api/stylist-chat']
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

export async function handleApi(request: IncomingMessage, response: ServerResponse, config: GeminiConfig) {
  const path = request.url?.split('?')[0]
  const cutout = path === '/api/clothing-cutout'
  const photo = path === '/api/clothing-details'
  const chat = path === '/api/stylist-chat'
  const maxBodyBytes = photo || cutout ? 512 * 1024 : 64 * 1024
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

  const { status, body } = cutout
    ? await removePhotoBackground(input)
    : await (chat ? replyStylistChat : photo ? suggestDetails : recommendOutfit)(input, config)
  respond(response, status, body)
}