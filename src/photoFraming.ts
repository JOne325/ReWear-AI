import type { Area } from 'react-easy-crop'

export type CropBox = { ymin: number; xmin: number; ymax: number; xmax: number }
export type CropMode = 'fit' | 'manual' | 'ai' | 'cutout'

const OUTPUT_SIZE = 512

export function renderTo512Jpeg(
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

export async function loadImageFromSrc(imageSrc: string): Promise<HTMLImageElement> {
  const img = new Image()
  img.src = imageSrc
  await img.decode()
  return img
}

export async function photoForDetails(photo: string) {
  if (photo.startsWith('data:image/jpeg;base64,')) return photo
  const jpeg = renderTo512Jpeg(await loadImageFromSrc(photo), 'fit', null, null)
  if (!jpeg) throw new Error('Could not prepare the cutout for photo suggestions.')
  return jpeg
}

export async function rotatePhoto(source: string, quarterTurns: number, format: 'image/png' | 'image/jpeg') {
  const image = await loadImageFromSrc(source)
  const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight))
  const width = Math.max(1, Math.round(image.naturalWidth * scale))
  const height = Math.max(1, Math.round(image.naturalHeight * scale))
  const swap = quarterTurns % 2 !== 0
  const canvas = document.createElement('canvas')
  canvas.width = swap ? height : width
  canvas.height = swap ? width : height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not rotate the photo.')
  context.translate(canvas.width / 2, canvas.height / 2)
  context.rotate(quarterTurns * Math.PI / 2)
  context.drawImage(image, -width / 2, -height / 2, width, height)
  return canvas.toDataURL(format, 0.92)
}
