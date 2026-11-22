import assert from 'node:assert/strict'
import { test } from 'node:test'
import { nextCombination } from '../src/rotation.ts'
import type { ClothingCategory, ClothingItem } from '../src/wardrobe.ts'

function item(id: string, category: ClothingCategory): ClothingItem {
  return { id, category, name: id, color: '#112233' }
}
const base = [item('tee', 'Tops'), item('jeans', 'Bottoms'), item('chinos', 'Bottoms'), item('boots', 'Shoes'), item('sneakers', 'Shoes')]
const jacket = item('jacket', 'Outerwear')

test('cycle all four base combinations even when a layer is added and removed', () => {
  let history: string[] = []
  for (const closet of [base, [...base, jacket], base, [...base, jacket]]) {
    const choice = nextCombination(closet, history)!
    assert.equal(choice.count, 4)
    assert.equal(choice.pieces[0].id, 'tee')
    assert.equal(choice.pieces.includes(jacket), closet.includes(jacket))
    history = JSON.parse(JSON.stringify(choice.history))
  }
  assert.equal(new Set(history).size, 4)
  assert.equal(nextCombination(base, history)!.history.length, 1)
  assert.equal(nextCombination(base.filter(garment => garment.id !== 'tee').concat(jacket), []), null)
})
