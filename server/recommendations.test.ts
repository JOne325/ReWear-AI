import assert from 'node:assert/strict'
import { test } from 'node:test'
import { recommendOutfit } from './recommendations.ts'

const items = [
  { id: 'tee', name: 'White T-shirt', category: 'Tops', color: '#ffffff' },
  { id: 'jeans', name: 'Blue jeans', category: 'Bottoms', color: '#527ba1' },
  { id: 'shoes', name: 'White sneakers', category: 'Shoes', color: '#ffffff' },
]
const outfit = { itemIds: ['tee', 'jeans', 'shoes'], reason: 'A casual combination.' }
const config = { apiKey: 'test-key' }

function providerResponse(value: unknown) {
  return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(value) }] } }] })
}

test('returns an outfit containing only items sent from the closet', async () => {
  let prompt: unknown
  let apiKey: string | null = null
  const result = await recommendOutfit({ items }, config, async (_url, init) => {
    apiKey = new Headers(init?.headers).get('x-goog-api-key')
    prompt = JSON.parse(JSON.parse(String(init?.body)).contents[0].parts[0].text)
    return providerResponse(outfit)
  })
  assert.equal(apiKey, 'test-key')
  assert.deepEqual(prompt, items)
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

test('accepts Interview and rejects unsupported occasions', async () => {
  const result = await recommendOutfit({ items, occasion: 'Interview' }, config, async (_url, init) => {
    assert.match(JSON.parse(String(init?.body)).systemInstruction.parts[0].text, /Interview/)
    return providerResponse(outfit)
  })
  assert.equal(result.status, 200)
  assert.equal((await recommendOutfit({ items, occasion: 'Other' }, {})).status, 400)
})

test('allows outerwear as a layer and requires a separate base top', async () => {
  const jacket = { id: 'jacket', name: 'Navy jacket', category: 'Outerwear', color: '#223355' }
  const layered = [...outfit.itemIds, jacket.id]
  assert.equal((await recommendOutfit({ items: [...items, jacket] }, config, async () =>
    providerResponse({ ...outfit, itemIds: layered }))).status, 200)
  assert.equal((await recommendOutfit({ items: [...items, jacket] }, config, async () =>
    providerResponse(outfit))).status, 200)
  assert.equal((await recommendOutfit({ items: [...items.slice(1), jacket] }, config, async () =>
    assert.fail('Outerwear cannot fill the base-top slot'))).status, 400)
})

test('includes only owned recent outfit IDs in the system instruction', async () => {
  let instruction = ''
  const result = await recommendOutfit({ items, avoid: [['tee', 'jeans', 'shoes'], ['ghost']] }, config, async (_url, init) => {
    instruction = JSON.parse(String(init?.body)).systemInstruction.parts[0].text
    return providerResponse(outfit)
  })
  assert.equal(result.status, 200)
  assert.match(instruction, /Recent outfits.*tee/)
  assert.doesNotMatch(instruction, /ghost/)
})

test('rejects malformed recent outfits before calling Gemini', async () => {
  const result = await recommendOutfit({ items, avoid: 'nope' }, config, async () => {
    assert.fail('Gemini must not be called')
  })
  assert.deepEqual(result, { status: 400, body: { error: 'Send a valid list of recent outfits.' } })
})

test('omits recent outfit instructions when avoid is absent', async () => {
  let instruction = ''
  const result = await recommendOutfit({ items }, config, async (_url, init) => {
    instruction = JSON.parse(String(init?.body)).systemInstruction.parts[0].text
    return providerResponse(outfit)
  })
  assert.equal(result.status, 200)
  assert.doesNotMatch(instruction, /Recent outfits/)
})

test('returns a friendly quota error when all configured outfit models hit quota', async () => {
  let requests = 0
  const result = await recommendOutfit({ items }, {
    ...config, model: 'gemini-3.8-flash', fallbackModels: ['gemini-3.6-flash'],
  }, async () => {
    requests++
    return new Response(null, { status: 429 })
  })
  assert.equal(requests, 2)
  assert.equal(result.status, 429)
})

test('does not switch outfit models for an authentication failure', async () => {
  let requests = 0
  const result = await recommendOutfit({ items }, {
    ...config, fallbackModels: ['gemini-3.6-flash'],
  }, async () => {
    requests++
    return new Response(null, { status: 403 })
  })
  assert.equal(requests, 1)
  assert.equal(result.status, 502)
})
