import { useState } from 'react'
import { useClothing } from './useClothing'
import { mockClothing } from './mockClothing'
import { putOutfit } from './clothingStorage'
import { nextCombination } from './rotation'
import OutfitBoard from './OutfitBoard'
import { baseCategories, occasions, type Occasion, type OutfitRecommendation } from './wardrobe'

export default function StyleMe() {
  const { items, loadError } = useClothing()
  const [occasion, setOccasion] = useState<Occasion>('University')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [outfit, setOutfit] = useState<OutfitRecommendation | null>(null)
  if (loadError) return <p role="alert">Could not open your closet. Reload to try again.</p>
  if (!items) return <p role="status">Loading your closet…</p>
  const demo = items.length === 0
  const closet = demo ? mockClothing : items
  const groups = baseCategories.map(category => closet.filter(item => item.category === category))
  if (groups.some(group => !group.length)) return <p>Add a top, bottoms and shoes to your closet to start styling outfits.</p>
  const pieces = outfit?.itemIds.flatMap(id => closet.filter(item => item.id === id)) ?? []
  const onlyOne = groups.every(group => group.length === 1)

  async function suggest() {
    setBusy(true); setError('')
    try {
      const key = 'rewear:shown:' + (demo ? 'demo:' : 'closet:') + occasion
      const stored: unknown = JSON.parse(localStorage.getItem(key) ?? '[]')
      const history = Array.isArray(stored) ? stored.filter((entry): entry is string => typeof entry === 'string') : []
      const choice = nextCombination(closet, history)
      if (!choice) return
      const candidates = choice.pieces
      if (demo) {
        const [top, bottom, shoes] = candidates
        setOutfit({ itemIds: candidates.map(item => item.id), reason: occasion === 'Interview'
          ? top.name + ' and ' + bottom.name + ' make a casual interview outfit. Check whether the dress code allows sneakers.'
          : top.name + ' pairs with ' + bottom.name + ' for classes, and ' + shoes.name + ' keep the look casual.' })
      } else {
        const response = await fetch('/api/recommendations', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ occasion, items: candidates.map(({ id, name, category, color }) => ({ id, name, category, color })) }) })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Could not get an outfit.')
        setOutfit(result)
      }
      localStorage.setItem(key, JSON.stringify(choice.history))
      setSaved(false)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Try again.') }
    finally { setBusy(false) }
  }

  return <>
    <label>Occasion <select value={occasion} disabled={busy} onChange={event => {
      setOccasion(event.target.value as Occasion)
      setOutfit(null)
      setError('')
      setSaved(false)
    }}>{occasions.map(value => <option key={value}>{value}</option>)}</select></label><p>{demo ? 'Using the six-piece demo wardrobe.' : 'Style Me shares garment names, categories and colors with Gemini.'}</p>
    {onlyOne && <p>Your closet has one base outfit. Add another top, bottoms or pair of shoes for more combinations.</p>}
    <button className="action-button" disabled={busy} onClick={suggest}>{outfit ? 'Try Again' : 'Suggest an outfit'}</button>
    {error && <p role="alert">{error}</p>}
    {busy && !outfit && <p role="status">Finding an outfit…</p>}
    {outfit && <section aria-label="Suggested outfit"><OutfitBoard pieces={pieces} /><p>{outfit.reason}</p>
      <button className="action-button" disabled={busy || saved} onClick={async () => {
        setBusy(true); setError('')
        try {
          await putOutfit({ ...outfit, id: JSON.stringify(occasion === 'University' ? pieces.map(item => item.id) : [occasion, ...pieces.map(item => item.id)]), pieces, occasion, savedAt: Date.now() })
          setSaved(true)
        } catch { setError('Could not save this outfit. Try again.') }
        finally { setBusy(false) }
      }}>{saved ? 'Outfit saved' : 'Save outfit'}</button>
    </section>}
  </>
}
