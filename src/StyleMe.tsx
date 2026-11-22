import { useState } from 'react'
import { useClothing } from './useClothing'
import { clothingCategories, recommendationItemLimit } from './wardrobe'
import type { ClothingItem, OutfitRecommendation } from './wardrobe'

export default function StyleMe() {
  const { items, loadError } = useClothing()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [outfit, setOutfit] = useState<OutfitRecommendation | null>(null)

  if (loadError) return <p role="alert">Could not open your closet. Reload the page to try again.</p>
  if (items === null) return <p role="status">Loading your closet…</p>

  const firstByCategory = clothingCategories.map(category => items.find(item => item.category === category))
  const essentials = firstByCategory.filter((item): item is ClothingItem => item !== undefined)
  if (essentials.length < clothingCategories.length) {
    return <p>Add at least one top, one bottom and one pair of shoes to your closet to start styling outfits.</p>
  }

  const candidates = [...essentials, ...items.filter(item => !essentials.includes(item))]
    .slice(0, recommendationItemLimit)

  async function getRecommendation() {
    setPending(true)
    setError('')
    setOutfit(null)
    try {
      const response = await fetch('/api/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: candidates }),
      })
      const result = await response.json()
      if (response.ok) setOutfit(result)
      else setError(result.error || 'Could not get an outfit. Try again.')
    } catch {
      setError('Could not get an outfit. Try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <button className="action-button" disabled={pending} onClick={getRecommendation}>Suggest an outfit</button>
      <p>Style Me sends clothing names, categories and colors to Gemini to suggest an outfit.</p>
      {error && <p role="alert">{error}</p>}
      <div aria-live="polite">
        {pending && <p>Putting together an outfit…</p>}
        {outfit && (
          <section aria-labelledby="suggested-outfit">
            <h2 id="suggested-outfit">Suggested outfit</h2>
            <ul className="outfit-items" role="list">
              {outfit.itemIds.map(id => {
                const item = items.find(candidate => candidate.id === id)
                return item && (
                  <li key={id}>
                    <span
                      className="clothing-swatch"
                      style={{ backgroundColor: item.color }}
                      role="img"
                      aria-label={`Color ${item.color}`}
                    />
                    {item.name}
                  </li>
                )
              })}
            </ul>
            <p>{outfit.reason}</p>
          </section>
        )}
      </div>
    </>
  )
}
