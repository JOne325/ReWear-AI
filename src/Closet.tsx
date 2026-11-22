import { useState } from 'react'
import { clothingCategories, mockClothing } from './mockClothing'
import type { ClothingCategory } from './mockClothing'

const filters = ['All', ...clothingCategories] as const

export default function Closet() {
  const [category, setCategory] = useState<ClothingCategory | 'All'>('All')
  const visibleItems = category === 'All'
    ? mockClothing
    : mockClothing.filter(item => item.category === category)

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
    </>
  )
}
