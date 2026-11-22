import { useState, type FormEvent } from 'react'
import PhotoCrop from './PhotoCrop'
import { clothingCategories, clothingNameLimit, type ClothingItem } from './wardrobe'

export default function ClothingForm({ initial, save, cancel }: {
  initial?: ClothingItem
  save: (item: ClothingItem) => Promise<void>
  cancel: () => void
}) {
  const [photo, setPhoto] = useState(initial?.photo)
  const [ready, setReady] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const name = String(data.get('name') ?? '').trim()
    const category = clothingCategories.find(value => value === data.get('category'))
    if (!name || !category) { setError('Enter a name and choose a category.'); return }
    setBusy(true)
    try {
      await save({ id: initial?.id ?? crypto.randomUUID(), name, category, color: String(data.get('color')), photo })
    } catch { setError('Could not save this garment. Try again.'); setBusy(false) }
  }
  return <section className="add-clothing"><h2>{initial ? 'Edit clothing' : 'Add clothing'}</h2>
    <form onSubmit={submit}><fieldset disabled={busy}>
      <PhotoCrop onChange={setPhoto} onReady={setReady} />
      {photo && ready && <img className="crop-preview" src={photo} alt="Garment crop preview" />}
      <label>Clothing name<input autoFocus name="name" defaultValue={initial?.name} required maxLength={clothingNameLimit} /></label>
      <label><span id="category-label">Category</span><select name="category" aria-labelledby="category-label" defaultValue={initial?.category ?? ''} required>
        <option value="" disabled>Choose a category</option>{clothingCategories.map(value => <option key={value}>{value}</option>)}
      </select></label>
      <label>Color<input type="color" name="color" defaultValue={initial?.color ?? '#ffffff'} /></label>
      <div className="actions"><button className="action-button" disabled={!ready}>Save clothing</button>
      <button type="button" onClick={cancel}>Cancel</button></div>
    </fieldset></form>{error && <p role="alert">{error}</p>}
  </section>
}
