import type { ClothingItem } from './wardrobe.ts'

const scoreWindow = 30 * 24 * 60 * 60 * 1000

export function rewearScore(items: ClothingItem[], now = Date.now()): number | null {
  if (!items.length) return null
  const cutoff = now - scoreWindow
  const worn = items.filter(({ lastWornAt }) =>
    lastWornAt !== undefined && lastWornAt >= cutoff && lastWornAt <= now).length
  return Math.round(100 * worn / items.length)
}
