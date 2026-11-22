import { useEffect, useState } from 'react'
import { listOutfits, removeOutfit } from './clothingStorage'
import OutfitBoard from './OutfitBoard'
import type { SavedOutfit } from './wardrobe'

export default function Saved() {
  const [outfits, setOutfits] = useState<SavedOutfit[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    listOutfits().then(rows => setOutfits(rows.sort((a,b) => b.savedAt - a.savedAt)),
      () => setError('Could not load saved outfits.'))
  }, [])
  return <>
    {error && <p role="alert">{error}</p>}
    {!outfits && !error && <p role="status">Loading outfits…</p>}
    {outfits?.length === 0 && <p>Save an outfit from Style Me to see it here.</p>}
    {outfits?.map(outfit => <article className="saved-outfit" key={outfit.id}>
      <h2>{outfit.occasion}</h2><OutfitBoard pieces={outfit.pieces} /><p>{outfit.reason}</p>
      <button onClick={async () => {
        try { await removeOutfit(outfit.id); setOutfits(current => current?.filter(row => row.id !== outfit.id) ?? []) }
        catch { setError('Could not remove the outfit.') }
      }}>Remove outfit</button>
    </article>)}
  </>
}
