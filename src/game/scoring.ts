export interface ScoreInput {
  /** Player's offset of piece B relative to piece A, in source pixels. Null if either piece unplaced. */
  userOffset: { dx: number; dy: number } | null
  /** The algorithm's offset of B relative to A, in source pixels. */
  targetOffset: { dx: number; dy: number }
  /** Number of decoy (noise) images the player left on the board. */
  decoysPlaced: number
}

export interface ScoreResult {
  /** 0–100. */
  score: number
  /** Alignment-only component, before decoy penalties. */
  accuracy: number
  /** Pixel error between user and target relative offset (source px). */
  errorPx: number | null
  decoyPenalty: number
  grade: 'S' | 'A' | 'B' | 'C' | 'D'
  headline: string
}

const DECOY_PENALTY = 25

/**
 * Closeness score: Gaussian falloff on the pixel error between the player's
 * relative offset and the algorithm's, with a small "perfect" dead zone.
 * 70px on an 800px-wide source (~9% of frame) costs ~63 points.
 */
export function scoreAttempt(input: ScoreInput): ScoreResult {
  const { userOffset, targetOffset, decoysPlaced } = input

  let accuracy = 0
  let errorPx: number | null = null
  if (userOffset) {
    const ex = userOffset.dx - targetOffset.dx
    const ey = userOffset.dy - targetOffset.dy
    errorPx = Math.hypot(ex, ey)
    const e = Math.max(0, errorPx - 8) // ≤8px counts as perfect
    accuracy = 100 * Math.exp(-((e / 70) ** 2))
  }

  const decoyPenalty = decoysPlaced * DECOY_PENALTY
  const score = Math.max(0, Math.round(accuracy - decoyPenalty))

  const grade = score >= 97 ? 'S' : score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 50 ? 'C' : 'D'
  const headline =
    userOffset === null
      ? 'UNSTITCHED!'
      : grade === 'S'
        ? 'SEAMLESS!'
        : grade === 'A'
          ? 'SHARP STITCH!'
          : grade === 'B'
            ? 'CLOSE WEAVE!'
            : grade === 'C'
              ? 'LOOSE THREAD!'
              : 'FRAYED!'

  return { score, accuracy: Math.round(accuracy), errorPx, decoyPenalty, grade, headline }
}

const KEY = 'stitch-best-scores-v1'

export function loadBestScores(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
}

export function saveBestScore(levelId: string, score: number): Record<string, number> {
  const best = loadBestScores()
  if ((best[levelId] ?? -1) < score) best[levelId] = score
  localStorage.setItem(KEY, JSON.stringify(best))
  return best
}
