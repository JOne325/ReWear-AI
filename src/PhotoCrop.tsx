import { useEffect, useRef, useState, type RefObject } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { friendlyError } from './errors'

type CropBox = { ymin: number; xmin: number; ymax: number; xmax: number }
type CropMode = 'fit' | 'manual' | 'ai'

const AI_VERTICAL_PADDING = 10
const AI_HORIZONTAL_PADDING = 55
const OUTPUT_SIZE = 512

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

function renderTo512Jpeg(
  image: HTMLImageElement,
  mode: CropMode,
  area: Area | null,
  box: CropBox | null,
): string | null {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = OUTPUT_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE)

  const scale = OUTPUT_SIZE / Math.max(image.naturalWidth, image.naturalHeight)
  const width = image.naturalWidth * scale
  const height = image.naturalHeight * scale
  const left = (OUTPUT_SIZE - width) / 2
  const top = (OUTPUT_SIZE - height) / 2
  if (mode === 'manual' && area) {
    ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE)
  } else if (mode === 'ai' && box) {
    // Gemini measures the padded square sent for detection. Intersect its box
    // with the photo inside that square, then map back to the original pixels.
    const toPixels = (value: number) => value * OUTPUT_SIZE / 1000
    const x1 = Math.max(left, toPixels(box.xmin))
    const y1 = Math.max(top, toPixels(box.ymin))
    const croppedWidth = Math.min(left + width, toPixels(box.xmax)) - x1
    const croppedHeight = Math.min(top + height, toPixels(box.ymax)) - y1
    if (croppedWidth <= 0 || croppedHeight <= 0) return null

    const fit = OUTPUT_SIZE / Math.max(croppedWidth, croppedHeight)
    const targetWidth = croppedWidth * fit
    const targetHeight = croppedHeight * fit
    ctx.drawImage(image, (x1 - left) / scale, (y1 - top) / scale,
      croppedWidth / scale, croppedHeight / scale,
      (OUTPUT_SIZE - targetWidth) / 2, (OUTPUT_SIZE - targetHeight) / 2, targetWidth, targetHeight)
  } else {
    ctx.drawImage(image, left, top, width, height)
  }

  return canvas.toDataURL('image/jpeg', 0.84)
}

async function loadImageFromSrc(imageSrc: string): Promise<HTMLImageElement> {
  const img = new Image()
  img.src = imageSrc
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('Failed to load image'))
  })
  return img
}

export default function PhotoCrop({ view, onChange, onReady }: {
  view: 'Front' | 'Back'
  onChange: (photo: string) => void
  onReady: (ready: boolean) => void
}) {
  const media = useRef<RefObject<HTMLImageElement> | null>(null)
  const fullImage = useRef<HTMLImageElement>(null)
  const [mode, setMode] = useState<CropMode>('fit')
  const [loaded, setLoaded] = useState(false)
  const [src, setSrc] = useState('')
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [area, setArea] = useState<Area | null>(null)
  const [aiBox, setAiBox] = useState<CropBox | null>(null)
  const [aiPreview, setAiPreview] = useState('')
  const [detecting, setDetecting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (src) return () => URL.revokeObjectURL(src)
  }, [src])

  async function runAiCrop() {
    if (!src || detecting) return
    setDetecting(true)
    setError('')
    try {
      const image = fullImage.current?.naturalWidth ? fullImage.current : await loadImageFromSrc(src)
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
      setAiBox(box)
      setAiPreview(cropped)
      setMode('ai')
    } catch {
      const fallback = 'Network error while detecting garment. Try manual crop.'
      setError(navigator.onLine ? fallback : friendlyError(null, fallback))
    } finally {
      setDetecting(false)
    }
  }

  function applyCrop() {
    if (mode === 'ai' && aiPreview) {
      onChange(aiPreview)
      setSrc('')
      setAiBox(null)
      setAiPreview('')
      onReady(true)
      return
    }
    const image = mode === 'manual' ? media.current?.current : fullImage.current
    if (!image?.naturalWidth) return
    const jpeg = renderTo512Jpeg(image, mode, area, aiBox)
    if (!jpeg) {
      setError('Could not prepare the photo. Choose it again.')
      return
    }
    onChange(jpeg)
    setSrc('')
    setAiBox(null)
    setAiPreview('')
    onReady(true)
  }

  return <>
    <div className="photo-pickers">{(['Take photo', 'Choose from gallery'] as const).map(action =>
      <label key={action}>{action}<input aria-label={view + ' · ' + action} type="file" accept="image/*" disabled={detecting} capture={action === 'Take photo' ? 'environment' : undefined} onChange={event => {
      const next = event.target.files?.[0]
      if (!next) return
      setSrc(URL.createObjectURL(next)); setArea(null); setAiBox(null); setAiPreview(''); setError('')
      setMode('fit'); setLoaded(false)
      setPosition({ x: 0, y: 0 }); setZoom(1); onReady(false)
      event.target.value = ''
    }} /></label>)}</div>
    {src && <>
      <div className="actions">
        <button type="button" aria-pressed={mode === 'fit'} onClick={() => { setLoaded(true); setMode('fit') }} disabled={mode === 'fit' || detecting}>Fit whole garment</button>
        <button type="button" aria-pressed={mode === 'manual'} onClick={() => { setArea(null); setMode('manual') }} disabled={mode === 'manual' || detecting}>Manual crop</button>
        <button type="button" aria-pressed={mode === 'ai'} onClick={runAiCrop} disabled={!loaded || detecting}>
          {detecting ? 'Detecting garment...' : 'AI smart crop'}
        </button>
      </div>
      {mode === 'manual' ? <><div className="crop-area"><Cropper image={src} aspect={1} crop={position} zoom={zoom}
        setImageRef={ref => { media.current = ref }}
        onCropChange={setPosition} onZoomChange={setZoom} onCropComplete={(_, pixels) => setArea(pixels)}
        mediaProps={{ onError: () => setError('This image could not be opened. Try a JPEG or PNG.') }} /></div>
      <label>Zoom<input type="range" min="1" max="3" step=".05" value={zoom} onChange={event => setZoom(Number(event.target.value))} /></label></> :
        mode === 'ai' && aiPreview ?
          <img className="crop-preview ai-preview" src={aiPreview} alt={view + ' AI cropped garment preview'} /> :
          <img className="crop-preview fit-preview" ref={fullImage} src={src} alt={view + ' whole garment preview'}
            onLoad={() => setLoaded(true)} onError={() => setError('This image could not be opened. Try a JPEG or PNG.')} />}
      <div className="actions"><button type="button" disabled={detecting || (mode === 'manual' ? !area : !loaded && !aiPreview)} onClick={applyCrop}>Use {view.toLowerCase()} photo</button>
      <button type="button" disabled={detecting} onClick={() => { setSrc(''); setAiBox(null); setAiPreview(''); setError(''); onReady(true) }}>Cancel crop</button></div>
    </>}
    {error && <p role="alert">{error}</p>}
  </>
}
