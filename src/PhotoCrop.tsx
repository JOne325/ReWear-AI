import { useEffect, useRef, useState, type RefObject } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { friendlyError } from './errors'
import { loadImageFromSrc, renderTo512Jpeg, rotatePhoto, type CropBox, type CropMode } from './photoFraming'


const AI_VERTICAL_PADDING = 10
const AI_HORIZONTAL_PADDING = 55

function parseCropBox(raw: unknown): CropBox | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  if (
    typeof r.ymin !== 'number' || typeof r.xmin !== 'number' ||
    typeof r.ymax !== 'number' || typeof r.xmax !== 'number'
  ) return null
  const ymin = Math.max(0, Math.min(1000, Math.round(r.ymin) - AI_VERTICAL_PADDING))
  const xmin = Math.max(0, Math.min(1000, Math.round(r.xmin) - AI_HORIZONTAL_PADDING))
  const ymax = Math.max(0, Math.min(1000, Math.round(r.ymax) + AI_VERTICAL_PADDING))
  const xmax = Math.max(0, Math.min(1000, Math.round(r.xmax) + AI_HORIZONTAL_PADDING))
  if (ymax <= ymin || xmax <= xmin) return null
  return { ymin, xmin, ymax, xmax }
}

export default function PhotoCrop({ view, currentPhoto, onChange, onRemove, onReady }: {
  view: 'Front' | 'Back'
  currentPhoto?: string
  onChange: (photo: string, suggestedName?: string) => void
  onRemove: () => void
  onReady: (ready: boolean) => void
}) {
  const media = useRef<RefObject<HTMLImageElement> | null>(null)
  const fullImage = useRef<HTMLImageElement>(null)
  const [mode, setMode] = useState<CropMode>('fit')
  const [loaded, setLoaded] = useState(false)
  const [src, setSrc] = useState('')
  const [orientation, setOrientation] = useState({ turns: 0, source: '' })
  const source = orientation.source || src
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [area, setArea] = useState<Area | null>(null)
  const [aiPreview, setAiPreview] = useState<{ photo: string; name?: string } | null>(null)
  const [cutout, setCutout] = useState<{ photo: string; previousMode: Exclude<CropMode, 'cutout'> | null; name?: string } | null>(null)
  const [pending, setPending] = useState<'crop' | 'cutout' | 'rotate' | null>(null)
  const detecting = pending !== null
  const [error, setError] = useState('')

  useEffect(() => {
    if (src.startsWith('blob:')) return () => URL.revokeObjectURL(src)
  }, [src])

  function beginEditing(next: string) {
    const existingCutout = next.startsWith('data:image/png')
    setSrc(next)
    setOrientation({ turns: 0, source: '' })
    setMode(existingCutout ? 'cutout' : 'fit')
    setCutout(existingCutout ? { photo: next, previousMode: null } : null)
    setAiPreview(null)
    setLoaded(false)
    setArea(null)
    setPosition({ x: 0, y: 0 })
    setZoom(1)
    setError('')
    onReady(false)
  }

  async function rotate(direction: -1 | 1) {
    if (!src || detecting) return
    setPending('rotate')
    setError('')
    try {
      const turns = (orientation.turns + direction + 4) % 4
      const rotatedSource = turns ? await rotatePhoto(src, turns, 'image/png') : ''
      const rotatedAi = aiPreview ? await rotatePhoto(aiPreview.photo, direction, 'image/jpeg') : undefined
      const rotatedCutout = cutout ? await rotatePhoto(cutout.photo, direction, 'image/png') : undefined
      setOrientation({ turns, source: rotatedSource })
      if (aiPreview && rotatedAi) setAiPreview({ ...aiPreview, photo: rotatedAi })
      if (cutout && rotatedCutout) setCutout({ ...cutout, photo: rotatedCutout })
      if (mode === 'fit') setLoaded(false)
      if (mode === 'manual' || cutout?.previousMode === 'manual') {
        setArea(null)
        setPosition({ x: 0, y: 0 })
        setZoom(1)
      }
    } catch (cause) {
      setError(friendlyError(cause, 'Could not rotate the photo.'))
    } finally {
      setPending(null)
    }
  }

  async function runAiCrop() {
    if (!src || detecting) return
    setPending('crop')
    setError('')
    try {
      const image = await loadImageFromSrc(source)
      const fitPhoto = renderTo512Jpeg(image, 'fit', null, null)
      if (!fitPhoto) {
        setError('Could not prepare the photo for garment detection.')
        return
      }
      const res = await fetch('/api/clothing-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo: fitPhoto, view: view.toLowerCase() }),
      })
      const data: unknown = await res.json().catch(() => null)
      if (!res.ok || typeof data !== 'object' || data === null) {
        const msg = typeof (data as { error?: unknown })?.error === 'string'
          ? (data as { error: string }).error
          : 'Could not detect the garment automatically. Try manual crop.'
        setError(msg)
        return
      }
      const box = parseCropBox((data as { cropBox?: unknown }).cropBox)
      if (!box) {
        setError('No clear garment crop box found. Try manual crop or fit whole garment.')
        return
      }
      const cropped = renderTo512Jpeg(image, 'ai', null, box)
      if (!cropped) {
        setError('Could not crop to the detected garment.')
        return
      }
      const name = (data as { name?: unknown }).name
      setAiPreview({ photo: cropped, name: typeof name === 'string' ? name : undefined })
      setMode('ai')
    } catch {
      const fallback = 'Network error while detecting garment. Try manual crop.'
      setError(navigator.onLine ? fallback : friendlyError(null, fallback))
    } finally {
      setPending(null)
    }
  }

  async function runCutout() {
    if (!src || detecting || mode === 'cutout' || (mode === 'manual' && !area)) return
    setPending('cutout')
    setError('')
    try {
      const photo = mode === 'ai' && aiPreview ? aiPreview.photo : renderTo512Jpeg(await loadImageFromSrc(source), mode, area, null)
      if (!photo) throw new Error('Could not prepare the photo.')
      const response = await fetch('/api/clothing-cutout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not remove the background.')
      setCutout({ photo: result.photo, previousMode: mode, name: mode === 'ai' ? aiPreview?.name : undefined })
      setMode('cutout')
    } catch (cause) {
      setError(friendlyError(cause, 'Could not remove the background. Try again or keep the original photo.'))
    } finally {
      setPending(null)
    }
  }

  function applyCrop() {
    if (mode === 'cutout' && cutout) {
      onChange(cutout.photo, cutout.name)
      setSrc('')
      setCutout(null)
      onReady(true)
      return
    }
    if (mode === 'ai' && aiPreview) {
      onChange(aiPreview.photo, aiPreview.name)
      setSrc('')
      setAiPreview(null)
      onReady(true)
      return
    }
    const image = mode === 'manual' ? media.current?.current : fullImage.current
    if (!image?.naturalWidth) return
    const jpeg = renderTo512Jpeg(image, mode, area, null)
    if (!jpeg) {
      setError('Could not prepare the photo. Choose it again.')
      return
    }
    onChange(jpeg)
    setSrc('')
    setAiPreview(null)
    onReady(true)
  }

  return <>
    <div className="photo-pickers">{(['Take photo', 'Choose from gallery'] as const).map(action =>
      <label key={action}>{currentPhoto && !src
        ? action === 'Take photo' ? 'Retake photo' : 'Choose replacement'
        : action}<input aria-label={view + ' · ' + action} type="file" accept="image/*" disabled={detecting} capture={action === 'Take photo' ? 'environment' : undefined} onChange={event => {
      const next = event.target.files?.[0]
      if (!next) return
      beginEditing(URL.createObjectURL(next))
      event.target.value = ''
    }} /></label>)}
    {!src && currentPhoto && <div className="actions" role="group" aria-label={view + ' photo actions'}>
      <button type="button" onClick={() => beginEditing(currentPhoto)}>Edit photo</button>
      <button type="button" onClick={onRemove}>Remove photo</button>
    </div>}</div>
    {src && <>
      <div className="actions" role="group" aria-label={view + ' photo rotation'}>
        <button type="button" onClick={() => void rotate(-1)} disabled={detecting}>Rotate left 90°</button>
        <button type="button" onClick={() => void rotate(1)} disabled={detecting}>Rotate right 90°</button>
      </div>
      <div className="actions">
        <button type="button" aria-pressed={mode === 'fit'} onClick={() => { setLoaded(false); setMode('fit') }} disabled={mode === 'fit' || detecting}>Fit whole garment</button>
        <button type="button" aria-pressed={mode === 'manual'} onClick={() => { setArea(null); setMode('manual') }} disabled={mode === 'manual' || detecting}>Manual crop</button>
        <button type="button" aria-pressed={mode === 'ai'} onClick={runAiCrop} disabled={!loaded || detecting}>
          {pending === 'crop' ? 'Detecting garment…' : 'AI smart crop'}
        </button>
        <button type="button" aria-pressed={mode === 'cutout'} onClick={runCutout} disabled={detecting || mode === 'cutout' || (mode === 'manual' ? !area : !loaded && !aiPreview)}>
          Remove background
        </button>
        {mode === 'cutout' && cutout?.previousMode && <button type="button" disabled={detecting}
          onClick={() => {
            if (cutout.previousMode === 'fit') setLoaded(false)
            setMode(cutout.previousMode ?? 'fit')
          }}>Undo background removal</button>}
      </div>
      {pending === 'cutout' && <p role="status">Removing background…</p>}
      {mode === 'manual' ? <><div className="crop-area"><Cropper key={source} image={source} aspect={1} crop={position} zoom={zoom}
        setImageRef={ref => { media.current = ref }}
        onCropChange={setPosition} onZoomChange={setZoom} onCropComplete={(_, pixels) => setArea(pixels)}
        mediaProps={{ onError: () => setError('This image could not be opened. Try a JPEG or PNG.') }} /></div>
      <label>Zoom<input type="range" min="1" max="3" step=".05" value={zoom} onChange={event => setZoom(Number(event.target.value))} /></label></> :
        mode === 'cutout' && cutout ?
          <img className="crop-preview cutout-preview" src={cutout.photo} alt={view + ' transparent garment cutout'} /> :
        mode === 'ai' && aiPreview ?
          <img className="crop-preview ai-preview" src={aiPreview.photo} alt={view + ' AI cropped garment preview'} /> :
          <img className="crop-preview fit-preview" ref={fullImage} src={source} alt={view + ' whole garment preview'}
            onLoad={() => setLoaded(true)} onError={() => setError('This image could not be opened. Try a JPEG or PNG.')} />}
      <div className="actions"><button type="button" disabled={detecting || (mode === 'cutout' ? !cutout : mode === 'manual' ? !area : !loaded && !aiPreview)} onClick={applyCrop}>Use {view.toLowerCase()} photo</button>
      <button type="button" disabled={detecting} onClick={() => { setSrc(''); setAiPreview(null); setCutout(null); setError(''); onReady(true) }}>Cancel crop</button></div>
    </>}
    {error && <p role="alert">{error}</p>}
  </>
}
