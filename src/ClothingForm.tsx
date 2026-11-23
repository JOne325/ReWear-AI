import { useEffect, useRef, useState, type FormEvent } from 'react'
import PhotoCrop from './PhotoCrop'
import { friendlyError } from './errors'
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
  const [backPhoto, setBackPhoto] = useState(initial?.backPhoto)
  const [recognitionView, setRecognitionView] = useState<'Front' | 'Back'>(initial?.backPhoto && !initial.photo ? 'Back' : 'Front')
  const selectedPhoto = recognitionView === 'Front' ? photo : backPhoto
  const [ready, setReady] = useState(true)
  const [backReady, setBackReady] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [name, setName] = useState(initial?.name ?? '')
  const [category, setCategory] = useState<string>(initial?.category ?? '')
  const [color, setColor] = useState(initial?.color ?? '#ffffff')
  const [analyzing, setAnalyzing] = useState(false)
  const [notice, setNotice] = useState('')
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus() }, [])
  async function analyze() {
    if (!selectedPhoto) return
    setError('')
    setNotice('')
    setAnalyzing(true)
    try {
      const response = await fetch('/api/clothing-details', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ photo: selectedPhoto }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Enter the garment details manually.')
      if (result.name) setName(result.name)
      if (result.category) setCategory(result.category)
      if (result.color) setColor(result.color)
      setNotice(result.notice ?? 'Review the suggested details before saving.')
    } catch (cause) {
      setError(friendlyError(cause, 'Enter the garment details manually.'))
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
      await save({ id: initial?.id ?? newGarmentId(), name, category, color: String(data.get('color')), photo, backPhoto })
    } catch { setError('Could not save this garment. Try again.'); setBusy(false) }
  }
  return <section className="add-clothing"><h2 ref={heading} tabIndex={-1}>{initial ? 'Edit garment' : 'Add garment'}</h2>
    <form onSubmit={submit}><fieldset disabled={busy || analyzing}>
      <h3>Front photo</h3>
      <PhotoCrop view="Front" onChange={value => { setPhoto(value); setRecognitionView('Front') }} onReady={setReady} />
      {photo && ready && <img className="crop-preview" src={photo} alt="Confirmed front photo" />}
      <h3>Back photo (optional)</h3>
      <PhotoCrop view="Back" onChange={value => { setBackPhoto(value); if (!photo) setRecognitionView('Back') }} onReady={setBackReady} />
      {backPhoto && backReady && <img className="crop-preview" src={backPhoto} alt="Confirmed back photo" />}
      {(photo || backPhoto) && ready && backReady && <>
        {photo && backPhoto && <label>Photo for suggestions<select value={recognitionView}
          onChange={event => setRecognitionView(event.target.value === 'Back' ? 'Back' : 'Front')}>
          <option>Front</option><option>Back</option></select></label>}
        <p>This sends the selected cropped photo to Gemini.</p>
        <button type="button" disabled={!selectedPhoto?.startsWith('data:image/jpeg;base64,')} onClick={analyze}>Suggest details from photo</button>
      </>}
      {analyzing && <p role="status">Checking photo…</p>}
      {notice && <p role="status">{notice}</p>}
      <label>Garment name<input name="name" value={name} onChange={event => setName(event.target.value)} required maxLength={clothingNameLimit} /></label>
      <label><span id="category-label">Category</span><select name="category" aria-labelledby="category-label" value={category} onChange={event => setCategory(event.target.value)} required>
        <option value="" disabled>Choose a category</option>{clothingCategories.map(value => <option key={value}>{value}</option>)}
      </select></label>
      <label>Color<input type="color" name="color" value={color} onChange={event => setColor(event.target.value)} /></label>
      <div className="actions"><button className="action-button" disabled={!ready || !backReady}>Save garment</button>
      <button type="button" onClick={cancel}>Cancel</button></div>
    </fieldset></form>{error && <p role="alert">{error}</p>}
  </section>
}
