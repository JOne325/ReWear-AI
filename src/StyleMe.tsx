import { useEffect, useState } from 'react'
import { useClothing } from './useClothing'
import { putOutfit } from './clothingStorage'
import { biggestGap } from './gap'
import { friendlyError } from './errors'
import OutfitBoard from './OutfitBoard'
import {
  clothingCategories, selectRecommendationItems, styleRequestLimit,
  type ClothingItem, type OutfitRecommendation, type StyleRequest,
} from './wardrobe'

const gapLabels = { Tops: 'top', Bottoms: 'pair of bottoms', Shoes: 'pair of shoes' }
const historyKey = 'rewear:recent:style'

function recentOutfits(): string[][] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(historyKey) ?? '[]')
    return Array.isArray(stored) ? stored.filter((entry): entry is string[] =>
      Array.isArray(entry) && entry.length > 0 && entry.length <= 4 &&
      entry.every(id => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(id))).slice(-5) : []
  } catch {
    return []
  }
}

export default function StyleMe() {
  const { items, loadError } = useClothing()
  if (loadError) return <p role="alert">Could not open your closet. Reload to try again.</p>
  if (!items) return <p role="status">Loading your wardrobe…</p>
  return <OutfitEditor closet={items} />
}

function OutfitEditor({ closet }: { closet: ClothingItem[] }) {
  const [pending, setPending] = useState<'suggest' | 'save' | null>(null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [offline, setOffline] = useState(() => !navigator.onLine)
  const [outfit, setOutfit] = useState<OutfitRecommendation | null>(null)
  const [draft, setDraft] = useState('')
  const [submitted, setSubmitted] = useState<StyleRequest>()

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  const pieces = clothingCategories.flatMap(category => closet.filter(item =>
    item.category === category && outfit?.itemIds.includes(item.id)))
  const missing = outfit?.missingItems ?? []
  const canSave = Boolean(outfit && !missing.length && pieces.length && pieces.length === outfit.itemIds.length)
  const gap = biggestGap(closet)
  const current = draft.trim()

  async function suggest() {
    if (pending || offline || !current) return
    const request = submitted?.current === current ? submitted : {
      current,
      previous: submitted?.current,
      previousItems: outfit?.itemIds,
    }
    setPending('suggest')
    setError('')
    try {
      const recent = recentOutfits()
      const candidates = selectRecommendationItems(closet, request)
      const response = await fetch('/api/recommendations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          avoid: recent,
          items: candidates.map(({ id, name, category, color }) => ({ id, name, category, color })),
          styleRequest: request,
        }),
      })
      const result: OutfitRecommendation & { error?: string } = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not get an outfit.')
      if (result.itemIds.length) {
        try { localStorage.setItem(historyKey, JSON.stringify([...recent, result.itemIds].slice(-5))) }
        catch { /* The outfit is still usable. */ }
      }
      setOutfit(result)
      setSubmitted(request)
      setSaved(false)
    } catch (cause) {
      setError(friendlyError(cause, 'Could not get an outfit. Try again.'))
    } finally {
      setPending(null)
    }
  }

  async function save() {
    if (!outfit || !canSave || pending) return
    setPending('save')
    setError('')
    try {
      const itemIds = pieces.map(item => item.id)
      await putOutfit({
        id: JSON.stringify(['style', ...itemIds]), itemIds, pieces,
        title: outfit.title ?? 'Saved outfit', savedAt: Date.now(), reason: outfit.reason,
      })
      setSaved(true)
    } catch {
      setError('Could not save this outfit. Try again.')
    } finally {
      setPending(null)
    }
  }

  return <div className="style-layout">
    <form className="style-request" onSubmit={event => { event.preventDefault(); void suggest() }}>
      <label className="style-request-field" htmlFor="style-request">What do you want to wear?</label>
      <textarea id="style-request" rows={3} maxLength={styleRequestLimit} value={draft}
        disabled={pending !== null} onChange={event => setDraft(event.target.value)}
        placeholder="For example, a relaxed outfit for an outdoor wedding"
        aria-describedby="style-request-help style-request-privacy" />
      <p id="style-request-help">{closet.length
        ? 'Describe the occasion, weather or look. Style Me can suggest pieces to fill any gaps.'
        : 'You can ask for a complete outfit idea before adding clothes to your closet.'}</p>
      <p id="style-request-privacy">Your request and garment details go to Gemini.</p>
      {offline && <p role="status">You are offline. Your closet is available, but outfit suggestions need internet.</p>}
      <button className="action-button" type="submit" disabled={pending !== null || offline || !current}>
        {current && current === submitted?.current ? 'Try again' : 'Suggest an outfit'}
      </button>
    </form>
    {error && <p className="style-feedback" role="alert">{error}</p>}
    {pending === 'suggest' && <p className="style-feedback" role="status">Finding an outfit…</p>}
    {outfit && <section className="style-result" aria-labelledby="style-result-title" aria-live="polite">
      <h2 id="style-result-title">{outfit.title || 'Suggested outfit'}</h2>
      {submitted && <p className="outfit-request">You asked: {submitted.current}</p>}
      {outfit.notice && <p role="status">{outfit.notice}</p>}
      <p>{outfit.reason}</p>
      <div className={pieces.length && missing.length ? 'outfit-editor' : undefined}>
        {pieces.length > 0 && <div>
          <h3>From your closet</h3>
          <OutfitBoard pieces={pieces} />
        </div>}
        {missing.length > 0 && <div className="missing-pieces">
          <h3>Pieces to look for</h3>
          <ul>{missing.map(piece => <li key={piece.category}>
            <small>{piece.category}</small>
            <strong>{piece.name}</strong>
            <a className="text-action" href={'https://www.google.com/search?' + new URLSearchParams({ q: piece.name })}
              target="_blank" rel="noreferrer">Search online<span className="visually-hidden"> for {piece.name}</span></a>
          </li>)}</ul>
        </div>}
      </div>
      {canSave && <div className="actions">
        <button className="action-button" disabled={pending !== null || saved} onClick={save}>
          {saved ? 'Outfit saved' : 'Save outfit'}
        </button>
        {saved && <a className="text-action" href="/saved">View saved outfits</a>}
      </div>}
    </section>}
    {gap && <section className="closet-gap" aria-label="Closet gap">
      <h2>Closet gap</h2>
      <p>You can make {gap.current} {gap.current === 1 ? 'combination' : 'combinations'} of a top, bottoms and shoes. One more {gapLabels[gap.category]} would unlock {gap.newOutfits} new {gap.newOutfits === 1 ? 'outfit' : 'outfits'}. Try borrowing or swapping first.</p>
    </section>}
  </div>
}
