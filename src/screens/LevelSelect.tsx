import { useMemo } from 'react'
import { ACT_NAMES, LEVELS } from '../game/levels'
import type { LevelDef } from '../game/levels'
import { loadBestScores } from '../game/scoring'

const UNLOCK_SCORE = 50

function gradeFor(score: number): string {
  return score >= 97 ? 'S' : score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 50 ? 'C' : 'D'
}

function levelMeta(level: LevelDef): string {
  const parts = [`${level.pieces.length + level.decoys.length} prints`]
  if (level.decoys.length > 0) parts.push(`${level.decoys.length} noise`)
  if (level.maxTilt > 0) parts.push('crooked')
  if (level.pieces.length > 2) parts.push(`${level.pieces.length}-print seam`)
  return parts.join(' · ')
}

export default function LevelSelect({
  onPick,
  onBack,
}: {
  onPick: (level: LevelDef) => void
  onBack: () => void
}) {
  const best = useMemo(loadBestScores, [])

  const unlocked = (index: number) => {
    if (index === 0) return true
    const prev = LEVELS[index - 1]
    return (best[prev.id] ?? 0) >= UNLOCK_SCORE
  }

  return (
    <div className="screen">
      <div className="contact-sheet">
        <div className="sheet-header">
          <div>
            <span className="caption-strip">the contact sheet</span>
            <h1>Pick a panorama</h1>
          </div>
          <button className="btn btn--quiet" onClick={onBack}>
            ← Home
          </button>
        </div>

        {([1, 2, 3, 4] as const).map((act) => (
          <section className="act" key={act}>
            <h2>
              {ACT_NAMES[act]} <hr className="thread" />
            </h2>
            <div className="level-grid">
              {LEVELS.map((level, i) => ({ level, i }))
                .filter(({ level }) => level.act === act)
                .map(({ level, i }) => {
                  const open = unlocked(i)
                  const score = best[level.id]
                  return (
                    <button
                      key={level.id}
                      className={`level-card${open ? '' : ' level-card--locked'}`}
                      disabled={!open}
                      onClick={() => onPick(level)}
                    >
                      <div className="level-thumbs">
                        {level.pieces.slice(0, 3).map((src, t) => (
                          <img key={t} src={src} alt="" loading="lazy" />
                        ))}
                      </div>
                      <div className="level-body">
                        <h3>{level.title}</h3>
                        <p>{open ? level.blurb : `Score ${UNLOCK_SCORE}+ on the previous seam to unlock.`}</p>
                        <div className="level-meta">
                          <span>{levelMeta(level)}</span>
                          {score !== undefined && (
                            <span className="grade-chip">
                              {gradeFor(score)} · {score}
                            </span>
                          )}
                          {!open && <span>🔒</span>}
                        </div>
                      </div>
                    </button>
                  )
                })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
