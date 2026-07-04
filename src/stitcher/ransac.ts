import type { AlignResult, Match } from './types'

/**
 * RANSAC (section 3.1 of Brown–Lowe) specialised to a translation model:
 * a single correspondence proposes a motion, consensus is measured within a
 * pixel tolerance, and the final motion is the inlier mean. The camera pairs
 * in this dataset are near-pure pans, so a 2-DOF translation stands in for
 * the paper's 3-DOF rotation/homography while keeping the identical
 * sample → consensus → verify structure.
 *
 * Verification is the paper's probabilistic acceptance test (eq. 13):
 * accept iff n_inliers > alpha + beta * n_features, alpha = 8, beta = 0.3.
 */
export function ransacTranslation(
  matches: Match[],
  tolerance = 3,
  iterations = 400,
  alpha = 8,
  beta = 0.3,
): AlignResult | null {
  const n = matches.length
  if (n === 0) return null

  const vx = new Float32Array(n)
  const vy = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    vx[i] = matches[i].b.x - matches[i].a.x
    vy[i] = matches[i].b.y - matches[i].a.y
  }

  const tol2 = tolerance * tolerance
  let bestCount = 0
  let bestIdx = -1
  const iters = Math.min(iterations, n * 4)
  for (let t = 0; t < iters; t++) {
    const s = t < n ? t : Math.floor(Math.random() * n)
    let count = 0
    for (let i = 0; i < n; i++) {
      const dx = vx[i] - vx[s]
      const dy = vy[i] - vy[s]
      if (dx * dx + dy * dy < tol2) count++
    }
    if (count > bestCount) {
      bestCount = count
      bestIdx = s
    }
  }
  if (bestIdx < 0) return null

  // Refine: mean of consensus set.
  let sx = 0
  let sy = 0
  let m = 0
  for (let i = 0; i < n; i++) {
    const dx = vx[i] - vx[bestIdx]
    const dy = vy[i] - vy[bestIdx]
    if (dx * dx + dy * dy < tol2) {
      sx += vx[i]
      sy += vy[i]
      m++
    }
  }
  const mx = sx / m
  const my = sy / m

  return {
    // Match vectors are (b - a) positions; b's canvas offset is the negation.
    dx: -mx,
    dy: -my,
    inliers: m,
    totalMatches: n,
    verified: m > alpha + beta * n,
  }
}
