import { useEffect, useState } from 'react'
import { useClothing } from './useClothing'
import { mockClothing } from './mockClothing'
import { putOutfit } from './clothingStorage'
import { nextCombination } from './rotation'
import { biggestGap } from './gap'
import { friendlyError } from './errors'
import OutfitBoard from './OutfitBoard'
import {
  baseCategories, clothingCategories, occasions, selectRecommendationItems,
  type ClothingItem, type Occasion, type OutfitRecommendation,
} from './wardrobe'

const gapLabels = { Tops: 'top', Bottoms: 'pair of bottoms', Shoes: 'pair of shoes' }

function outfitHistory(key: string): string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(key) ?? '[]')
    return Array.isArray(stored) ? stored.filter((entry): entry is string => typeof entry === 'string') : []
  } catch {
    return []
  }
}

function recentOutfits(key: string): string[][] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(key) ?? '[]')
    return Array.isArray(stored) ? stored.filter((entry): entry is string[] =>
      Array.isArray(entry) && entry.length <= 4 &&
      entry.every(id => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(id))).slice(-5) : []
  } catch {
    return []
  }
}

export default function StyleMe() {
  const { items, loadError } = useClothing()
  if (loadError) return <p role="alert">Could not open your closet. Reload to try again.</p>
  if (!items) return <p role="status">Loading your wardrobe…</p>

  const demo = items.length === 0
  return <OutfitEditor closet={demo ? mockClothing : items} demo={demo} />
}

function OutfitEditor({ closet, demo }: { closet: ClothingItem[]; demo: boolean }) {
  const [occasion, setOccasion] = useState<Occasion>('University')
  const [pending, setPending] = useState<'suggest' | 'save' | null>(null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [offline, setOffline] = useState(() => !navigator.onLine)
  const [outfit, setOutfit] = useState<OutfitRecommendation | null>(null)

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  const missing = baseCategories.filter(category => !closet.some(item => item.category === category))
  const pieces = clothingCategories.flatMap(category => closet.filter(item =>
    item.category === category && outfit?.itemIds.includes(item.id)))
  const gap = demo ? null : biggestGap(closet)
  const offlineHint = offline && <p role="status">{demo
    ? 'You are offline. Demo outfits are still available. Personal suggestions need internet.'
    : 'You are offline. Your closet is available, but suggestions need internet.'}</p>

  async function suggest() {
    setPending('suggest')
    setError('')
    try {
      let result: OutfitRecommendation
      if (demo) {
        const key = 'rewear:shown:demo:' + occasion
        const choice = nextCombination(closet, outfitHistory(key))
        if (!choice) return
        const [top, bottom, shoes] = choice.pieces
        result = { itemIds: choice.pieces.map(item => item.id), reason: occasion === 'Interview'
          ? top.name + ' and ' + bottom.name + ' make a casual interview outfit. Check whether the dress code allows sneakers.'
          : top.name + ' pairs with ' + bottom.name + ' for classes, and ' + shoes.name + ' keep the look casual.' }
        try { localStorage.setItem(key, JSON.stringify(choice.history)) } catch { /* The outfit is still usable. */ }
      } else {
        const key = 'rewear:recent:' + occasion
        const recent = recentOutfits(key)
        const candidates = selectRecommendationItems(closet)
        const response = await fetch('/api/recommendations', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ occasion, avoid: recent, items: candidates.map(({ id, name, category, color }) => ({ id, name, category, color })) }),
        })
        const data: OutfitRecommendation & { error?: string } = await response.json()
        if (!response.ok) throw new Error(data.error || 'Could not get an outfit.')
        result = data
        try { localStorage.setItem(key, JSON.stringify([...recent, result.itemIds].slice(-5))) } catch { /* The outfit is still usable. */ }
      }
      setOutfit(result)
      setSaved(false)
    } catch (cause) {
      setError(friendlyError(cause, 'Could not get an outfit. Try again.'))
    } finally {
      setPending(null)
    }
  }

  async function save() {
    if (!outfit || demo) return
    setPending('save')
    setError('')
    try {
      const itemIds = pieces.map(item => item.id)
      await putOutfit({
        id: JSON.stringify(occasion === 'University' ? itemIds : [occasion, ...itemIds]),
        itemIds, pieces, occasion, savedAt: Date.now(), reason: outfit.reason,
      })
      setSaved(true)
    } catch {
      setError('Could not save this outfit. Try again.')
    } finally {
      setPending(null)
    }
  }

  if (missing.length) return <section>
    {offlineHint}
    <h2>Finish your wardrobe</h2>
    <p>Add these categories to build an outfit: {missing.join(', ')}.</p>
    <a className="action-button text-action" href="/?add">Add garment</a>
  </section>

  return <>
    <label className="occasion-control">Occasion <select value={occasion} disabled={pending !== null} onChange={event => {
      setOccasion(event.target.value as Occasion)
      setOutfit(null)
      setError('')
      setSaved(false)
    }}>{occasions.map(value => <option key={value}>{value}</option>)}</select></label>
    <p>{demo ? 'Demo wardrobe. Add your own garments to get personal suggestions.' : 'Style Me sends garment names, categories and colors to Gemini.'}</p>
    {offlineHint}
    <button className="action-button" disabled={pending !== null || (!demo && offline)} onClick={suggest}>
      {outfit ? 'Try again' : 'Suggest an outfit'}
    </button>
    {error && <p role="alert">{error}</p>}
    {pending === 'suggest' && <p role="status">Finding an outfit…</p>}
    {outfit && <section aria-label="Suggested outfit" className="outfit-editor">
      <OutfitBoard pieces={pieces} />
      <div>
        <p>{outfit.reason}</p>
        {!demo && <div className="actions">
          <button className="action-button" disabled={pending !== null || saved} onClick={save}>{saved ? 'Outfit saved' : 'Save outfit'}</button>
          {saved && <a className="text-action" href="/saved">View saved outfits</a>}
        </div>}
      </div>
    </section>}
    {gap && <section className="closet-gap" aria-label="Closet gap">
      <h2>Closet gap</h2>
      <p>You can make {gap.current} combinations of a top, bottoms and shoes. One more {gapLabels[gap.category]} would unlock {gap.newOutfits} new outfits. Try borrowing or swapping first.</p>
    </section>}
  </>
}
