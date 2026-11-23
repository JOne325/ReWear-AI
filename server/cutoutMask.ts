type Bounds = { left: number; top: number; width: number; height: number }

export function foregroundBounds(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number): Bounds | null {
  const pixels = width * height
  if (width <= 0 || height <= 0 || rgba.length !== pixels * 4) return null
  let left = width
  let top = height
  let right = -1
  let bottom = -1
  let foreground = 0
  let opaque = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = rgba[(y * width + x) * 4 + 3]
      if (alpha >= 192) foreground++
      if (alpha >= 250) opaque++
      if (alpha < 24) continue
      left = Math.min(left, x)
      top = Math.min(top, y)
      right = Math.max(right, x)
      bottom = Math.max(bottom, y)
    }
  }
  if (foreground < pixels * 0.01 || opaque >= pixels * 0.995) return null
  left = Math.max(0, left - 2)
  top = Math.max(0, top - 2)
  right = Math.min(width - 1, right + 2)
  bottom = Math.min(height - 1, bottom + 2)
  return { left, top, width: right - left + 1, height: bottom - top + 1 }
}
