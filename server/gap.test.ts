import assert from 'node:assert/strict'
import { test } from 'node:test'
import { biggestGap } from '../src/gap.ts'
import type { ClothingCategory, ClothingItem } from '../src/wardrobe.ts'

function closet(...categories: ClothingCategory[]): ClothingItem[] {
  return categories.map((category, i) => ({ id: String(i), name: category, category, color: '#ffffff' }))
}

test('a top unlocks four combinations with two bottoms and two pairs of shoes', () => {
  assert.deepEqual(biggestGap(closet('Tops', 'Bottoms', 'Bottoms', 'Shoes', 'Shoes')),
    { category: 'Tops', newOutfits: 4, current: 4 })
})

test('prefers bottoms when they tie with shoes', () => {
  assert.deepEqual(biggestGap(closet('Tops', 'Tops', 'Bottoms', 'Shoes')),
    { category: 'Bottoms', newOutfits: 2, current: 2 })
})

test('returns null if a base category is missing', () => {
  assert.equal(biggestGap(closet('Tops', 'Bottoms', 'Outerwear')), null)
})

test('ignores outerwear when counting base outfits', () => {
  assert.deepEqual(biggestGap(closet('Tops', 'Bottoms', 'Shoes', 'Outerwear')),
    biggestGap(closet('Tops', 'Bottoms', 'Shoes')))
})
