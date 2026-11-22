import './App.css'

const sections = [
  { path: '/', title: 'Closet', message: 'Your wardrobe is empty.' },
  { path: '/style', title: 'Style Me', message: 'Add clothing to your closet to start styling outfits.' },
  { path: '/saved', title: 'Saved', message: 'Your saved outfits will appear here.' },
]

export default function App() {
  const current = sections.find(section => section.path === window.location.pathname)
  return (
    <>
      <header><strong>ReWear</strong>
        <nav aria-label="Main navigation">
          {sections.map(section => <a key={section.path} href={section.path}
            aria-current={section === current ? 'page' : undefined}>{section.title}</a>)}
        </nav>
      </header>
      <main><h1>{current?.title ?? 'Page unavailable'}</h1>
        <p>{current?.message ?? 'Choose a page from the navigation above.'}</p>
      </main>
    </>
  )
}
