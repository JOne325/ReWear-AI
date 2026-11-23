export const baseCategories = ['Tops', 'Bottoms', 'Shoes'] as const
export const clothingCategories = [...baseCategories, 'Outerwear'] as const
export type ClothingCategory = typeof clothingCategories[number]

export const clothingNameLimit = 80
export const recommendationItemLimit = 100
export const styleRequestLimit = 300

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

export type StyleRequest = {
  current: string
  previous?: string
  previousItems?: string[]
}

export type SuggestedGarment = { category: ClothingCategory; name: string }

export type OutfitRecommendation = {
  itemIds: string[]
  reason: string
  title?: string
  missingItems?: SuggestedGarment[]
  notice?: string
}

export const occasions = ['University', 'Interview'] as const
export type Occasion = typeof occasions[number]

export type SavedOutfit = OutfitRecommendation & {
  id: string
  occasion?: Occasion
  pieces: ClothingItem[]
  savedAt: number
}

export function selectRecommendationItems(items: ClothingItem[], request?: StyleRequest): ClothingItem[] {
  if (items.length <= recommendationItemLimit) return items
  const words = [...new Set(request?.current.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [])]
  const previous = new Set(request?.previousItems)
  const rank = (item: ClothingItem) => {
    const name = item.name.toLowerCase()
    return words.filter(word => name.includes(word)).length + (previous.has(item.id) ? words.length + 1 : 0)
  }
  const ranked = words.length || previous.size
    ? items.map(item => ({ item, score: rank(item) })).sort((a, b) => b.score - a.score).map(({ item }) => item)
    : items
  const selected = new Set<ClothingItem>()
  for (const category of baseCategories) {
    const first = ranked.find(item => item.category === category)
    if (first) selected.add(first)
  }
  for (const item of ranked) {
    if (selected.size === recommendationItemLimit) break
    selected.add(item)
  }
  return items.filter(item => selected.has(item))
}
