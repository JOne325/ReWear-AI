import { baseCategories, type ClothingItem } from './wardrobe.ts'

export function nextCombination(items: ClothingItem[], history: string[]) {
  const [tops, bottoms, shoes] = baseCategories.map(category =>
    items.filter(item => item.category === category),
  )
  const count = tops.length * bottoms.length * shoes.length
  if (!count) return null

  const allCombos: { key: string; pieces: ClothingItem[] }[] = []
  for (const top of tops) {
    for (const bottom of bottoms) {
      for (const shoe of shoes) {
        const pieces = [top, bottom, shoe]
        allCombos.push({
          key: JSON.stringify(pieces.map(item => item.id)),
          pieces,
        })
      }
    }
  }

  const seen = new Set(history)
  const unseen = allCombos.filter(combo => !seen.has(combo.key))
  const reset = unseen.length === 0
  const pool = reset ? allCombos : unseen
  const picked = pool[Math.floor(Math.random() * pool.length)]

  const updated = reset ? [picked.key] : [...history, picked.key]
  const jackets = items.filter(item => item.category === 'Outerwear')
  const jacket = jackets.length
    ? jackets[Math.floor(Math.random() * jackets.length)]
    : undefined

  return {
    pieces: jacket ? [...picked.pieces, jacket] : picked.pieces,
    history: updated,
    count,
  }
}