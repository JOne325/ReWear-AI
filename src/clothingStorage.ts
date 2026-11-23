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

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function transact<T>(store: Store, mode: IDBTransactionMode, run: (table: IDBObjectStore) => Promise<T>) {
  const db = await openCloset()
  try {
    const transaction = db.transaction(store, mode)
    const completed = new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onabort = () => reject(transaction.error ?? new Error('Storage transaction aborted'))
    })
    const operation = Promise.resolve().then(() => run(transaction.objectStore(store)))
    const [result] = await Promise.all([operation, completed])
    return result
  } finally {
    db.close()
  }
}

export const listClothing = (table?: IDBObjectStore): Promise<ClothingItem[]> => table
  ? requestResult(table.getAll())
  : transact('clothing', 'readonly', current => listClothing(current))
export const putClothing = (item: ClothingItem, table?: IDBObjectStore): Promise<IDBValidKey> => table
  ? requestResult(table.put(item))
  : transact('clothing', 'readwrite', current => putClothing(item, current))

export function recordClothingWear(itemIds: string[], wornAt: number) {
  const ids = new Set(itemIds)
  return transact('clothing', 'readwrite', async table => {
    const pieces = (await listClothing(table)).filter(item => ids.has(item.id))
    await Promise.all(pieces.map(item => putClothing({
      ...item, wornCount: (item.wornCount ?? 0) + 1, lastWornAt: wornAt,
    }, table)))
    return pieces.length
  })
}

export function editClothing(item: ClothingItem) {
  return transact('clothing', 'readwrite', async table => {
    const current: ClothingItem | undefined = await requestResult(table.get(item.id))
    if (!current) throw new Error('This garment is no longer in your closet.')
    const replacement = { ...item, wornCount: current.wornCount, lastWornAt: current.lastWornAt }
    await putClothing(replacement, table)
    return replacement
  })
}

export const removeClothing = (id: string) => transact('clothing', 'readwrite', table => requestResult(table.delete(id)))
export const listOutfits = () => transact<SavedOutfit[]>('outfits', 'readonly', table => requestResult(table.getAll()))
export const getOutfit = (id: string) => transact<SavedOutfit | undefined>('outfits', 'readonly', table => requestResult(table.get(id)))
export const putOutfit = (outfit: SavedOutfit) => transact('outfits', 'readwrite', table => requestResult(table.put(outfit)))
export const removeOutfit = (id: string) => transact('outfits', 'readwrite', table => requestResult(table.delete(id)))
