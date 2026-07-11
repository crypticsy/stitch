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
  /** RANSAC inliers summed over every adjacent pair in the chain. */
  inliers: number
  totalMatches: number
  /** Adjacent pairs whose live registration passed the eq. 13 test. */
  linksVerified: number
  linkCount: number
  /** True if any link fell back to the archived registration. */
  usedFallback: boolean
}

/**
 * Full pipeline for an n-image connected component, following Brown & Lowe
 * "Automatic Panoramic Image Stitching using Invariant Features":
 * invariant interest points → descriptor matching → RANSAC motion →
 * probabilistic verification → gain compensation → weighted blending
 * (blending happens at render time, see renderPanorama).
 *
 * Pieces come in chain order; each adjacent pair is aligned independently
 * and offsets are accumulated along the chain.
 */
export async function stitchChain(
  srcs: string[],
  fallbacks: { dx: number; dy: number }[],
): Promise<StitchOutcome> {
  const imgs = await Promise.all(srcs.map(loadImage))
  const ids = imgs.map((img) => toImageData(img, WORK_WIDTH))
  const scale = imgs[0].naturalWidth / WORK_WIDTH

  // Align each adjacent pair; accumulate positions along the chain.
  const xs = [0]
  const ys = [0]
  let inliers = 0
  let totalMatches = 0
  let linksVerified = 0
  let usedFallback = false
  const linkDx: number[] = [] // work px, for gain overlap ranges
  for (let i = 0; i < ids.length - 1; i++) {
    const align = alignPair(ids[i], ids[i + 1])
    let dx: number
    let dy: number
    if (align && align.verified) {
      dx = align.dx * scale
      dy = align.dy * scale
      inliers += align.inliers
      totalMatches += align.totalMatches
      linksVerified++
    } else {
      dx = fallbacks[i].dx
      dy = fallbacks[i].dy
      usedFallback = true
      if (align) totalMatches += align.totalMatches
    }
    xs.push(xs[i] + dx)
    ys.push(ys[i] + dy)
    linkDx.push(dx / scale)
  }

  // Gain compensation (section 6, simplified): equalise the mean luminance
  // of each piece over its overlap regions, gains anchored around 1.
  const lums = ids.map((id, i) => {
    const ranges: [number, number][] = []
    if (i > 0) {
      const d = linkDx[i - 1]
      ranges.push(d >= 0 ? [0, WORK_WIDTH - d] : [-d, WORK_WIDTH])
    }
    if (i < ids.length - 1) {
      const d = linkDx[i]
      ranges.push(d >= 0 ? [d, WORK_WIDTH] : [0, WORK_WIDTH + d])
    }
    const vals = ranges.map(([a, b]) => meanLuminance(id, a, b))
    return vals.reduce((s, v) => s + v, 0) / vals.length
  })
  const target = lums.reduce((s, v) => s + v, 0) / lums.length
  const clamp = (g: number) => Math.min(1.35, Math.max(0.7, g))

  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const pieces: PieceLayout[] = imgs.map((img, i) => ({
    src: srcs[i],
    img,
    x: xs[i] - minX,
    y: ys[i] - minY,
    gain: clamp(target / Math.max(lums[i], 1e-3)),
  }))

  return {
    pieces,
    inliers,
    totalMatches,
    linksVerified,
    linkCount: ids.length - 1,
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

export interface RenderPiece {
  img: HTMLImageElement
  x: number
  y: number
  gain: number
  /** Rotation about the piece centre, degrees clockwise. */
  rot?: number
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
 *
 * Pieces may be rotated about their centre (the crooked-prints mechanic);
 * weights are evaluated in the piece's own unrotated frame.
 */
export function renderPanorama(pieces: RenderPiece[], opts: RenderOptions): HTMLCanvasElement {
  const { scale, gainCompensation = true } = opts
  const rects = pieces.map((p) => {
    const w = p.img.naturalWidth * scale
    const h = p.img.naturalHeight * scale
    const th = ((p.rot ?? 0) * Math.PI) / 180
    const bw = w * Math.abs(Math.cos(th)) + h * Math.abs(Math.sin(th))
    const bh = w * Math.abs(Math.sin(th)) + h * Math.abs(Math.cos(th))
    const cx = p.x * scale + w / 2
    const cy = p.y * scale + h / 2
    return { w, h, th, bw, bh, x: cx - bw / 2, y: cy - bh / 2 }
  })
  const minX = Math.min(...rects.map((r) => r.x))
  const minY = Math.min(...rects.map((r) => r.y))
  const maxX = Math.max(...rects.map((r) => r.x + r.bw))
  const maxY = Math.max(...rects.map((r) => r.y + r.bh))
  const outW = Math.max(1, Math.round(maxX - minX))
  const outH = Math.max(1, Math.round(maxY - minY))

  const acc = new Float32Array(outW * outH * 3)
  const wacc = new Float32Array(outW * outH)

  const work = document.createElement('canvas')
  const wctx = work.getContext('2d', { willReadFrequently: true })!

  pieces.forEach((p, i) => {
    const r = rects[i]
    const bw = Math.max(1, Math.round(r.bw))
    const bh = Math.max(1, Math.round(r.bh))
    work.width = bw
    work.height = bh
    wctx.clearRect(0, 0, bw, bh)
    wctx.save()
    wctx.translate(bw / 2, bh / 2)
    wctx.rotate(r.th)
    wctx.drawImage(p.img, -r.w / 2, -r.h / 2, r.w, r.h)
    wctx.restore()
    const data = wctx.getImageData(0, 0, bw, bh).data
    const gain = gainCompensation ? p.gain : 1
    const ox = Math.round(r.x - minX)
    const oy = Math.round(r.y - minY)
    const cos = Math.cos(r.th)
    const sin = Math.sin(r.th)
    for (let y = 0; y < bh; y++) {
      const ty = oy + y
      if (ty < 0 || ty >= outH) continue
      const dy = y - bh / 2
      for (let x = 0; x < bw; x++) {
        const tx = ox + x
        if (tx < 0 || tx >= outW) continue
        const sp = (y * bw + x) * 4
        if (data[sp + 3] < 16) continue
        // Weight in the piece's unrotated frame (inverse-rotate the offset).
        const dx = x - bw / 2
        const u = cos * dx + sin * dy
        const v = -sin * dx + cos * dy
        const wx = Math.max(0, 1 - Math.abs((2 * u) / r.w))
        const wy = Math.max(0, 1 - Math.abs((2 * v) / r.h))
        const weight = wx * wy + 1e-5
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
