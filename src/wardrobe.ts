export const clothingCategories = ['Tops', 'Bottoms', 'Shoes'] as const
export type ClothingCategory = typeof clothingCategories[number]

export const clothingNameLimit = 80
export const recommendationItemLimit = 100

export type ClothingItem = {
  id: string
  name: string
  category: ClothingCategory
  color: string
}

export type RecommendationItem = Pick<ClothingItem, 'id' | 'name' | 'category'>

export type OutfitRecommendation = {
  itemIds: string[]
  reason: string
}
