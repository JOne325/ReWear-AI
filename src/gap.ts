import { baseCategories, type ClothingItem } from './wardrobe.ts'

export type Gap = { category: (typeof baseCategories)[number]; newOutfits: number; current: number }

// Which single extra item (top, bottoms or shoes) would add the most new base outfits?
export function biggestGap(items: ClothingItem[]): Gap | null {
  const sizes = baseCategories.map(c => items.filter(i => i.category === c).length)
  if (sizes.some(size => size === 0)) return null
  const current = sizes[0] * sizes[1] * sizes[2]
  const gaps = baseCategories.map((category, i) => ({
    category,
    current,
    newOutfits: sizes.reduce((n, size, j) => (j === i ? n : n * size), 1),
  }))
  return gaps.reduce((best, gap) => (gap.newOutfits > best.newOutfits ? gap : best))
}
