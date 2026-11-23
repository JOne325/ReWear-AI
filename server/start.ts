import { createReadStream } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { apiPaths, handleApi } from './api.ts'
import { geminiConfig } from './gemini.ts'

const dist = fileURLToPath(new URL('../dist/', import.meta.url))
const assets = new Map<string, string>()
for (const entry of await readdir(dist, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile()) continue
  const file = join(entry.parentPath, entry.name)
  assets.set('/' + relative(dist, file).split(sep).join('/'), file)
}
const types: Record<string, string> = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
}
const pages = new Set(['/', '/style', '/saved', '/guide'])
const config = geminiConfig(process.env)
createServer((req, res) => {
  const path = (req.url ?? '').split('?')[0]
  if (apiPaths.includes(path)) {
    void handleApi(req, res, config).catch(() => {
      if (!res.headersSent) res.writeHead(500)
      res.end()
    })
    return
  }
  const file = assets.get(pages.has(path) ? '/index.html' : path)
  if (!file) { res.writeHead(404).end(); return }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }).end(); return }
  res.setHeader('Content-Type', types[extname(file)] ?? 'application/octet-stream')
  if (req.method === 'HEAD') { res.end(); return }
  createReadStream(file).on('error', () => res.destroy()).pipe(res)
}).listen(Number(process.env.PORT || 3000))
