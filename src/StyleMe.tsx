import { useEffect, useState } from 'react'
import { useClothing } from './useClothing'
import { mockClothing } from './mockClothing'
import { getOutfit, putOutfit } from './clothingStorage'
import { nextCombination } from './rotation'
import { biggestGap } from './gap'
import OutfitBoard from './OutfitBoard'
import {
  baseCategories, clothingCategories, occasions, recommendationItemLimit,
  type ClothingCategory, type ClothingItem, type Occasion, type OutfitRecommendation, type SavedOutfit,
} from './wardrobe'

const slots: Record<ClothingCategory, string> = {
  Tops: 'Top', Bottoms: 'Bottoms', Shoes: 'Shoes', Outerwear: 'Outerwear',
}
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
  const params = new URLSearchParams(window.location.search)
  const remixId = params.get('remix')
  const pieceId = params.get('piece')
  const [remix, setRemix] = useState<SavedOutfit | null | undefined>(remixId ? undefined : null)

  useEffect(() => {
    if (!remixId) return
    let active = true
    void getOutfit(remixId).then(
      result => { if (active) setRemix(result ?? null) },
      () => { if (active) setRemix(null) },
    )
    return () => { active = false }
  }, [remixId])

  if (loadError) return <p role="alert">Could not open your closet. Reload to try again.</p>
  if (!items || remix === undefined) return <p role="status">Loading your wardrobe…</p>

  const demo = items.length === 0
  const closet = demo ? mockClothing : items
  const pin = closet.find(item => item.id === pieceId)
  const canRemix = remix && remix.pieces.every(piece =>
    closet.some(item => item.id === piece.id && item.category === piece.category))
  const missingRemix = remixId && !canRemix

  return <>
    {missingRemix && <p role="status">This saved look is unavailable to remix. You can start a fresh outfit from your current wardrobe.</p>}
    {pieceId && !pin && <p role="status">That piece is no longer in your wardrobe. You can still style another outfit.</p>}
    <OutfitEditor closet={closet} demo={demo} pin={pin} remix={canRemix ? remix : null} />
  </>
}

function OutfitEditor({ closet, demo, pin, remix }: {
  closet: ClothingItem[]
  demo: boolean
  pin?: ClothingItem
  remix: SavedOutfit | null
}) {
  const [occasion, setOccasion] = useState<Occasion>(remix?.occasion ?? 'University')
  const [pending, setPending] = useState<'suggest' | 'save' | null>(null)
  const [saved, setSaved] = useState(Boolean(remix))
  const [error, setError] = useState('')
  const [outfit, setOutfit] = useState<OutfitRecommendation | null>(
    remix ? { itemIds: remix.pieces.map(piece => piece.id), reason: remix.reason } : null)
  const eligible = pin ? closet.filter(item => item.category !== pin.category || item.id === pin.id) : closet
  const missing = baseCategories.filter(category => !eligible.some(item => item.category === category))
  const pieces = clothingCategories.flatMap(category => closet.filter(item =>
    item.category === category && outfit?.itemIds.includes(item.id)))
  const onlyOne = baseCategories.every(category => eligible.filter(item => item.category === category).length === 1)
  const gap = demo ? null : biggestGap(closet)
  const swappable = clothingCategories.flatMap(category => {
    if (pin?.category === category) return []
    const choices = eligible.filter(item => item.category === category)
    return choices.length >= (category === 'Outerwear' ? 1 : 2) ? [{ category, choices }] : []
  })

  if (missing.length) return <section>
    <h2>Finish your wardrobe</h2>
    <p>Add these categories to build an outfit: {missing.join(', ')}.</p>
    <a className="action-button text-action" href="/?add">Add clothing</a>
  </section>

  async function suggest() {
    setPending('suggest')
    setError('')
    try {
      let result: OutfitRecommendation
      if (demo) {
        const scope = pin && pin.category !== 'Outerwear' ? ':piece:' + pin.id : ''
        const key = 'rewear:shown:demo:' + occasion + scope
        const choice = nextCombination(eligible, outfitHistory(key))
        if (!choice) return
        const candidates = choice.pieces
        const [top, bottom, shoes] = candidates
        result = { itemIds: candidates.map(item => item.id), reason: occasion === 'Interview'
          ? top.name + ' and ' + bottom.name + ' make a casual interview outfit. Check whether the dress code allows sneakers.'
          : top.name + ' pairs with ' + bottom.name + ' for classes, and ' + shoes.name + ' keep the look casual.' }
        try { localStorage.setItem(key, JSON.stringify(choice.history)) } catch { /* The outfit is still usable. */ }
      } else {
        const key = 'rewear:recent:' + occasion
        const recent = recentOutfits(key)
        const candidates = closet.length <= recommendationItemLimit ? closet : clothingCategories.flatMap(category =>
          closet.filter(item => item.category === category).slice(0, category === 'Outerwear' ? 10 : 30))
        const response = await fetch('/api/recommendations', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ occasion, avoid: recent, items: candidates.map(({ id, name, category, color }) => ({ id, name, category, color })) }),
        })
        const data: OutfitRecommendation & { error?: string } = await response.json()
        if (!response.ok) throw new Error(data.error || 'Could not get an outfit.')
        result = data
        if (pin && !result.itemIds.includes(pin.id)) {
          const sameSlot = new Set(closet.filter(item => item.category === pin.category).map(item => item.id))
          result = { itemIds: [...result.itemIds.filter(id => !sameSlot.has(id)), pin.id], reason: 'Built around your pinned piece: ' + pin.name + '.' }
        }
        try { localStorage.setItem(key, JSON.stringify([...recent, result.itemIds].slice(-5))) } catch { /* The outfit is still usable. */ }
      }
      setOutfit(result)
      setSaved(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Try again.')
    } finally {
      setPending(null)
    }
  }

  function swap(category: ClothingCategory, id: string) {
    const replacement = eligible.find(item => item.category === category && item.id === id)
    if (!replacement && (category !== 'Outerwear' || id)) return
    const next = pieces.filter(item => item.category !== category)
    if (replacement) next.push(replacement)
    setOutfit({ itemIds: next.map(item => item.id), reason: '' })
    setError('')
    setSaved(false)
  }

  async function save() {
    setPending('save')
    setError('')
    try {
      const itemIds = pieces.map(item => item.id)
      await putOutfit({
        id: JSON.stringify(occasion === 'University' ? itemIds : [occasion, ...itemIds]),
        itemIds, pieces, occasion, savedAt: Date.now(), reason: outfit?.reason || 'Customized in Style Me.',
      })
      setSaved(true)
    } catch {
      setError('Could not save this outfit. Try again.')
    } finally {
      setPending(null)
    }
  }

  return <>
    {pin && <p>Styling <strong className="pinned-piece">{pin.name}</strong>. <a className="text-action" href="/style">Unpin garment</a></p>}
    <label className="occasion-control">Occasion <select value={occasion} disabled={pending !== null} onChange={event => {
      setOccasion(event.target.value as Occasion)
      setOutfit(null)
      setError('')
      setSaved(false)
    }}>{occasions.map(value => <option key={value}>{value}</option>)}</select></label>
    <p>{demo ? 'Using the demo wardrobe.' : 'Style Me shares garment names, categories and colors with Gemini.'}</p>
    {onlyOne && <p>{pin ? 'Only one base outfit matches this pinned piece.' : 'Your closet has one base outfit.'} Add more pieces for more combinations.</p>}
    <button className="action-button" disabled={pending !== null} onClick={suggest}>{outfit ? 'Try Again' : 'Suggest an outfit'}</button>
    {error && <p role="alert">{error}</p>}
    {pending === 'suggest' && <p role="status">Finding an outfit…</p>}
    {outfit && <section aria-label="Suggested outfit" className="outfit-editor">
      <OutfitBoard pieces={pieces} />
      <div>
        {outfit.reason && <p>{outfit.reason}</p>}
        <fieldset className="swap-controls" disabled={pending !== null}>
          <legend>Swap a piece</legend>
          {swappable.map(({ category, choices }) =>
            <label key={category}>
              {slots[category]}
              <select aria-label={'Swap ' + slots[category].toLowerCase()}
                value={pieces.find(item => item.category === category)?.id ?? ''}
                onChange={event => swap(category, event.target.value)}>
                {category === 'Outerwear' && <option value="">No outerwear</option>}
                {choices.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
          )}
          {!swappable.length && <p>Add another garment to swap pieces.</p>}
        </fieldset>
        <div className="actions">
          <button className="action-button" disabled={pending !== null || saved} onClick={save}>{saved ? 'Outfit saved' : 'Save outfit'}</button>
          {saved && <a className="text-action" href="/saved">View saved outfits</a>}
        </div>
      </div>
    </section>}
    {gap && <section className="closet-gap" aria-label="Closet gap">
      <h2>Closet gap</h2>
      <p>You can make {gap.current} outfits from what you own. One more {gapLabels[gap.category]} would unlock {gap.newOutfits} new ones. Try swapping, borrowing or thrifting before buying new.</p>
    </section>}
  </>
}
