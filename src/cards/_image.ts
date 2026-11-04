// Image-fetch + dither pipeline for Pulse cards.
//
// Cards that want to show a thumbnail in detail mode return a `getImage`
// result; this module turns the URL into PNG bytes the SDK can hand to the
// glasses image container.
//
// Pipeline:
//   fetch() → decode (createImageBitmap)
//   → draw to OffscreenCanvas at target W×H
//   → grayscale (Rec. 601: 0.299R + 0.587G + 0.114B)
//   → Floyd-Steinberg dither to 16 shades
//   → blob → ArrayBuffer → Uint8Array PNG bytes
//
// The G2 firmware renders 4-bit greyscale (16 shades). Photos with smooth
// gradients band hard at 16 shades; dithering trades spatial resolution for
// tonal range so they read as photos, not posters.
//
// Caching: a module-level Map keyed on `${url}|${w}x${h}`. Same artifact
// can be referenced by multiple list refreshes without re-fetching. The
// cache never invalidates within a session — restart the app to clear.
//
// BLE cost: each push is ~0.5–2 s per the SDK docs (no compression, no
// delta encoding). Callers should only push the image when game/card
// state changes, not on every render. The cache makes that cheap.

const CACHE = new Map<string, Uint8Array>()

export interface ImageRequest {
  url: string
  width: number  // 20–288 per SDK's ImageContainerProperty range
  height: number // 20–144
}

export async function fetchImageAsPngBytes(req: ImageRequest): Promise<Uint8Array> {
  const key = `${req.url}|${req.width}x${req.height}`
  const hit = CACHE.get(key)
  if (hit) return hit

  const res = await fetch(req.url, { mode: 'cors' })
  if (!res.ok) throw new Error(`image fetch ${res.status} ${res.statusText}`)
  const blob = await res.blob()
  const bitmap = await createImageBitmap(blob, { resizeWidth: req.width, resizeHeight: req.height, resizeQuality: 'high' })

  const canvas = new OffscreenCanvas(req.width, req.height)
  const ctx = canvas.getContext('2d')!
  // Black background — pixels at value 0 are "off" on the glasses (see-through).
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, req.width, req.height)
  ctx.drawImage(bitmap, 0, 0, req.width, req.height)

  const img = ctx.getImageData(0, 0, req.width, req.height)
  ditherToGray4(img.data, req.width, req.height)
  ctx.putImageData(img, 0, 0)

  const out = await canvas.convertToBlob({ type: 'image/png' })
  const bytes = new Uint8Array(await out.arrayBuffer())
  CACHE.set(key, bytes)
  return bytes
}

/** Floyd-Steinberg dither in place. Quantizes RGBA pixels to one of 16
 *  greyscale values (0, 17, 34, ..., 255) and propagates the per-pixel
 *  error to the right and downward neighbors. Operates on the luminance
 *  channel; alpha is forced to 255 (the SDK ignores alpha). */
function ditherToGray4(data: Uint8ClampedArray, w: number, h: number): void {
  // First pass: convert to grayscale luminance, store back into R=G=B.
  const lum = new Float32Array(w * h)
  for (let i = 0, j = 0; i < data.length; i += 4, j += 1) {
    lum[j] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
  }

  // Second pass: serpentine-free Floyd-Steinberg.
  // Quantize to nearest of 16 levels (step = 255/15 ≈ 17).
  const STEP = 255 / 15
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x
      const old = lum[idx]!
      const q = Math.round(old / STEP) * STEP
      lum[idx] = q
      const err = old - q
      // Right neighbor (7/16)
      if (x + 1 < w) lum[idx + 1] = (lum[idx + 1] ?? 0) + err * (7 / 16)
      // Bottom-left (3/16)
      if (x - 1 >= 0 && y + 1 < h) lum[idx + w - 1] = (lum[idx + w - 1] ?? 0) + err * (3 / 16)
      // Bottom (5/16)
      if (y + 1 < h) lum[idx + w] = (lum[idx + w] ?? 0) + err * (5 / 16)
      // Bottom-right (1/16)
      if (x + 1 < w && y + 1 < h) lum[idx + w + 1] = (lum[idx + w + 1] ?? 0) + err * (1 / 16)
    }
  }

  // Write back.
  for (let i = 0, j = 0; i < data.length; i += 4, j += 1) {
    const v = Math.max(0, Math.min(255, Math.round(lum[j]!)))
    data[i] = v
    data[i + 1] = v
    data[i + 2] = v
    data[i + 3] = 255
  }
}

/** Test hook — clear the cache between tests. */
export function _resetImageCacheForTests(): void {
  CACHE.clear()
}
