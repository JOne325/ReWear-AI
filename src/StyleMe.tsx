import { useState } from 'react'
import { useClothing } from './useClothing'
import { mockClothing } from './mockClothing'
import { putOutfit } from './clothingStorage'
import OutfitBoard from './OutfitBoard'
import { clothingCategories, recommendationItemLimit, type OutfitRecommendation } from './wardrobe'

export default function StyleMe() {
  const { items, loadError } = useClothing()
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [turn, setTurn] = useState(0)
  const [outfit, setOutfit] = useState<OutfitRecommendation | null>(null)
  if (loadError) return <p role="alert">Could not open your closet. Reload to try again.</p>
  if (!items) return <p role="status">Loading your closet…</p>
  const demo = items.length === 0
  const closet = demo ? mockClothing : items
  const groups = clothingCategories.map(category => closet.filter(item => item.category === category))
  if (groups.some(group => !group.length)) return <p>Add a top, bottoms and shoes to your closet to start styling outfits.</p>
  const pieces = groups.flatMap(group => group.filter(item => outfit?.itemIds.includes(item.id)))

  async function suggest() {
    setBusy(true); setError('')
    try {
      if (demo) {
        const selected = groups.map((group, i) => group[Math.floor(turn / 2 ** i) % group.length])
        const [top, bottom, shoes] = selected
        const detail = top.id === 'forest-sweatshirt' ? 'adds a warm layer for cool lecture halls' : 'keeps the layers light for a full day of classes'
        setOutfit({ itemIds: selected.map(item => item.id), reason: 'The ' + top.name.toLowerCase() + ' ' + detail + ', while the ' + bottom.name.toLowerCase() + ' and ' + shoes.name.toLowerCase() + ' keep the outfit casual for campus.' })
        setTurn(turn + 1)
      } else {
        // Rotate one category with alternatives away from the previous selection.
        const alternate = groups.find(group => group.length > 1 && group.some(item => outfit?.itemIds.includes(item.id)))
        const eligible = closet.filter(item => !(alternate?.includes(item) && outfit?.itemIds.includes(item.id)))
        const first = clothingCategories.map(category => eligible.find(item => item.category === category)!)
        const candidates = [...first, ...eligible.filter(item => !first.includes(item))].slice(0, recommendationItemLimit)
        const response = await fetch('/api/recommendations', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: candidates.map(({ id, name, category, color }) => ({ id, name, category, color })) }) })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Could not get an outfit.')
        setOutfit(result)
      }
      setSaved(false)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Try again.') }
    finally { setBusy(false) }
  }

  return <>
    <h2>University</h2><p>{demo ? 'Using the six-piece demo wardrobe.' : 'Style Me shares garment names, categories and colors with Gemini.'}</p>
    <button className="action-button" disabled={busy} onClick={suggest}>{outfit ? 'Try Again' : 'Suggest an outfit'}</button>
    {error && <p role="alert">{error}</p>}
    {outfit && <section aria-label="Suggested outfit"><OutfitBoard pieces={pieces} /><p>{outfit.reason}</p>
      <button className="action-button" disabled={busy || saved} onClick={async () => {
        setBusy(true); setError('')
        try {
          await putOutfit({ ...outfit, id: JSON.stringify(pieces.map(item => item.id)), pieces, occasion: 'University', savedAt: Date.now() })
          setSaved(true)
        } catch { setError('Could not save this outfit. Try again.') }
        finally { setBusy(false) }
      }}>{saved ? 'Outfit saved' : 'Save outfit'}</button>
    </section>}
  </>
}
