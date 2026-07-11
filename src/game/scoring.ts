export interface PieceError {
  /** Distance between the player's and the algorithm's placement, source px. Zero for the anchor print. */
  posErrPx: number
  /** Residual tilt left on the print, degrees (target is always square). */
  rotErrDeg: number
}

export interface ScoreInput {
  /**
   * One entry per true print, anchor first. Null if the player failed to put
   * every true print on the board (no complete seam to judge).
   */
  pieceErrors: PieceError[] | null
  /** Number of decoy (noise) images the player left on the board. */
  decoysPlaced: number
}

export interface ScoreResult {
  /** 0–100. */
  score: number
  /** Alignment-only component, before decoy penalties. */
  accuracy: number
  /** Mean pixel error across seams (source px). Null if unstitched. */
  errorPx: number | null
  /** Mean residual tilt across prints, degrees. Null if unstitched. */
  rotErrDeg: number | null
  decoyPenalty: number
  grade: 'S' | 'A' | 'B' | 'C' | 'D'
  headline: string
}

const DECOY_PENALTY = 25
/** A degree of leftover tilt shifts an 800px print's edges ~7px — score it as such. */
const PX_PER_DEG = 7

/**
 * Closeness per print: Gaussian falloff on the combined seam error (position
 * plus tilt-equivalent pixels), with a small "perfect" dead zone. 70px on an
 * 800px-wide source (~9% of frame) costs ~63 points. The overall accuracy is
 * the mean over non-anchor prints, scaled by how square the anchor was left.
 */
export function scoreAttempt(input: ScoreInput): ScoreResult {
  const { pieceErrors, decoysPlaced } = input

  const gauss = (err: number) => {
    const e = Math.max(0, err - 8) // ≤8px counts as perfect
    return 100 * Math.exp(-((e / 70) ** 2))
  }

  let accuracy = 0
  let errorPx: number | null = null
  let rotErrDeg: number | null = null
  if (pieceErrors && pieceErrors.length >= 2) {
    const [anchor, ...rest] = pieceErrors
    const perPiece = rest.map((p) => gauss(p.posErrPx + Math.abs(p.rotErrDeg) * PX_PER_DEG))
    const anchorFactor = gauss(Math.abs(anchor.rotErrDeg) * PX_PER_DEG) / 100
    accuracy = (perPiece.reduce((s, v) => s + v, 0) / perPiece.length) * anchorFactor
    errorPx = rest.reduce((s, p) => s + p.posErrPx, 0) / rest.length
    rotErrDeg =
      pieceErrors.reduce((s, p) => s + Math.abs(p.rotErrDeg), 0) / pieceErrors.length
  }

  const decoyPenalty = decoysPlaced * DECOY_PENALTY
  const score = Math.max(0, Math.round(accuracy - decoyPenalty))

  const grade = score >= 97 ? 'S' : score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 50 ? 'C' : 'D'
  const headline =
    pieceErrors === null
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

  return {
    score,
    accuracy: Math.round(accuracy),
    errorPx,
    rotErrDeg,
    decoyPenalty,
    grade,
    headline,
  }
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
