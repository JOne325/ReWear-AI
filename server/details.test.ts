import assert from 'node:assert/strict'
import { test } from 'node:test'
import { suggestDetails } from './details.ts'
import { admit } from './api.ts'

const photo = 'data:image/jpeg;base64,/9j/2Q=='
const shoe = { name: 'Canvas sneakers', category: 'Shoes', color: '#fafafa' }

test('sends the selected JPEG and returns only editable fields', async () => {
  const result = await suggestDetails({ photo }, { apiKey: 'test' }, async (_url, init) => {
    const parts = JSON.parse(String(init?.body)).contents[0].parts
    assert.deepEqual(parts[1].inlineData, { mimeType: 'image/jpeg', data: '/9j/2Q==' })
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ ...shoe, extra: 1 }) }] } }] })
  })
  assert.deepEqual(result, { status: 200, body: shoe })
})

test('handles invalid photos, missing credentials and ambiguous garments', async () => {
  assert.equal((await suggestDetails({ photo: 'https://example.com/photo' }, {})).status, 400)
  assert.equal((await suggestDetails({ photo }, {})).status, 503)
  const result = await suggestDetails({ photo }, { apiKey: 'test' }, async () =>
    Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ ...shoe, category: 'Unknown' }) }] } }] }))
  assert.equal(result.status, 200)
  assert.equal('name' in result.body && result.body.name, shoe.name)
  assert.equal('category' in result.body && result.body.category, undefined)
  assert.match('notice' in result.body ? result.body.notice ?? '' : '', /category/)
})

test('retry a transient error once and distinguish quota, timeout, and invalid output', async () => {
  let calls = 0
  const config = { apiKey: 'test' }
  const result = await suggestDetails({ photo }, config, async () => {
    if (++calls === 1) return new Response(null, { status: 503 })
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(shoe) }] } }] })
  })
  assert.equal(result.status, 200)
  assert.equal(calls, 2)
  assert.equal((await suggestDetails({ photo }, config, async () => new Response(null, { status: 429 }))).status, 429)
  assert.equal((await suggestDetails({ photo }, config, async () => {
    throw new DOMException('timeout', 'TimeoutError')
  })).status, 504)
  const { body } = await suggestDetails({ photo }, config, async () => Response.json({}))
  assert.equal('code' in body && body.code, 'invalid_response')
})

test('limits repeated calls across both AI endpoints and resets the window', () => {
  for (let i = 0; i < 20; i++) assert.equal(admit('client', 1), true)
  assert.equal(admit('client', 1), false)
  assert.equal(admit('another', 1), true)
  assert.equal(admit('client', 60_001), true)
})

test('uses the next configured model when a garment photo hits provider quota', async () => {
  const models: string[] = []
  const result = await suggestDetails({ photo }, {
    apiKey: 'test', model: 'models/gemini-3.8-flash', fallbackModels: ['gemini-3.8-flash', 'gemini-3.6-flash'],
  }, async (url) => {
    models.push(String(url).split('/').at(-1)!)
    return models.length === 1 ? new Response(null, { status: 429 }) :
      Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({
        name: 'Maroon cable-knit sweater', category: 'Tops', color: '#552233',
      }) }] } }] })
  })
  assert.deepEqual(models, ['gemini-3.8-flash:generateContent', 'gemini-3.6-flash:generateContent'])
  assert.equal('name' in result.body && result.body.name, 'Maroon cable-knit sweater')
})

test('switches models when the photo provider is still unavailable after one retry', async () => {
  const models: string[] = []
  const result = await suggestDetails({ photo }, {
    apiKey: 'test', model: 'gemini-3.8-flash', fallbackModels: ['gemini-3.6-flash'],
  }, async (url) => {
    models.push(String(url).split('/').at(-1)!)
    return models.length <= 2 ? new Response(null, { status: 503 }) :
      Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({
        name: 'White T-shirt', category: 'Tops', color: '#ffffff',
      }) }] } }] })
  })
  assert.deepEqual(models, ['gemini-3.8-flash:generateContent', 'gemini-3.8-flash:generateContent', 'gemini-3.6-flash:generateContent'])
  assert.equal(result.status, 200)
})

test('switches models after a photo request times out', async () => {
  const models: string[] = []
  const result = await suggestDetails({ photo }, {
    apiKey: 'test', model: 'gemini-3.8-flash', fallbackModels: ['gemini-3.6-flash'],
  }, async (url) => {
    models.push(String(url).split('/').at(-1)!)
    if (models.length === 1) throw new DOMException('Timed out', 'TimeoutError')
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({
      name: 'White T-shirt', category: 'Tops', color: '#ffffff',
    }) }] } }] })
  })
  assert.deepEqual(models, ['gemini-3.8-flash:generateContent', 'gemini-3.6-flash:generateContent'])
  assert.equal(result.status, 200)
})
