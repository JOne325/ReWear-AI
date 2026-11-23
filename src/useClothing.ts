import { useEffect, useState } from 'react'
import { editClothing, putClothing, removeClothing, listClothing } from './clothingStorage'
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

  async function saveItem(item: ClothingItem, editing: boolean) {
    let saved = item
    if (editing) saved = await editClothing(item)
    else await putClothing(item)
    setItems(current => [...(current ?? []).filter(other => other.id !== saved.id), saved])
  }

  async function deleteItem(id: string) {
    await removeClothing(id)
    setItems(current => (current ?? []).filter(item => item.id !== id))
  }

  return { items, loadError, saveItem, deleteItem }
}
