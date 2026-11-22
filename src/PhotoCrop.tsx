import { useEffect, useRef, useState, type RefObject } from 'react'
import Cropper, { type Area } from 'react-easy-crop'

export default function PhotoCrop({ onChange, onReady }: {
  onChange: (photo: string) => void
  onReady: (ready: boolean) => void
}) {
  const media = useRef<RefObject<HTMLImageElement> | null>(null)
  const [src, setSrc] = useState('')
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [area, setArea] = useState<Area | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (src) return () => URL.revokeObjectURL(src)
  }, [src])

  function applyCrop() {
    const image = media.current?.current
    if (!area || !image?.naturalWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 512
    const ctx = canvas.getContext('2d')
    if (!ctx) { setError('Could not prepare the photo. Choose it again.'); return }
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, 512, 512)
    ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, 512, 512)
    onChange(canvas.toDataURL('image/jpeg', .84))
    setSrc('')
    onReady(true)
  }

  return <>
    <label>Garment photo<input type="file" accept="image/*" onChange={event => {
      const next = event.target.files?.[0]
      if (!next) return
      setSrc(URL.createObjectURL(next)); setArea(null); setError('')
      setPosition({ x: 0, y: 0 }); setZoom(1); onReady(false)
      event.target.value = ''
    }} /></label>
    {src && <>
      <div className="crop-area"><Cropper image={src} aspect={1} crop={position} zoom={zoom}
        setImageRef={ref => { media.current = ref }}
        onCropChange={setPosition} onZoomChange={setZoom} onCropComplete={(_, pixels) => setArea(pixels)}
        mediaProps={{ onError: () => setError('This image could not be opened. Try a JPEG or PNG.') }} /></div>
      <label>Zoom<input type="range" min="1" max="3" step=".05" value={zoom} onChange={event => setZoom(Number(event.target.value))} /></label>
      <div className="actions"><button type="button" disabled={!area} onClick={applyCrop}>Use crop</button>
      <button type="button" onClick={() => { setSrc(''); setError(''); onReady(true) }}>Cancel crop</button></div>
    </>}
    {error && <p role="alert">{error}</p>}
  </>
}
