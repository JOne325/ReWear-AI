import { useState } from 'react'
import { mockClothing } from './mockClothing'
import { useClothing } from './useClothing'
import { clothingCategories, type ClothingCategory, type ClothingItem } from './wardrobe'
import { GarmentImage } from './OutfitBoard'
import ClothingForm from './ClothingForm'

const filters = ['All', ...clothingCategories] as const
export default function Closet() {
  const { items, loadError, saveItem, deleteItem } = useClothing()
  const [category, setCategory] = useState<ClothingCategory | 'All'>('All')
  const [editing, setEditing] = useState<ClothingItem | 'new' | null>(() =>
    new URLSearchParams(window.location.search).has('add') ? 'new' : null)
  const [notice, setNotice] = useState('')
  if (loadError) return <p role="alert">Could not open your closet. Reload to try again.</p>
  if (!items) return <p role="status">Loading your closet…</p>
  const demo = !items.length
  const visible = (demo ? mockClothing : items).filter(item => category === 'All' || item.category === category)
  if (editing) return <ClothingForm initial={editing === 'new' ? undefined : editing} cancel={() => setEditing(null)}
    save={async item => { await saveItem(item); setCategory(item.category); setNotice(item.name + ' saved.'); setEditing(null) }} />
  return <>
    <div className="closet-toolbar"><div className="closet-filters" role="group" aria-label="Filter clothing by category">
      {filters.map(filter => <button key={filter} aria-pressed={category === filter} onClick={() => setCategory(filter)}>{filter}</button>)}
    </div><button className="action-button" onClick={() => setEditing('new')}>Add Clothing</button></div>
    <p className="closet-count" role="status">{demo ? 'Demo wardrobe · ' : ''}{visible.length} {visible.length === 1 ? 'item' : 'items'}</p>
    <p role="status">{notice}</p>
    {!visible.length && <p>No items in this category yet. Add clothing or choose another category.</p>}
    <ul className="closet-grid" aria-label="Clothing items" role="list">{visible.map(item => <li className="clothing-card" key={item.id}>
      <GarmentImage item={item} /><div><small>{item.category}</small><h2>{item.name}</h2>
      {!demo && <div className="actions"><button onClick={() => setEditing(item)}>Edit</button>
        <button onClick={async () => {
          if (!window.confirm('Remove ' + item.name + ' from your closet?')) return
          try { await deleteItem(item.id); setNotice(item.name + ' removed.') } catch { setNotice('Could not remove the garment.') }
        }}>Remove</button></div>}</div>
    </li>)}</ul>
  </>
}
