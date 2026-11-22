import assert from 'node:assert/strict'
import { test } from 'node:test'
import { recommendOutfit } from './recommendations.ts'

const items = [
  { id: 'tee', name: 'White T-shirt', category: 'Tops' },
  { id: 'jeans', name: 'Blue jeans', category: 'Bottoms' },
  { id: 'shoes', name: 'White sneakers', category: 'Shoes' },
]
const outfit = { itemIds: ['tee', 'jeans', 'shoes'], reason: 'A casual combination.' }
const config = { apiKey: 'test-key' }

function providerResponse(value: unknown) {
  return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(value) }] } }] })
}

test('returns an outfit containing only items sent from the closet', async () => {
  const result = await recommendOutfit({ items }, config, async (_url, init) => {
    assert.equal(new Headers(init?.headers).get('x-goog-api-key'), 'test-key')
    return providerResponse(outfit)
  })
  assert.deepEqual(result, { status: 200, body: outfit })
})

test('rejects an incomplete closet before calling Gemini', async () => {
  const result = await recommendOutfit({ items: items.slice(0, 2) }, config, async () => {
    assert.fail('Gemini must not be called')
  })
  assert.equal(result.status, 400)
})

test('rejects hallucinated and repeated IDs from Gemini', async () => {
  for (const itemIds of [['tee', 'jeans', 'unknown'], ['tee', 'tee', 'shoes']]) {
    const result = await recommendOutfit({ items }, config, async () => (
      providerResponse({ ...outfit, itemIds })
    ))
    assert.equal(result.status, 502)
  }
})

test('reports missing server configuration without calling Gemini', async () => {
  const result = await recommendOutfit({ items }, {}, async () => {
    assert.fail('Gemini must not be called')
  })
  assert.equal(result.status, 503)
})
