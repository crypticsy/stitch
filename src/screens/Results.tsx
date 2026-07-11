import { useEffect, useState } from 'react'
import type { LevelDef } from '../game/levels'
import { LEVELS } from '../game/levels'
import type { PlayOutcome } from '../App'

export default function Results({
  level,
  outcome,
  onRetry,
  onLevels,
  onPlay,
}: {
  level: LevelDef
  outcome: PlayOutcome
  onRetry: () => void
  onLevels: () => void
  onPlay: (level: LevelDef) => void
}) {
  const { result } = outcome
  const [shown, setShown] = useState(0)

  // Count the score up from zero.
  useEffect(() => {
    if (result.score === 0) return
    let raf = 0
    const t0 = performance.now()
    const duration = 900
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / duration)
      setShown(Math.round(result.score * (1 - (1 - k) ** 3)))
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [result.score])

  const nextLevel = LEVELS[LEVELS.findIndex((l) => l.id === level.id) + 1]
  const good = result.grade === 'S' || result.grade === 'A'

  return (
    <div className="screen results-screen">
      <span className="caption-strip">{level.title} · verdict</span>
      <div className={`stamp${good ? ' stamp--good' : ''}`}>{result.headline}</div>

      <div className="score-row">
        <div className="panel score-dial">
          {shown}
          <span> / 100 · grade {result.grade}</span>
        </div>
        <div className="score-notes">
          {result.errorPx !== null ? (
            <span>
              seam error: {Math.round(result.errorPx)}px off the algorithm's registration
              {level.pieces.length > 2 ? ` (mean over ${level.pieces.length - 1} seams)` : ''}
            </span>
          ) : (
            <span>
              all {level.pieces.length} true prints must be on the board to form a seam
            </span>
          )}
          {level.maxTilt > 0 && result.rotErrDeg !== null && (
            <span>
              residual tilt: {result.rotErrDeg < 0.5 ? 'square — perfectly straightened' : `${result.rotErrDeg.toFixed(1)}° left on the prints`}
            </span>
          )}
          <span>alignment score: {result.accuracy}/100</span>
          {result.decoyPenalty > 0 && (
            <span className="penalty">
              noise image on the board: −{result.decoyPenalty} (the algorithm would have rejected it)
            </span>
          )}
          <span>time used: {outcome.secondsUsed}s of {level.timeLimit}</span>
          {!outcome.usedFallback && (
            <span>
              system registration: {outcome.inliers}/{outcome.totalMatches} inliers (verified)
            </span>
          )}
        </div>
      </div>

      <div className="compare">
        <div className="panel compare-panel">
          <span className="caption-strip">the system's panorama</span>
          <img src={outcome.targetUrl} alt="Panorama stitched by the algorithm" />
        </div>
        <div className="panel compare-panel">
          <span className="caption-strip">your stitch</span>
          {outcome.userUrl ? (
            <img src={outcome.userUrl} alt="Panorama stitched by you" />
          ) : (
            <div className="nothing">…the board was empty. The tailor never showed.</div>
          )}
        </div>
      </div>

      <div className="results-actions">
        <button className="btn" onClick={onRetry}>
          Re-stitch this seam
        </button>
        {nextLevel && result.score >= 50 && (
          <button className="btn" onClick={() => onPlay(nextLevel)}>
            Next: {nextLevel.title} →
          </button>
        )}
        <button className="btn btn--quiet" onClick={onLevels}>
          Contact sheet
        </button>
      </div>
    </div>
  )
}
