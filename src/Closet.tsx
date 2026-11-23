import { useEffect, useState } from 'react'
import { listOutfits } from './clothingStorage'
import { rewearScore } from './rewearScore'
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
  const [outfitCount, setOutfitCount] = useState<number | null>(null)
  const hasGarments = Boolean(items?.length)
  useEffect(() => {
    if (!hasGarments) return
    let active = true
    void listOutfits().then(rows => {
      if (active) setOutfitCount(rows.length)
    }, () => {})
    return () => { active = false }
  }, [hasGarments])
  if (loadError) return <p role="alert">Could not open your closet. Reload to try again.</p>
  if (!items) return <p role="status">Loading your closet…</p>
  const demo = !items.length
  const visible = (demo ? mockClothing : items).filter(item => category === 'All' || item.category === category)
  const mostWorn = items.reduce((max, item) => Math.max(max, item.wornCount ?? 0), 1)
  const score = rewearScore(items)
  if (editing) return <ClothingForm initial={editing === 'new' ? undefined : editing} cancel={() => setEditing(null)}
    save={async item => { await saveItem(item, editing !== 'new'); setCategory(item.category); setNotice(item.name + ' saved.'); setEditing(null) }} />
  return <>
    {score !== null && <dl className="closet-summary" aria-label="Closet summary">
      <div><dt>Items in closet</dt><dd>{items.length}</dd></div>
      <div><dt>Saved outfits</dt><dd>{outfitCount ?? '—'}</dd></div>
      <div><dt>ReWear Score</dt><dd>{score}%</dd>
        <dd className="score-caption">of your closet worn in the last 30 days</dd></div>
    </dl>}
    <div className="closet-toolbar"><div className="closet-filters" role="group" aria-label="Filter clothing by category">
      {filters.map(filter => <button key={filter} aria-pressed={category === filter} onClick={() => setCategory(filter)}>{filter}</button>)}
    </div><button className="action-button" onClick={() => setEditing('new')}>{demo ? 'Add your first garment' : 'Add garment'}</button></div>
    {demo ? <p className="closet-count">Demo wardrobe</p> :
      category !== 'All' && <p className="closet-count" role="status">{visible.length} {visible.length === 1 ? 'item' : 'items'}</p>}
    <p role="status">{notice}</p>
    {!visible.length && <p>No items in this category yet. Add a garment or choose another category.</p>}
    <ul className="closet-grid" aria-label="Clothing items" role="list">{visible.map(item => <li className="clothing-card" key={item.id}>
      <GarmentImage item={item} /><div><small>{item.category}</small><h2>{item.name}</h2>
      {!demo && <>
        <p>{!item.wornCount ? 'Not worn yet' : 'Worn ' + item.wornCount + (item.wornCount === 1 ? ' time' : ' times')}</p>
        <progress className="wear-progress" aria-label={item.name + ' wears relative to the most-worn garment'}
          value={item.wornCount ?? 0} max={mostWorn} />
      </>}
      {!demo && <div className="actions"><button onClick={() => setEditing(item)}>Edit</button>
        <button onClick={async () => {
          if (!window.confirm('Remove ' + item.name + ' from your closet?')) return
          try { await deleteItem(item.id); setNotice(item.name + ' removed.') } catch { setNotice('Could not remove the garment.') }
        }}>Remove</button></div>}</div>
    </li>)}</ul>
  </>
}
