import type { ClothingItem, SavedOutfit } from './wardrobe'

type Store = 'clothing' | 'outfits'
function openCloset() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('rewear-wardrobe', 2)
    request.onupgradeneeded = () => {
      for (const store of ['clothing', 'outfits']) {
        if (!request.result.objectStoreNames.contains(store)) {
          request.result.createObjectStore(store, { keyPath: 'id' })
        }
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function transact<T>(store: Store, mode: IDBTransactionMode, run: (table: IDBObjectStore) => IDBRequest<T>) {
  const db = await openCloset()
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(store, mode)
      const request = run(transaction.objectStore(store))
      transaction.oncomplete = () => resolve(request.result)
      transaction.onabort = () => reject(transaction.error ?? new Error('Storage transaction aborted'))
    })
  } finally {
    db.close()
  }
}

export const listClothing = () => transact<ClothingItem[]>('clothing', 'readonly', table => table.getAll())
export const putClothing = (item: ClothingItem) => transact('clothing', 'readwrite', table => table.put(item))
export const removeClothing = (id: string) => transact('clothing', 'readwrite', table => table.delete(id))
export const listOutfits = () => transact<SavedOutfit[]>('outfits', 'readonly', table => table.getAll())
export const putOutfit = (outfit: SavedOutfit) => transact('outfits', 'readwrite', table => table.put(outfit))
export const removeOutfit = (id: string) => transact('outfits', 'readwrite', table => table.delete(id))
