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
  assert.equal(result.status, 502)
})

test('limits repeated calls across both AI endpoints and resets the window', () => {
  for (let i = 0; i < 20; i++) assert.equal(admit('client', 1), true)
  assert.equal(admit('client', 1), false)
  assert.equal(admit('another', 1), true)
  assert.equal(admit('client', 60_001), true)
})
