import type { GrayImage } from './types'

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load ${src}`))
    img.src = src
  })
}

/** Draw an image scaled to `width` and return its ImageData. */
export function toImageData(img: HTMLImageElement, width: number): ImageData {
  const height = Math.round((img.naturalHeight * width) / img.naturalWidth)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0, width, height)
  return ctx.getImageData(0, 0, width, height)
}

export function toGray(im: ImageData): GrayImage {
  const { width, height, data } = im
  const g = new Float32Array(width * height)
  for (let i = 0, p = 0; i < g.length; i++, p += 4) {
    g[i] = (0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]) / 255
  }
  return { data: g, width, height }
}

/** Mean luminance of a horizontal band [x0,x1) of the image — used for gain compensation. */
export function meanLuminance(im: ImageData, x0: number, x1: number): number {
  const { width, height, data } = im
  const xa = Math.max(0, Math.floor(x0))
  const xb = Math.min(width, Math.ceil(x1))
  if (xb <= xa) return 0.5
  let sum = 0
  let n = 0
  for (let y = 0; y < height; y++) {
    for (let x = xa; x < xb; x++) {
      const p = (y * width + x) * 4
      sum += 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]
      n++
    }
  }
  return sum / n / 255
}
