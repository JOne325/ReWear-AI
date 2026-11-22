export const clothingCategories = ['Tops', 'Bottoms', 'Shoes'] as const
export type ClothingCategory = typeof clothingCategories[number]

export const clothingNameLimit = 80
export const recommendationItemLimit = 100

export type ClothingItem = {
  id: string
  name: string
  category: ClothingCategory
  color: string
  photo?: string
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
