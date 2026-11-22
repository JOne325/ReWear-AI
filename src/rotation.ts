import { baseCategories, type ClothingItem } from './wardrobe.ts'

export function nextCombination(items: ClothingItem[], history: string[]) {
  const [tops, bottoms, shoes] = baseCategories.map(category => items.filter(item => item.category === category))
  const count = tops.length * bottoms.length * shoes.length
  if (!count) return null
  const seen = new Set(history)
  let base = [tops[0], bottoms[0], shoes[0]]
  let reset = true
  outer: for (const top of tops) for (const bottom of bottoms) for (const shoe of shoes) {
    const candidate = [top, bottom, shoe]
    if (!seen.has(JSON.stringify(candidate.map(item => item.id)))) {
      base = candidate
      reset = false
      break outer
    }
  }
  const key = JSON.stringify(base.map(item => item.id))
  const updated = reset ? [key] : [...history, key]
  const jackets = items.filter(item => item.category === 'Outerwear')
  const jacket = jackets[(updated.length - 1) % jackets.length]
  return { pieces: jacket ? [...base, jacket] : base, history: updated, count }
}
