import { useEffect, useState } from 'react'
import { listOutfits, recordClothingWear, removeOutfit } from './clothingStorage'
import OutfitBoard from './OutfitBoard'
import type { SavedOutfit } from './wardrobe'

export default function Saved() {
  const [outfits, setOutfits] = useState<SavedOutfit[] | null>(null)
  const [logging, setLogging] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    listOutfits().then(rows => setOutfits(rows.sort((a, b) => b.savedAt - a.savedAt)),
      () => setError('Could not load saved outfits.'))
  }, [])

  async function logWear(outfit: SavedOutfit) {
    setLogging(outfit.id)
    setNotice('')
    setError('')
    try {
      const count = await recordClothingWear(outfit.itemIds, Date.now())
      setNotice(count ? 'Logged. Nice rewear!' : 'These garments are no longer in your closet.')
    } catch {
      setError('Could not log this wear. Try again.')
    } finally {
      setLogging(null)
    }
  }

  async function removeSavedOutfit(id: string) {
    setError('')
    try {
      await removeOutfit(id)
      setOutfits(current => current?.filter(row => row.id !== id) ?? [])
    } catch {
      setError('Could not remove the outfit.')
    }
  }

  return <>
    {error && <p role="alert">{error}</p>}
    <p className="form-confirmation" role="status">{notice}</p>
    {!outfits && !error && <p role="status">Loading outfits…</p>}
    {outfits?.length === 0 && <div className="empty-state">
      <h2>No saved outfits yet</h2>
      <p>Save a look from Style Me to revisit it and log when you wear it.</p>
      <a className="action-button" href="/style">Go to Style Me</a>
    </div>}
    {outfits?.map(outfit => <article className="saved-outfit" key={outfit.id}>
      <h2>{outfit.title ?? outfit.occasion ?? 'Saved outfit'}</h2><OutfitBoard pieces={outfit.pieces} /><p>{outfit.reason}</p>
      <div className="actions">
        <button className="action-button" type="button" disabled={logging !== null}
          onClick={() => void logWear(outfit)}>{logging === outfit.id ? 'Logging wear…' : 'I wore this'}</button>
        <button type="button" onClick={() => void removeSavedOutfit(outfit.id)}>Remove outfit</button>
      </div>
    </article>)}
  </>
}
