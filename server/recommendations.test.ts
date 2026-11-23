import assert from 'node:assert/strict'
import { test } from 'node:test'
import { recommendOutfit } from './recommendations.ts'
import { recommendationItemLimit, selectRecommendationItems, type ClothingItem } from '../src/wardrobe.ts'

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

test('an oversized closet fills the cap and keeps every available base category', () => {
  const closet: ClothingItem[] = [
    ...Array.from({ length: 120 }, (_, i): ClothingItem => ({
      id: 'top-' + i, name: 'T-shirt', category: 'Tops', color: '#ffffff',
    })),
    { id: 'bottoms', name: 'Trousers', category: 'Bottoms', color: '#111111' },
    { id: 'shoes', name: 'Shoes', category: 'Shoes', color: '#111111' },
  ]
  const selected = selectRecommendationItems(closet)
  assert.equal(selected.length, recommendationItemLimit)
  assert.ok(selected.some(item => item.id === 'bottoms'))
  assert.ok(selected.some(item => item.id === 'shoes'))
  assert.deepEqual(selectRecommendationItems(closet.slice(-4)), closet.slice(-4))
})

test('Gemini receives every submitted garment and recent outfits stay in the instruction', async () => {
  const fullCloset = [...items,
    { id: 'sweater', name: 'Sweater', category: 'Tops', color: '#334455' },
    { id: 'boots', name: 'Boots', category: 'Shoes', color: '#222222' },
  ]
  const result = await recommendOutfit({ items: fullCloset, occasion: 'Interview', avoid: [outfit.itemIds] },
    config, async (_url, init) => {
      const prompt = JSON.parse(String(init?.body))
      assert.deepEqual(JSON.parse(prompt.contents[0].parts[0].text), fullCloset)
      assert.match(prompt.systemInstruction.parts[0].text, /Recent outfits to avoid repeating/)
      return providerResponse({ itemIds: ['sweater', 'jeans', 'boots'], reason: 'Layers suit a cool day.' })
    })
  assert.equal(result.status, 200)
})

test('retries a temporarily unavailable provider once with the same outfit request', async () => {
  const requests: RequestInit[] = []
  const result = await recommendOutfit({ items, avoid: [outfit.itemIds] }, config, async (_url, init) => {
    assert.ok(init)
    requests.push(init)
    return requests.length === 1 ? new Response(null, { status: 503 }) : providerResponse(outfit)
  })
  assert.equal(requests.length, 2)
  assert.equal(requests[0].body, requests[1].body)
  assert.deepEqual(result, { status: 200, body: outfit })
})

test('reports provider downtime when the one retry also returns 503', async () => {
  let attempts = 0
  const result = await recommendOutfit({ items }, config, async () => {
    attempts++
    return new Response(null, { status: 503 })
  })
  assert.equal(attempts, 2)
  assert.equal(result.status, 503)
  assert.match('error' in result.body ? result.body.error ?? '' : '', /temporarily unavailable/i)
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

test('sends style requests as data while keeping the closet payload unchanged', async () => {
  const result = await recommendOutfit({
    items, occasion: 'Interview',
    styleRequest: { current: '  Keep the shirt, but make it warmer. ', previous: 'Interview with the white shirt.' },
  }, config, async (_url, init) => {
    const prompt = JSON.parse(String(init?.body))
    assert.match(prompt.systemInstruction.parts[0].text, /styling preferences/)
    assert.deepEqual(JSON.parse(prompt.contents[0].parts[0].text), items)
    assert.deepEqual(JSON.parse(prompt.contents[0].parts[1].text), {
      current: 'Keep the shirt, but make it warmer.',
      previous: 'Interview with the white shirt.',
    })
    return providerResponse(outfit)
  })
  assert.equal(result.status, 200)
})

test('rejects missing or oversized style requests before calling Gemini', async () => {
  for (const styleRequest of ['', { current: ' ' }, { current: 'a'.repeat(301) }, { current: 'Warm outfit', previous: 42 }]) {
    const result = await recommendOutfit({ items, styleRequest }, config, async () => {
      assert.fail('Invalid style request must not reach Gemini')
    })
    assert.equal(result.status, 400)
  }
})

test('prioritizes garments that match the request when the closet exceeds the limit', () => {
  const closet: ClothingItem[] = [
    ...Array.from({ length: recommendationItemLimit }, (_, i): ClothingItem => ({
      id: 'top-' + i, name: 'T-shirt', category: 'Tops', color: '#ffffff',
    })),
    { id: 'bottoms', name: 'Trousers', category: 'Bottoms', color: '#111111' },
    { id: 'shoes', name: 'Shoes', category: 'Shoes', color: '#111111' },
    { id: 'raincoat', name: 'Waterproof raincoat', category: 'Outerwear', color: '#222222' },
  ]
  const selected = selectRecommendationItems(closet, { current: 'A waterproof outfit, please' })
  assert.equal(selected.length, recommendationItemLimit)
  assert.ok(selected.some(item => item.id === 'raincoat'))
  assert.ok(selected.some(item => item.id === 'bottoms'))
  assert.ok(selected.some(item => item.id === 'shoes'))
})

test('an empty closet can get a full outfit based only on a free-form request', async () => {
  const result = await recommendOutfit({ items: [], styleRequest: { current: 'What should I wear to a summer wedding?' } }, config,
    async (_url, init) => {
      const payload = JSON.parse(String(init?.body))
      assert.doesNotMatch(payload.systemInstruction.parts[0].text, /selected occasion: University/)
      return providerResponse({
        itemIds: [], reason: 'Light fabrics and simple shoes suit a summer wedding.',
        missingItems: [
          { category: 'Tops', name: 'Linen button-down' },
          { category: 'Bottoms', name: 'Light chinos' },
          { category: 'Shoes', name: 'Brown loafers' },
        ],
      })
    })
  assert.equal(result.status, 200)
  assert.equal('missingItems' in result.body ? result.body.missingItems?.length : 0, 3)
})

test('mixes owned garments and pieces to find when the closet is incomplete', async () => {
  const result = await recommendOutfit({ items: [items[0]], styleRequest: { current: 'Put together a café outfit.' } }, config,
    async () => providerResponse({
      itemIds: ['tee'], reason: 'A white tee can anchor the outfit.',
      missingItems: [{ category: 'Bottoms', name: 'Dark jeans' }],
    }))
  assert.equal(result.status, 200)
  assert.deepEqual('itemIds' in result.body && result.body.itemIds, ['tee'])
  assert.deepEqual('missingItems' in result.body && result.body.missingItems?.map(item => item.category), ['Bottoms', 'Shoes'])
})

test('falls back to an honest outfit idea when Gemini returns an unknown garment ID', async () => {
  const result = await recommendOutfit({ items: [items[0]], styleRequest: { current: 'Warm travel outfit.' } }, config,
    async () => providerResponse({ itemIds: ['invented'], reason: 'The invented item is perfect.' }))
  assert.equal(result.status, 200)
  assert.deepEqual('itemIds' in result.body && result.body.itemIds, ['tee'])
  assert.ok('notice' in result.body && result.body.notice)
})
