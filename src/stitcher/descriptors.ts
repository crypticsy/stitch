import type { GrayImage, Point } from './types'

export interface DescriptorSet {
  /** Flattened descriptors, `dim` floats each, bias/gain normalized (zero mean, unit norm). */
  data: Float32Array
  points: Point[]
  dim: number
}

const SIZE = 8 // 8x8 samples
const STEP = 3 // sampled every 3px -> 24px footprint
export const DESC_DIM = SIZE * SIZE

/**
 * Normalized intensity patch descriptors (in the spirit of Brown–Lowe's MOPS /
 * SIFT descriptors): an 8x8 grid sampled at a coarser scale than the detection
 * point, normalized for bias (mean) and gain (norm) — the same illumination
 * invariance argument as section 2 of the paper.
 */
export function extractDescriptors(img: GrayImage, pts: Point[]): DescriptorSet {
  const { data, width: w, height: h } = img
  const span = SIZE * STEP
  const half = span >> 1
  const kept: Point[] = []
  const out: number[] = []

  for (const { x, y } of pts) {
    const x0 = x - half
    const y0 = y - half
    if (x0 < 0 || y0 < 0 || x0 + span >= w || y0 + span >= h) continue

    const d = new Float32Array(DESC_DIM)
    let mean = 0
    for (let j = 0; j < SIZE; j++) {
      for (let i = 0; i < SIZE; i++) {
        const v = data[(y0 + j * STEP) * w + (x0 + i * STEP)]
        d[j * SIZE + i] = v
        mean += v
      }
    }
    mean /= DESC_DIM
    let norm = 0
    for (let i = 0; i < DESC_DIM; i++) {
      d[i] -= mean
      norm += d[i] * d[i]
    }
    norm = Math.sqrt(norm)
    if (norm < 1e-6) continue
    for (let i = 0; i < DESC_DIM; i++) d[i] /= norm

    kept.push({ x, y })
    for (let i = 0; i < DESC_DIM; i++) out.push(d[i])
  }

  return { data: new Float32Array(out), points: kept, dim: DESC_DIM }
}
