import type { ClothingItem } from './wardrobe'

const storeName = 'clothing'

function openCloset() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('rewear-wardrobe', 1)

    request.onupgradeneeded = () => {
      request.result.createObjectStore(storeName, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function withClothingStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openCloset()
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(storeName, mode)
      const request = run(transaction.objectStore(storeName))

      transaction.oncomplete = () => resolve(request.result)
      transaction.onabort = () => reject(transaction.error ?? new Error('Closet transaction aborted'))
    })
  } finally {
    db.close()
  }
}

export function listClothing() {
  return withClothingStore<ClothingItem[]>('readonly', store => store.getAll())
}

export async function addClothing(details: Omit<ClothingItem, 'id'>) {
  const item = { ...details, id: crypto.randomUUID() }
  await withClothingStore('readwrite', store => store.add(item))
  return item
}
