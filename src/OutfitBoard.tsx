import type { ClothingItem } from './wardrobe'

export function GarmentImage({ item }: { item: ClothingItem }) {
  const photo = item.photo ?? item.backPhoto
  return photo
    ? <img className="garment-photo" src={photo} alt="" />
    : <span className="garment-photo fallback" style={{ backgroundColor: item.color }} role="img" aria-label={'Color ' + item.color} />
}

export default function OutfitBoard({ pieces }: { pieces: ClothingItem[] }) {
  return <div className="outfit-board">{pieces.map(item => <figure key={item.id} className={'slot-' + item.category.toLowerCase()}>
    <GarmentImage item={item} /><figcaption><small>{item.category}</small>{item.name}</figcaption>
  </figure>)}</div>
}
