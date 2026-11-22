import { useState, type FormEvent } from 'react'
import PhotoCrop from './PhotoCrop'
import { clothingCategories, clothingNameLimit, type ClothingItem } from './wardrobe'

function newGarmentId() {
  // getRandomValues also works on the HTTP LAN origin used for phone testing.
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}

export default function ClothingForm({ initial, save, cancel }: {
  initial?: ClothingItem
  save: (item: ClothingItem) => Promise<void>
  cancel: () => void
}) {
  const [photo, setPhoto] = useState(initial?.photo)
  const [ready, setReady] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [name, setName] = useState(initial?.name ?? '')
  const [category, setCategory] = useState<string>(initial?.category ?? '')
  const [color, setColor] = useState(initial?.color ?? '#ffffff')
  const [analyzing, setAnalyzing] = useState(false)
  const [notice, setNotice] = useState('')
  async function analyze() {
    setError('')
    setNotice('')
    setAnalyzing(true)
    try {
      const response = await fetch('/api/clothing-details', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ photo }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Enter the garment details manually.')
      setName(result.name)
      setCategory(result.category)
      setColor(result.color)
      setNotice('Review the suggested details before saving.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Enter the garment details manually.')
    } finally { setAnalyzing(false) }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const name = String(data.get('name') ?? '').trim()
    const category = clothingCategories.find(value => value === data.get('category'))
    if (!name || !category) { setError('Enter a name and choose a category.'); return }
    setBusy(true)
    try {
      await save({ id: initial?.id ?? newGarmentId(), name, category, color: String(data.get('color')), photo })
    } catch { setError('Could not save this garment. Try again.'); setBusy(false) }
  }
  return <section className="add-clothing"><h2>{initial ? 'Edit clothing' : 'Add clothing'}</h2>
    <form onSubmit={submit}><fieldset disabled={busy || analyzing}>
      <PhotoCrop onChange={setPhoto} onReady={setReady} />
      {photo && ready && <img className="crop-preview" src={photo} alt="Garment crop preview" />}
      {photo?.startsWith('data:image/jpeg;base64,') && ready && <>
        <p>This sends the cropped garment photo to Gemini to suggest editable details.</p>
        <button type="button" onClick={analyze}>{analyzing ? 'Checking photo…' : 'Suggest details from photo'}</button>
      </>}
      {notice && <p role="status">{notice}</p>}
      <label>Clothing name<input autoFocus name="name" value={name} onChange={event => setName(event.target.value)} required maxLength={clothingNameLimit} /></label>
      <label><span id="category-label">Category</span><select name="category" aria-labelledby="category-label" value={category} onChange={event => setCategory(event.target.value)} required>
        <option value="" disabled>Choose a category</option>{clothingCategories.map(value => <option key={value}>{value}</option>)}
      </select></label>
      <label>Color<input type="color" name="color" value={color} onChange={event => setColor(event.target.value)} /></label>
      <div className="actions"><button className="action-button" disabled={!ready}>Save clothing</button>
      <button type="button" onClick={cancel}>Cancel</button></div>
    </fieldset></form>{error && <p role="alert">{error}</p>}
  </section>
}
