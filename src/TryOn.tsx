import { useEffect, useRef, useState } from 'react'
import { friendlyError } from './errors'
import { loadImageFromSrc } from './photoFraming'

const maxUploadBytes = 12 * 1024 * 1024

async function preparePhoto(source: string, longestSide: number, label: string) {
  const image = await loadImageFromSrc(source).catch(() => {
    throw new Error('Could not open the ' + label + ' photo. Choose a JPEG or PNG.')
  })
  if (Math.min(image.naturalWidth, image.naturalHeight) < 64) {
    throw new Error('Choose a larger ' + label + ' photo.')
  }
  const scale = Math.min(1, longestSide / Math.max(image.naturalWidth, image.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(image.naturalWidth * scale)
  canvas.height = Math.round(image.naturalHeight * scale)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not prepare the photo.')
  context.fillStyle = '#fff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.86)
}

export default function TryOn() {
  const [offline, setOffline] = useState(() => !navigator.onLine)
  const [configured, setConfigured] = useState<boolean>()
  const [person, setPerson] = useState('')
  const [top, setTop] = useState('')
  const [description, setDescription] = useState('')
  const [result, setResult] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [canceled, setCanceled] = useState(false)
  const active = useRef<AbortController | null>(null)

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
      active.current?.abort()
    }
  }, [])

  useEffect(() => {
    if (offline) return
    const check = new AbortController()
    void fetch('/api/tryon', { signal: check.signal }).then(async response => {
      if (!response.ok) return false
      const data = await response.json() as { configured?: boolean }
      return data.configured === true
    }).then(available => { if (!check.signal.aborted) setConfigured(available) },
      () => { if (!check.signal.aborted) setConfigured(false) })
    return () => check.abort()
  }, [offline])

  useEffect(() => {
    if (person) return () => URL.revokeObjectURL(person)
  }, [person])
  useEffect(() => {
    if (top) return () => URL.revokeObjectURL(top)
  }, [top])
  useEffect(() => {
    if (result) return () => URL.revokeObjectURL(result)
  }, [result])

  function selectPhoto(kind: 'person' | 'top', file?: File) {
    if (!file) return
    const setPhoto = kind === 'person' ? setPerson : setTop
    setResult('')
    setCanceled(false)
    if (file.size > maxUploadBytes) {
      setPhoto('')
      setError('Choose a ' + kind + ' photo under 12 MB.')
      return
    }
    setPhoto(URL.createObjectURL(file))
    setError('')
  }

  async function generate() {
    if (!configured || offline || !person || !top || active.current) return
    const controller = new AbortController()
    active.current = controller
    setPending(true)
    setError('')
    setResult('')
    setCanceled(false)
    try {
      const [personPhoto, garmentPhoto] = await Promise.all([
        preparePhoto(person, 1280, 'person'), preparePhoto(top, 768, 'top'),
      ])
      controller.signal.throwIfAborted()
      const response = await fetch('/api/tryon', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person: personPhoto, garment: garmentPhoto, name: description.trim() || 'A top',
          category: 'Tops',
        }),
        signal: controller.signal,
      })
      if (!response.ok) {
        const data = await response.json().catch(() => undefined) as { error?: string } | undefined
        throw new Error(data?.error || 'Could not generate a preview.')
      }
      const preview = await response.blob()
      if (preview.type !== 'image/png' || !preview.size) throw new Error('The preview could not be opened.')
      if (!controller.signal.aborted) setResult(URL.createObjectURL(preview))
    } catch (cause) {
      if (!controller.signal.aborted) setError(friendlyError(cause, 'Could not make the preview. Try another photo.'))
    } finally {
      if (active.current === controller) {
        active.current = null
        setPending(false)
      }
    }
  }

  function cancel() {
    active.current?.abort()
    active.current = null
    setPending(false)
    setCanceled(true)
  }

  function reset() {
    setPerson('')
    setTop('')
    setDescription('')
    setResult('')
    setError('')
    setCanceled(false)
  }

  return <section className="try-on-panel" aria-label="Virtual try-on">
    <p className="try-on-intro">See how a shirt or other top might look on you.</p>
    {offline && <p role="status">You are offline. Try-on needs internet.</p>}
    {!offline && configured === undefined && <p role="status">Checking try-on availability…</p>}
    {!offline && configured === false && <p role="status">Virtual try-on is unavailable on this server.</p>}
    {configured && <form className="try-on-form" onSubmit={event => { event.preventDefault(); void generate() }}>
      <fieldset className="try-on-inputs" disabled={pending}>
        <legend className="visually-hidden">Try-on photos</legend>
        <div className="try-on-images">
          <label className="try-on-upload">
            <span className="try-on-upload-title">Person photo</span>
            <span className="try-on-upload-hint" id="try-on-person-hint">Face the camera</span>
            {person && <img src={person} alt="Selected person" />}
            <span className="try-on-upload-action">{person ? 'Replace photo' : 'Choose photo'}</span>
            <input type="file" accept="image/*" aria-label="Person photo" aria-describedby="try-on-person-hint"
              onChange={event => { selectPhoto('person', event.currentTarget.files?.[0]); event.currentTarget.value = '' }} />
          </label>
          <label className="try-on-upload">
            <span className="try-on-upload-title">Top photo</span>
            <span className="try-on-upload-hint" id="try-on-top-hint">Lay one top flat</span>
            {top && <img src={top} alt="Selected top" />}
            <span className="try-on-upload-action">{top ? 'Replace photo' : 'Choose photo'}</span>
            <input type="file" accept="image/*" aria-label="Top photo" aria-describedby="try-on-top-hint"
              onChange={event => { selectPhoto('top', event.currentTarget.files?.[0]); event.currentTarget.value = '' }} />
          </label>
        </div>
        <label className="try-on-picker">Describe the top (optional)
          <input className="try-on-description" type="text" maxLength={80} value={description}
            placeholder="Blue long-sleeve shirt" onChange={event => setDescription(event.target.value)} />
        </label>
      </fieldset>
      <p className="try-on-privacy">Use your own photo or get permission. IDM-VTON receives both photos when you generate a preview.</p>
      {pending && <p role="status">Making your preview. This may take a couple of minutes.</p>}
      {canceled && <p role="status">Preview canceled.</p>}
      {error && <p role="alert">{error}</p>}
      <div className="actions">
        <button className="action-button" type="submit" disabled={!person || !top || pending || offline}>
          Generate preview
        </button>
        {pending && <button type="button" onClick={cancel}>Cancel generation</button>}
        {!pending && (person || top) && <button type="button" onClick={reset}>Start over</button>}
      </div>
    </form>}
    {result && <figure className="try-on-result">
      <img src={result} alt="AI-generated preview of the person wearing the selected top" />
      <figcaption>AI-generated preview. Fit and appearance can differ in real life.</figcaption>
    </figure>}
  </section>
}
