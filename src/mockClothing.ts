export const clothingCategories = ['Tops', 'Bottoms', 'Shoes'] as const
export type ClothingCategory = typeof clothingCategories[number]

type MockClothingItem = {
  id: string
  name: string
  category: ClothingCategory
  color: string
}

export const mockClothing: readonly MockClothingItem[] = [
  { id: 'white-t-shirt', name: 'White T-shirt', category: 'Tops', color: '#fff' },
  { id: 'blue-jeans', name: 'Blue jeans', category: 'Bottoms', color: '#527ba1' },
  { id: 'white-sneakers', name: 'White sneakers', category: 'Shoes', color: '#fff' },
]
