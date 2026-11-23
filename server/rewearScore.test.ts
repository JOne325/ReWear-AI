import assert from 'node:assert/strict'
import test from 'node:test'
import { rewearScore } from '../src/rewearScore.ts'
import type { ClothingItem } from '../src/wardrobe.ts'

const day = 24 * 60 * 60 * 1000
const now = Date.UTC(2026, 10, 23)
const item = (id: string, lastWornAt?: number): ClothingItem => ({
  id, name: id, category: 'Tops', color: '#ffffff', lastWornAt,
})

test('an empty closet has no ReWear Score', () => {
  assert.equal(rewearScore([], now), null)
})

test('two of four items worn in the last 30 days score 50', () => {
  const closet = [item('today', now), item('boundary', now - 30 * day), item('old', now - 32 * day), item('new')]
  assert.equal(rewearScore(closet, now), 50)
})

test('wears 31 days ago and future timestamps do not count', () => {
  assert.equal(rewearScore([item('old', now - 31 * day), item('future', now + day)], now), 0)
})
