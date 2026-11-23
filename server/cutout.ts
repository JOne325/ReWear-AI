import type { BackgroundRemovalPipeline } from '@huggingface/transformers'
import { isRecord } from './gemini.ts'
import { foregroundBounds } from './cutoutMask.ts'

const prefix = 'data:image/jpeg;base64,'
let segmenter: Promise<BackgroundRemovalPipeline> | undefined
let processing = false

export async function removePhotoBackground(input: unknown) {
  if (!isRecord(input) || typeof input.photo !== 'string' || !input.photo.startsWith(prefix)) {
    return { status: 400, body: { error: 'Choose a garment photo first.' } }
  }
  const data = input.photo.slice(prefix.length)
  if (data.length > 500_000 || !data.startsWith('/9j/') || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
    return { status: 400, body: { error: 'The garment photo is invalid or too large.' } }
  }
  if (processing) {
    return { status: 503, body: { error: 'A cutout is already processing. Try again in a moment.' } }
  }

  processing = true
  try {
    const { pipeline, RawImage } = await import('@huggingface/transformers')
    const image = await RawImage.read(new Blob([Buffer.from(data, 'base64')], { type: 'image/jpeg' }))
    if (image.width > 512 || image.height > 512) {
      return { status: 400, body: { error: 'Prepare the photo in Add Clothing first.' } }
    }
    segmenter ??= pipeline('background-removal', 'onnx-community/BiRefNet_lite-ONNX', {
      device: 'cpu', dtype: 'fp32', cache_dir: 'node_modules/.cache/rewear-models',
    }).catch(error => {
      segmenter = undefined
      throw error
    })
    const cutout = await (await segmenter)(image)
    const bounds = foregroundBounds(cutout.data, cutout.width, cutout.height)
    if (!bounds) {
      return { status: 422, body: { error: 'Could not isolate the garment. Keep the original or try a photo with a plain background.' } }
    }
    const transparent = { r: 0, g: 0, b: 0, alpha: 0 }
    const png = await cutout.toSharp().extract(bounds)
      .resize(464, 464, { fit: 'contain', background: transparent })
      .extend({ top: 24, bottom: 24, left: 24, right: 24, background: transparent })
      .png().toBuffer()
    return { status: 200, body: { photo: 'data:image/png;base64,' + png.toString('base64') } }
  } catch {
    return { status: 502, body: { error: 'Could not remove the background. Try again or use the original photo.' } }
  } finally {
    processing = false
  }
}
