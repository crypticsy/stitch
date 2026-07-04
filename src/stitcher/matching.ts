import type { DescriptorSet } from './descriptors'
import type { Match } from './types'

/**
 * Nearest-neighbour feature matching with Lowe's ratio test: a match is kept
 * only when the best match is significantly better than the second best
 * (section 2/3 of the paper; they match each feature to its k nearest
 * neighbours — with two images this reduces to 1-NN + ratio test).
 */
export function matchFeatures(a: DescriptorSet, b: DescriptorSet, ratio = 0.8): Match[] {
  const matches: Match[] = []
  if (a.points.length === 0 || b.points.length === 0) return matches
  const dim = a.dim

  for (let i = 0; i < a.points.length; i++) {
    let best = -Infinity
    let second = -Infinity
    let bestJ = -1
    const ai = i * dim
    for (let j = 0; j < b.points.length; j++) {
      const bj = j * dim
      let dot = 0
      for (let k = 0; k < dim; k++) dot += a.data[ai + k] * b.data[bj + k]
      if (dot > best) {
        second = best
        best = dot
        bestJ = j
      } else if (dot > second) {
        second = dot
      }
    }
    // Descriptors are unit vectors: distance² = 2(1 - cos). Ratio test on (1 - cos).
    if (bestJ >= 0 && 1 - best < ratio * (1 - second)) {
      matches.push({ a: a.points[i], b: b.points[bestJ] })
    }
  }
  return matches
}
