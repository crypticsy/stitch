import type { GrayImage, Point } from './types'

/**
 * Harris corner detector (Harris & Stephens '88), the interest-point stage of the
 * pipeline. Brown & Lowe use SIFT keypoints; we use Harris corners with the same
 * downstream matching/RANSAC/verification machinery.
 */
export function harrisCorners(img: GrayImage, maxPoints = 250, k = 0.04): Point[] {
  const { data, width: w, height: h } = img
  const n = w * h

  const ix = new Float32Array(n)
  const iy = new Float32Array(n)
  for (let y = 0; y < h; y++) {
    for (let x = 1; x < w - 1; x++) {
      ix[y * w + x] = (data[y * w + x + 1] - data[y * w + x - 1]) / 2
    }
  }
  for (let y = 1; y < h - 1; y++) {
    for (let x = 0; x < w; x++) {
      iy[y * w + x] = (data[(y + 1) * w + x] - data[(y - 1) * w + x]) / 2
    }
  }

  const ixx = new Float32Array(n)
  const iyy = new Float32Array(n)
  const ixy = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    ixx[i] = ix[i] * ix[i]
    iyy[i] = iy[i] * iy[i]
    ixy[i] = ix[i] * iy[i]
  }

  const sxx = boxFilter(ixx, w, h, 2)
  const syy = boxFilter(iyy, w, h, 2)
  const sxy = boxFilter(ixy, w, h, 2)

  const r = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const det = sxx[i] * syy[i] - sxy[i] * sxy[i]
    const tr = sxx[i] + syy[i]
    r[i] = det - k * tr * tr
  }

  // Non-max suppression (3x3) with a border margin so descriptors fit.
  const margin = 14
  const candidates: { x: number; y: number; v: number }[] = []
  for (let y = margin; y < h - margin; y++) {
    for (let x = margin; x < w - margin; x++) {
      const v = r[y * w + x]
      if (v <= 0) continue
      let isMax = true
      for (let dy = -1; dy <= 1 && isMax; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue
          if (r[(y + dy) * w + (x + dx)] > v) {
            isMax = false
            break
          }
        }
      }
      if (isMax) candidates.push({ x, y, v })
    }
  }

  candidates.sort((a, b) => b.v - a.v)
  return candidates.slice(0, maxPoints).map(({ x, y }) => ({ x, y }))
}

/** Box filter via integral image, radius r (window 2r+1). */
function boxFilter(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const iw = w + 1
  const ii = new Float64Array((w + 1) * (h + 1))
  for (let y = 0; y < h; y++) {
    let rowSum = 0
    for (let x = 0; x < w; x++) {
      rowSum += src[y * w + x]
      ii[(y + 1) * iw + (x + 1)] = ii[y * iw + (x + 1)] + rowSum
    }
  }
  const out = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r)
    const y1 = Math.min(h, y + r + 1)
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r)
      const x1 = Math.min(w, x + r + 1)
      out[y * w + x] = ii[y1 * iw + x1] - ii[y0 * iw + x1] - ii[y1 * iw + x0] + ii[y0 * iw + x0]
    }
  }
  return out
}
