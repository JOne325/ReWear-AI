import './Opening.css'

export default function Opening() {
  return <main className="opening">
    <div className="opening-copy">
      <h1>Wear more of <em>what you own.</em></h1>
      <p>Catalog your clothes, find new outfit combinations, and log what you wear.</p>
      <div className="opening-actions">
        <a className="action-button" href="/closet">Open your closet <span aria-hidden="true">→</span></a>
        <a className="text-action" href="/try-on">Try on a top</a>
      </div>
    </div>
    <img className="opening-photo" src="/opening-wardrobe.webp"
      width="960" height="1200" fetchPriority="high" alt="A lavender cardigan, white shirt, green sweatshirt and jeans on a clothing rail" />
  </main>
}
