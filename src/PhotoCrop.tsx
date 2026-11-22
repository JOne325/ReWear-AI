import { useEffect, useRef, useState, type RefObject } from 'react'
import Cropper, { type Area } from 'react-easy-crop'

export default function PhotoCrop({ view, onChange, onReady }: {
  view: 'Front' | 'Back'
  onChange: (photo: string) => void
  onReady: (ready: boolean) => void
}) {
  const media = useRef<RefObject<HTMLImageElement> | null>(null)
  const fullImage = useRef<HTMLImageElement>(null)
  const [manual, setManual] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [src, setSrc] = useState('')
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [area, setArea] = useState<Area | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (src) return () => URL.revokeObjectURL(src)
  }, [src])

  function applyCrop() {
    const image = manual ? media.current?.current : fullImage.current
    if (!image?.naturalWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 512
    const ctx = canvas.getContext('2d')
    if (!ctx) { setError('Could not prepare the photo. Choose it again.'); return }
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, 512, 512)
    if (manual && area) {
      ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, 512, 512)
    } else {
      const scale = 512 / Math.max(image.naturalWidth, image.naturalHeight)
      const width = image.naturalWidth * scale
      const height = image.naturalHeight * scale
      ctx.drawImage(image, (512 - width) / 2, (512 - height) / 2, width, height)
    }
    onChange(canvas.toDataURL('image/jpeg', .84))
    setSrc('')
    onReady(true)
  }

  return <>
    <div className="photo-pickers">{(['Take photo', 'Choose from gallery'] as const).map(action =>
      <label key={action}>{action}<input aria-label={view + ' · ' + action} type="file" accept="image/*" capture={action === 'Take photo' ? 'environment' : undefined} onChange={event => {
      const next = event.target.files?.[0]
      if (!next) return
      setSrc(URL.createObjectURL(next)); setArea(null); setError('')
      setManual(false); setLoaded(false)
      setPosition({ x: 0, y: 0 }); setZoom(1); onReady(false)
      event.target.value = ''
    }} /></label>)}</div>
    {src && <>
      <div className="actions">
        <button type="button" aria-pressed={!manual} onClick={() => { setLoaded(false); setManual(false) }} disabled={!manual}>Fit whole garment</button>
        <button type="button" aria-pressed={manual} onClick={() => { setArea(null); setManual(true) }} disabled={manual}>Manual crop</button>
      </div>
      {manual ? <><div className="crop-area"><Cropper image={src} aspect={1} crop={position} zoom={zoom}
        setImageRef={ref => { media.current = ref }}
        onCropChange={setPosition} onZoomChange={setZoom} onCropComplete={(_, pixels) => setArea(pixels)}
        mediaProps={{ onError: () => setError('This image could not be opened. Try a JPEG or PNG.') }} /></div>
      <label>Zoom<input type="range" min="1" max="3" step=".05" value={zoom} onChange={event => setZoom(Number(event.target.value))} /></label></> :
        <img className="crop-preview fit-preview" ref={fullImage} src={src} alt={view + ' whole garment preview'}
          onLoad={() => setLoaded(true)} onError={() => setError('This image could not be opened. Try a JPEG or PNG.')} />}
      <div className="actions"><button type="button" disabled={manual ? !area : !loaded} onClick={applyCrop}>Use {view.toLowerCase()} photo</button>
      <button type="button" onClick={() => { setSrc(''); setError(''); onReady(true) }}>Cancel crop</button></div>
    </>}
    {error && <p role="alert">{error}</p>}
  </>
}
