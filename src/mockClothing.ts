import type { ClothingItem } from './wardrobe'

export const mockClothing: ClothingItem[] = [
  { id: 'white-tee', name: 'White T-shirt', category: 'Tops', color: '#ffffff' },
  { id: 'forest-sweatshirt', name: 'Forest sweatshirt', category: 'Tops', color: '#344c3a' },
  { id: 'blue-jeans', name: 'Blue jeans', category: 'Bottoms', color: '#527ba1' },
  { id: 'khaki-chinos', name: 'Khaki chinos', category: 'Bottoms', color: '#c0a57d' },
  { id: 'white-sneakers', name: 'White sneakers', category: 'Shoes', color: '#ffffff' },
  { id: 'canvas-sneakers', name: 'Canvas sneakers', category: 'Shoes', color: '#232323' },
]
for (const item of mockClothing) item.photo = '/demo/' + item.id + '.jpg'
