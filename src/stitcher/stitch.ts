import { loadImage, meanLuminance, toGray, toImageData } from './image'
import { harrisCorners } from './harris'
import { extractDescriptors } from './descriptors'
import { matchFeatures } from './matching'
import { ransacTranslation } from './ransac'
import type { AlignResult } from './types'

/** Width the feature pipeline works at; offsets are scaled back to source pixels. */
const WORK_WIDTH = 400

export interface PieceLayout {
  src: string
  img: HTMLImageElement
  /** Top-left offset in panorama space, source pixels. */
  x: number
  y: number
  /** Photometric gain (section 6, gain compensation). */
  gain: number
}

export interface StitchOutcome {
  pieces: PieceLayout[]
  align: AlignResult
  usedFallback: boolean
}

/**
 * Full pipeline for a two-image component, following Brown & Lowe
 * "Automatic Panoramic Image Stitching using Invariant Features":
 * invariant interest points → descriptor matching → RANSAC motion →
 * probabilistic verification → gain compensation → weighted blending
 * (blending happens at render time, see renderPanorama).
 */
export async function stitchPair(
  srcA: string,
  srcB: string,
  fallback: { dx: number; dy: number },
): Promise<StitchOutcome> {
  const [imgA, imgB] = await Promise.all([loadImage(srcA), loadImage(srcB)])
  const idA = toImageData(imgA, WORK_WIDTH)
  const idB = toImageData(imgB, WORK_WIDTH)

  const align = alignPair(idA, idB)
  const scale = imgA.naturalWidth / WORK_WIDTH

  let dx: number
  let dy: number
  let usedFallback = false
  if (align && align.verified) {
    dx = align.dx * scale
    dy = align.dy * scale
  } else {
    dx = fallback.dx
    dy = fallback.dy
    usedFallback = true
  }

  // Gain compensation (section 6, simplified for a pair): equalise the mean
  // luminance of the overlap region, with gains anchored around 1.
  const dxWork = dx / scale
  const overlapA: [number, number] = dxWork >= 0 ? [dxWork, WORK_WIDTH] : [0, WORK_WIDTH + dxWork]
  const overlapB: [number, number] = dxWork >= 0 ? [0, WORK_WIDTH - dxWork] : [-dxWork, WORK_WIDTH]
  const lumA = meanLuminance(idA, overlapA[0], overlapA[1])
  const lumB = meanLuminance(idB, overlapB[0], overlapB[1])
  const target = (lumA + lumB) / 2
  const clamp = (g: number) => Math.min(1.35, Math.max(0.7, g))
  const gainA = clamp(target / Math.max(lumA, 1e-3))
  const gainB = clamp(target / Math.max(lumB, 1e-3))

  const pieces: PieceLayout[] = [
    { src: srcA, img: imgA, x: Math.max(0, -dx), y: Math.max(0, -dy), gain: gainA },
    { src: srcB, img: imgB, x: Math.max(0, dx), y: Math.max(0, dy), gain: gainB },
  ]

  return {
    pieces,
    align: align ?? { dx, dy, inliers: 0, totalMatches: 0, verified: false },
    usedFallback,
  }
}

/** Feature-match two images and estimate the motion between them. */
export function alignPair(idA: ImageData, idB: ImageData): AlignResult | null {
  const grayA = toGray(idA)
  const grayB = toGray(idB)
  const descA = extractDescriptors(grayA, harrisCorners(grayA))
  const descB = extractDescriptors(grayB, harrisCorners(grayB))
  const matches = matchFeatures(descA, descB)
  return ransacTranslation(matches)
}

export interface RenderOptions {
  /** Scale from source pixels to output pixels. */
  scale: number
  /** Apply per-image gain compensation. */
  gainCompensation?: boolean
}

/**
 * Render pieces into a blended panorama using the paper's linear blending
 * (eq. 30): each image contributes with weight w(x)w(y), varying linearly
 * from 1 at the image centre to 0 at the edges, and the composite is the
 * weight-normalised sum. (The paper refines this with multi-band blending;
 * linear blending is the single-band case.)
 */
export function renderPanorama(
  pieces: { img: HTMLImageElement; x: number; y: number; gain: number }[],
  opts: RenderOptions,
): HTMLCanvasElement {
  const { scale, gainCompensation = true } = opts
  const rects = pieces.map((p) => ({
    x: p.x * scale,
    y: p.y * scale,
    w: p.img.naturalWidth * scale,
    h: p.img.naturalHeight * scale,
  }))
  const minX = Math.min(...rects.map((r) => r.x))
  const minY = Math.min(...rects.map((r) => r.y))
  const maxX = Math.max(...rects.map((r) => r.x + r.w))
  const maxY = Math.max(...rects.map((r) => r.y + r.h))
  const outW = Math.max(1, Math.round(maxX - minX))
  const outH = Math.max(1, Math.round(maxY - minY))

  const acc = new Float32Array(outW * outH * 3)
  const wacc = new Float32Array(outW * outH)

  const work = document.createElement('canvas')
  const wctx = work.getContext('2d', { willReadFrequently: true })!

  pieces.forEach((p, i) => {
    const r = rects[i]
    const w = Math.max(1, Math.round(r.w))
    const h = Math.max(1, Math.round(r.h))
    work.width = w
    work.height = h
    wctx.drawImage(p.img, 0, 0, w, h)
    const data = wctx.getImageData(0, 0, w, h).data
    const gain = gainCompensation ? p.gain : 1
    const ox = Math.round(r.x - minX)
    const oy = Math.round(r.y - minY)
    for (let y = 0; y < h; y++) {
      const ty = oy + y
      if (ty < 0 || ty >= outH) continue
      const wy = 1 - Math.abs((2 * y) / (h - 1) - 1)
      for (let x = 0; x < w; x++) {
        const tx = ox + x
        if (tx < 0 || tx >= outW) continue
        const wx = 1 - Math.abs((2 * x) / (w - 1) - 1)
        const weight = wx * wy + 1e-5
        const sp = (y * w + x) * 4
        const tp = ty * outW + tx
        acc[tp * 3] += data[sp] * gain * weight
        acc[tp * 3 + 1] += data[sp + 1] * gain * weight
        acc[tp * 3 + 2] += data[sp + 2] * gain * weight
        wacc[tp] += weight
      }
    }
  })

  const out = document.createElement('canvas')
  out.width = outW
  out.height = outH
  const ctx = out.getContext('2d')!
  const outData = ctx.createImageData(outW, outH)
  for (let i = 0; i < outW * outH; i++) {
    const wsum = wacc[i]
    if (wsum > 1e-5) {
      outData.data[i * 4] = Math.min(255, acc[i * 3] / wsum)
      outData.data[i * 4 + 1] = Math.min(255, acc[i * 3 + 1] / wsum)
      outData.data[i * 4 + 2] = Math.min(255, acc[i * 3 + 2] / wsum)
      outData.data[i * 4 + 3] = 255
    }
  }
  ctx.putImageData(outData, 0, 0)
  return out
}
