import { useEffect, useState } from 'react'
import { addClothing, listClothing } from './clothingStorage'
import type { ClothingItem } from './wardrobe'

export function useClothing() {
  const [items, setItems] = useState<ClothingItem[] | null>(null)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let active = true
    listClothing().then(
      stored => { if (active) setItems(stored) },
      () => { if (active) setLoadError(true) },
    )
    return () => { active = false }
  }, [])

  async function saveItem(details: Omit<ClothingItem, 'id'>) {
    const item = await addClothing(details)
    setItems(current => [...(current ?? []), item])
  }

  return { items, loadError, saveItem }
}
