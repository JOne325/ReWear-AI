import assert from 'node:assert/strict'
import { test } from 'node:test'
import { foregroundBounds } from './cutoutMask.ts'

test('trims faint mask noise while keeping a margin around the garment', () => {
  const width = 12
  const rgba = new Uint8Array(width * width * 4)
  rgba[3] = 10
  for (let y = 4; y < 9; y++) {
    for (let x = 3; x < 9; x++) rgba[(y * width + x) * 4 + 3] = 255
  }
  assert.deepEqual(foregroundBounds(rgba, width, width), { left: 1, top: 2, width: 10, height: 9 })
})

test('rejects missing, effectively empty and nearly opaque masks', () => {
  assert.equal(foregroundBounds(new Uint8Array(36), 3, 3), null)
  assert.equal(foregroundBounds(new Uint8Array(400), 10, 10), null)
  assert.equal(foregroundBounds(new Uint8Array(400).fill(255), 10, 10), null)
})
