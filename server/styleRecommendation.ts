import { baseCategories, clothingCategories, clothingNameLimit, type ClothingItem, type OutfitRecommendation, type SuggestedGarment } from '../src/wardrobe.ts'
import { isRecord } from './gemini.ts'

const basicPieces = { Tops: 'Plain top', Bottoms: 'Straight-leg trousers', Shoes: 'Neutral closed-toe shoes' }

function completeOutfit(items: ClothingItem[], itemIds: string[], suggested: SuggestedGarment[]) {
  const categories = new Set(items.filter(item => itemIds.includes(item.id)).map(item => item.category))
  for (const piece of suggested) categories.add(piece.category)
  const missingItems = [...suggested]
  for (const category of baseCategories) {
    if (categories.has(category)) continue
    const owned = items.find(item => item.category === category)
    if (owned) itemIds.push(owned.id)
    else missingItems.push({ category, name: basicPieces[category] })
  }
  return { itemIds, missingItems }
}

export function styleOutfit(value: unknown, items: ClothingItem[]): OutfitRecommendation | undefined {
  if (!isRecord(value) || !Array.isArray(value.itemIds) || value.itemIds.length > 4 ||
      typeof value.reason !== 'string' || !value.reason.trim() ||
      ('missingItems' in value && (!Array.isArray(value.missingItems) || value.missingItems.length > 4))) return undefined

  const itemIds: string[] = []
  const categories = new Set<string>()
  for (const id of value.itemIds) {
    const selected = items.find(item => item.id === id)
    if (!selected || categories.has(selected.category)) return undefined
    itemIds.push(selected.id)
    categories.add(selected.category)
  }
  const suggested: SuggestedGarment[] = []
  for (const item of Array.isArray(value.missingItems) ? value.missingItems : []) {
    if (!isRecord(item) || typeof item.name !== 'string' || !item.name.trim()) return undefined
    const category = clothingCategories.find(entry => entry === item.category)
    if (!category || categories.has(category)) return undefined
    categories.add(category)
    suggested.push({ category, name: item.name.trim().slice(0, clothingNameLimit) })
  }
  return {
    ...completeOutfit(items, itemIds, suggested),
    title: typeof value.title === 'string' ? value.title.trim().slice(0, 80) || undefined : undefined,
    reason: value.reason.trim().slice(0, 500),
  }
}

export function basicStyleOutfit(items: ClothingItem[]): OutfitRecommendation {
  const pieces = completeOutfit(items, [], [])
  return {
    ...pieces, title: 'A simple outfit to start with',
    reason: pieces.itemIds.length
      ? 'Start with the pieces you already own and fill any gaps with a similar garment.'
      : 'Try pairing a simple top with straight-leg trousers and neutral shoes. Borrowing or thrifting can fill a gap.',
    notice: 'Style Me could not tailor this answer right now. Here is a basic outfit idea.',
  }
}
