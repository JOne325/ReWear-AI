export const baseCategories = ['Tops', 'Bottoms', 'Shoes'] as const
export const clothingCategories = [...baseCategories, 'Outerwear'] as const
export type ClothingCategory = typeof clothingCategories[number]

export const clothingNameLimit = 80
export const recommendationItemLimit = 100

export type ClothingItem = {
  id: string
  name: string
  category: ClothingCategory
  color: string
  photo?: string
  backPhoto?: string
  wornCount?: number
  lastWornAt?: number
}

export type OutfitRecommendation = {
  itemIds: string[]
  reason: string
}

export const occasions = ['University', 'Interview'] as const
export type Occasion = typeof occasions[number]

export type SavedOutfit = OutfitRecommendation & {
  id: string
  occasion: Occasion
  pieces: ClothingItem[]
  savedAt: number
}

export function selectRecommendationItems(items: ClothingItem[]): ClothingItem[] {
  if (items.length <= recommendationItemLimit) return items
  const selected = new Set<ClothingItem>()
  for (const category of baseCategories) {
    const first = items.find(item => item.category === category)
    if (first) selected.add(first)
  }
  for (const item of items) {
    if (selected.size === recommendationItemLimit) break
    selected.add(item)
  }
  return items.filter(item => selected.has(item))
}
