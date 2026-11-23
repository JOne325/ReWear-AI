import './App.css'
import Closet from './Closet'
import Guide from './Guide'
import Opening from './Opening'
import StyleMe from './StyleMe'
import Saved from './Saved'
import TryOn from './TryOn'

const primarySections = [
  { path: '/closet', title: 'Closet' },
  { path: '/style', title: 'Style Me' },
  { path: '/saved', title: 'Saved' },
  { path: '/try-on', title: 'Try-on' },
]
const guide = { path: '/guide', title: 'How to use' }
const sections = [...primarySections, guide]

export default function App() {
  const { pathname, search } = window.location
  const legacyAddLink = pathname === '/' && new URLSearchParams(search).has('add')
  const opening = pathname === '/' && !legacyAddLink
  const current = sections.find(section => section.path === (legacyAddLink ? '/closet' : pathname))
  return (
    <>
      <header className="app-header"><div className="app-header-inner">
        <a className="wordmark" href="/" aria-current={opening ? 'page' : undefined}>
          <img src="/icon.svg" width="32" height="32" alt="" />
          ReWear
        </a>
        <nav aria-label="Main navigation">
          {primarySections.map(section => <a key={section.path} href={section.path}
            aria-current={section === current ? 'page' : undefined}>{section.title}</a>)}
        </nav>
        <a className="text-action guide-link" href={guide.path} aria-current={current === guide ? 'page' : undefined}>
          {guide.title}
        </a>
      </div></header>
      {opening ? <Opening /> : <main className="app-page">
        <h1>{current?.path === '/closet' ? 'Your closet' : current?.title ?? 'Page unavailable'}</h1>
        {current?.path === '/closet' && <Closet />}
        {current?.path === '/style' && <StyleMe />}
        {current?.path === '/saved' && <Saved />}
        {current?.path === '/try-on' && <TryOn />}
        {current === guide && <Guide />}
        {!current && <p>Choose a page from the navigation above.</p>}
      </main>}
    </>
  )
}
