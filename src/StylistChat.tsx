import { useState, type FormEvent } from 'react'
import { useClothing } from './useClothing'
import { mockClothing } from './mockClothing'

type ChatMessage = {
  role: 'user' | 'assistant'
  text: string
}

const quickPrompts = [
  'What can I wear for a casual presentation?',
  'What should I buy to upgrade my closet?',
  'How do I style a rainy-day outfit?',
]

export default function StylistChat() {
  const { items } = useClothing()
  const closet = items && items.length > 0 ? items : mockClothing

  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      text: 'Hi! Ask me what to wear for an event or weather, and I’ll style your closet first—or suggest key pieces to buy if something is missing.',
    },
  ])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  async function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed || sending) return

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', text: trimmed }]
    setMessages(nextMessages)
    setDraft('')
    setSending(true)
    setError('')

    try {
      const response = await fetch('/api/stylist-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: closet.map(({ name, category, color }) => ({ name, category, color })),
          messages: nextMessages.slice(-12),
        }),
      })
      const result = await response.json()
      if (!response.ok || typeof result.reply !== 'string') {
        throw new Error(result.error || 'Could not get a stylist reply.')
      }
      setMessages(prev => [...prev, { role: 'assistant', text: result.reply }])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Try again.')
    } finally {
      setSending(false)
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    void sendMessage(draft)
  }

  return (
    <div className="stylist-widget">
      {open && (
        <section className="stylist-chat" aria-label="AI Wardrobe Stylist Chat">
          <div className="stylist-chat-header">
            <div>
              <h2>ReWear Stylist</h2>
              <span>{closet.length} {closet.length === 1 ? 'item' : 'items'} in closet</span>
            </div>
            <button
              type="button"
              className="stylist-close"
              aria-label="Minimize stylist chat"
              onClick={() => setOpen(false)}
            >
              ✕
            </button>
          </div>

          <div className="stylist-messages" role="log" aria-live="polite">
            {messages.map((msg, idx) => (
              <div key={idx} className={`stylist-bubble ${msg.role}`}>
                {msg.text}
              </div>
            ))}
            {sending && <div className="stylist-bubble assistant">Thinking…</div>}
            {error && <p className="stylist-error" role="alert">{error}</p>}
          </div>

          <div className="stylist-prompts">
            {quickPrompts.map(prompt => (
              <button
                key={prompt}
                type="button"
                disabled={sending}
                onClick={() => void sendMessage(prompt)}
              >
                {prompt}
              </button>
            ))}
          </div>

          <form className="stylist-form" onSubmit={handleSubmit}>
            <input
              type="text"
              value={draft}
              maxLength={1000}
              disabled={sending}
              placeholder="Ask what to wear or buy…"
              aria-label="Message your stylist"
              onChange={event => setDraft(event.target.value)}
            />
            <button className="action-button" type="submit" disabled={sending || !draft.trim()}>
              Send
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        className="stylist-launcher"
        aria-expanded={open}
        aria-label={open ? 'Close stylist chat' : 'Open stylist chat'}
        onClick={() => setOpen(prev => !prev)}
      >
        <span className="stylist-launcher-icon" aria-hidden="true">💬</span>
        <span>{open ? 'Close' : 'Ask Stylist'}</span>
      </button>
    </div>
  )
}