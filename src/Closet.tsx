import { useState } from 'react'
import type { FormEvent } from 'react'
import { mockClothing } from './mockClothing'
import { useClothing } from './useClothing'
import { clothingCategories, clothingNameLimit } from './wardrobe'
import type { ClothingCategory } from './wardrobe'

const filters = ['All', ...clothingCategories] as const

export default function Closet() {
  const { items, loadError, saveItem } = useClothing()
  const [category, setCategory] = useState<ClothingCategory | 'All'>('All')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const showingSamples = items?.length === 0
  const clothing = showingSamples ? mockClothing : items ?? []
  const visibleItems = category === 'All'
    ? clothing
    : clothing.filter(item => item.category === category)

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const values = new FormData(form)
    const name = String(values.get('name') ?? '').trim()
    const selectedCategory = clothingCategories.find(value => value === values.get('category'))
    const color = String(values.get('color') ?? '')

    setConfirmation('')
    if (!name || name.length > clothingNameLimit || !selectedCategory || !/^#[0-9a-f]{6}$/i.test(color)) {
      setSaveError('Enter a clothing name, choose a category and select a color.')
      return
    }

    setSaveError('')
    setSaving(true)
    try {
      await saveItem({ name, category: selectedCategory, color })
      setCategory('All')
      form.reset()
      setConfirmation(`${name} added to your closet.`)
    } catch {
      setSaveError('Could not save this item. Try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loadError) return <p role="alert">Could not open your closet. Reload the page to try again.</p>
  if (items === null) return <p role="status">Loading your closet…</p>

  return (
    <>
      <div className="closet-filters" role="group" aria-label="Filter clothing by category">
        {filters.map(filter => (
          <button
            key={filter}
            type="button"
            aria-pressed={category === filter}
            onClick={() => setCategory(filter)}
          >
            {filter}
          </button>
        ))}
      </div>

      {showingSamples && <p>Sample clothing is shown until you add your first item.</p>}
      <p className="closet-count" role="status">
        {visibleItems.length} {visibleItems.length === 1 ? 'item' : 'items'}
      </p>

      <ul className="closet-grid" role="list" aria-label="Clothing items">
        {visibleItems.map(item => (
          <li className="clothing-card" key={item.id}>
            <span className="clothing-swatch" style={{ backgroundColor: item.color }} aria-hidden="true" />
            <div>
              <h2>{item.name}</h2>
              <p>{item.category}</p>
            </div>
          </li>
        ))}
      </ul>

      <section className="add-clothing" aria-labelledby="add-clothing-title">
        <h2 id="add-clothing-title">Add clothing</h2>
        <form onSubmit={handleAdd}>
          <fieldset disabled={saving} aria-labelledby="add-clothing-title">
            <label>
              Clothing name
              <input name="name" required maxLength={clothingNameLimit} />
            </label>
            <label>
              Category
              <select name="category" defaultValue="" required>
                <option value="" disabled>Choose a category</option>
                {clothingCategories.map(value => <option key={value}>{value}</option>)}
              </select>
            </label>
            <label>
              Color
              <input name="color" type="color" defaultValue="#ffffff" />
            </label>
            <button className="action-button" type="submit">{saving ? 'Adding…' : 'Add item'}</button>
          </fieldset>
        </form>
        {saveError && <p role="alert">{saveError}</p>}
        <p role="status" className="form-confirmation">{confirmation}</p>
      </section>
    </>
  )
}
