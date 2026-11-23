import './App.css'
import Closet from './Closet'
import Guide from './Guide'
import StyleMe from './StyleMe'
import Saved from './Saved'
import StylistChat from './StylistChat'

const primarySections = [
  { path: '/', title: 'Closet' },
  { path: '/style', title: 'Style Me' },
  { path: '/saved', title: 'Saved' },
]
const guide = { path: '/guide', title: 'How to use' }
const sections = [...primarySections, guide]

export default function App() {
  const current = sections.find(section => section.path === window.location.pathname)
  return (
    <>
      <header><strong>ReWear</strong>
        <nav aria-label="Main navigation">
          {primarySections.map(section => <a key={section.path} href={section.path}
            aria-current={section === current ? 'page' : undefined}>{section.title}</a>)}
        </nav>
        <a className="text-action guide-link" href={guide.path} aria-current={current === guide ? 'page' : undefined}>
          {guide.title}
        </a>
      </header>
      <main><h1>{current?.title ?? 'Page unavailable'}</h1>
        {current?.path === '/' && <Closet />}
        {current?.path === '/style' && <StyleMe />}
        {current?.path === '/saved' && <Saved />}
        {current === guide && <Guide />}
        {!current && <p>Choose a page from the navigation above.</p>}
      </main>
      <StylistChat />
    </>
  )
}
