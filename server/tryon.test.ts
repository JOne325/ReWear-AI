import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderTryOn } from './tryon.ts'

const photo = 'data:image/jpeg;base64,/9j/2Q=='
const input = { person: photo, garment: photo, category: 'Tops', name: ' linen shirt ' }
const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0])
const signal = new AbortController().signal

test('sends only two uploaded images and the selected top name to the configured service', async () => {
  const result = await renderTryOn(input, 'http://127.0.0.1:8000', signal, async (url, init) => {
    assert.equal(String(url), 'http://127.0.0.1:8000/tryon')
    assert.ok(init?.body instanceof FormData)
    assert.equal(init.body.get('garment_des'), 'linen shirt')
    assert.ok(init.body.get('human_img') instanceof Blob)
    assert.ok(init.body.get('garm_img') instanceof Blob)
    assert.deepEqual([...init.body.keys()].sort(), ['garm_img', 'garment_des', 'human_img'])
    return new Response(png, { headers: { 'Content-Type': 'image/png' } })
  })
  assert.equal(result.status, 200)
  assert.ok('image' in result)
  assert.deepEqual(result.image, Buffer.from(png))
})

test('rejects missing configuration, non-tops and external image URLs', async () => {
  const unused = async () => { assert.fail('Do not send to provider') }
  assert.equal((await renderTryOn(input, undefined, signal, unused)).status, 503)
  assert.equal((await renderTryOn({ ...input, category: 'Bottoms' }, 'http://127.0.0.1:8000', signal, unused)).status, 400)
  assert.equal((await renderTryOn({ ...input, person: 'https://example.com/person.jpg' }, 'http://127.0.0.1:8000', signal, unused)).status, 400)
})

test('maps provider failures, rejects invalid output and propagates cancellation', async () => {
  const service = 'http://127.0.0.1:8000'
  assert.equal((await renderTryOn(input, service, signal, async () => new Response(null, { status: 429 }))).status, 429)
  assert.equal((await renderTryOn(input, service, signal, async () => new Response('not a PNG', {
    headers: { 'Content-Type': 'image/png' },
  }))).status, 502)
  const canceled = new AbortController()
  canceled.abort()
  assert.equal((await renderTryOn(input, service, canceled.signal, async (_url, init) => {
    init?.signal?.throwIfAborted()
    assert.fail('Request should be canceled')
  })).status, 499)
})

test('distinguishes shared GPU quota exhaustion from another job in progress', async () => {
  const result = await renderTryOn(input, 'http://127.0.0.1:8000', signal,
    async () => Response.json({ detail: 'shared_gpu_quota' }, { status: 429 }))
  assert.deepEqual(result, { status: 429, error: 'The shared try-on GPU has reached its quota. Try again later.' })
})
