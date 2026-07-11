import { useCallback, useEffect, useRef, useState } from 'react'
import type { LevelDef } from '../game/levels'
import { scoreAttempt } from '../game/scoring'
import type { PieceError } from '../game/scoring'
import { loadImage } from '../stitcher/image'
import { renderPanorama, stitchChain } from '../stitcher/stitch'
import type { StitchOutcome } from '../stitcher/stitch'
import type { PlayOutcome } from '../App'

interface PieceState {
  id: string
  img: HTMLImageElement
  isDecoy: boolean
  gain: number
  placed: boolean
  /** Top-left position on the board, display px. */
  x: number
  y: number
  /** Tilt about the print's centre, degrees. Target is always 0. */
  rot: number
}

type Phase = 'loading' | 'reveal' | 'playing'

const RENDER_SCALE = 0.55
const MAX_ROT = 45

/** Crooked-lab spawn tilt: noticeably askew, random direction. */
function spawnTilt(maxTilt: number): number {
  if (maxTilt <= 0) return 0
  const sign = Math.random() < 0.5 ? -1 : 1
  return sign * Math.round(maxTilt * (0.35 + 0.65 * Math.random()))
}

export default function Play({
  level,
  onFinish,
  onQuit,
}: {
  level: LevelDef
  onFinish: (outcome: PlayOutcome) => void
  onQuit: () => void
}) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [pieces, setPieces] = useState<PieceState[]>([])
  const [secondsLeft, setSecondsLeft] = useState(level.timeLimit)
  const [targetUrl, setTargetUrl] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const stitchRef = useRef<StitchOutcome | null>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const endTimeRef = useRef(0)
  const grabOffset = useRef({ x: 0, y: 0 })
  const submittedRef = useRef(false)
  const piecesRef = useRef<PieceState[]>([])
  piecesRef.current = pieces
  const selectedIdRef = useRef<string | null>(null)
  selectedIdRef.current = selectedId

  /** Fraction of the board width a single print occupies — smaller for long chains. */
  const pieceFraction = level.pieces.length > 2 ? 0.3 : 0.42

  // ---- level setup: run the paper's pipeline on the real chain, load decoys ----
  useEffect(() => {
    let cancelled = false
    setPhase('loading')
    ;(async () => {
      const [outcome, ...decoys] = await Promise.all([
        stitchChain(level.pieces, level.fallbacks),
        ...level.decoys.map(loadImage),
      ])
      if (cancelled) return
      stitchRef.current = outcome
      const pano = renderPanorama(outcome.pieces, { scale: RENDER_SCALE })
      setTargetUrl(pano.toDataURL('image/jpeg', 0.88))

      const all: PieceState[] = [
        ...outcome.pieces.map((p, i) => ({
          id: `P${i}`,
          img: p.img,
          isDecoy: false,
          gain: p.gain,
        })),
        ...decoys.map((img, i) => ({ id: `N${i}`, img, isDecoy: true, gain: 1 })),
      ].map((p) => ({ ...p, placed: false, x: 0, y: 0, rot: spawnTilt(level.maxTilt) }))
      // Shuffle the tray so "first prints in order" is never the answer key.
      for (let i = all.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[all[i], all[j]] = [all[j], all[i]]
      }
      setPieces(all)
      setPhase('reveal')
    })().catch((err) => {
      console.error(err)
    })
    return () => {
      cancelled = true
    }
  }, [level])

  // ---- timer ----
  const startPlaying = () => {
    endTimeRef.current = Date.now() + level.timeLimit * 1000
    setSecondsLeft(level.timeLimit)
    setPhase('playing')
  }

  useEffect(() => {
    if (phase !== 'playing') return
    const tick = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000))
      setSecondsLeft(left)
    }, 200)
    return () => window.clearInterval(tick)
  }, [phase])

  // ---- geometry ----
  const displayScale = () => {
    const board = boardRef.current
    if (!board) return 0.3
    return (board.clientWidth * pieceFraction) / 800
  }

  const boardHeight = () => {
    const maxH = Math.max(0, ...pieces.map((p) => p.img.naturalHeight))
    const rows = level.pieces.length > 2 ? 2.35 : 2.05
    return Math.max(280, maxH * displayScale() * rows)
  }

  const clampToBoard = useCallback(
    (p: PieceState, x: number, y: number) => {
      const board = boardRef.current
      if (!board) return { x, y }
      const s = (board.clientWidth * pieceFraction) / 800
      const w = p.img.naturalWidth * s
      const h = p.img.naturalHeight * s
      return {
        x: Math.min(Math.max(x, 2), board.clientWidth - w - 2),
        y: Math.min(Math.max(y, 2), board.clientHeight - h - 2),
      }
    },
    [pieceFraction],
  )

  const movePiece = useCallback(
    (id: string, x: number, y: number, placed = true) => {
      setPieces((ps) =>
        ps.map((p) => (p.id === id ? { ...p, ...clampToBoard(p, x, y), placed } : p)),
      )
    },
    [clampToBoard],
  )

  const rotatePiece = useCallback((id: string, delta: number) => {
    setPieces((ps) =>
      ps.map((p) =>
        p.id === id
          ? { ...p, rot: Math.min(MAX_ROT, Math.max(-MAX_ROT, p.rot + delta)) }
          : p,
      ),
    )
  }, [])

  const setPieceRot = useCallback((id: string, rot: number) => {
    // Gentle snap at level: the target tilt is always 0.
    const snapped = Math.abs(rot) <= 2 ? 0 : Math.round(rot)
    const clamped = Math.min(MAX_ROT, Math.max(-MAX_ROT, snapped))
    setPieces((ps) => ps.map((p) => (p.id === id ? { ...p, rot: clamped } : p)))
  }, [])

  // ---- drag-to-rotate via the handle knob above the print ----
  const beginRotateDrag = (id: string, e: React.PointerEvent) => {
    if (phase !== 'playing') return
    e.preventDefault()
    e.stopPropagation()
    const rect = boardRef.current!.getBoundingClientRect()
    const piece = piecesRef.current.find((p) => p.id === id)!
    const s = displayScale()
    const cx = rect.left + piece.x + (piece.img.naturalWidth * s) / 2
    const cy = rect.top + piece.y + (piece.img.naturalHeight * s) / 2
    const angleAt = (ev: { clientX: number; clientY: number }) =>
      (Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180) / Math.PI
    const start = angleAt(e)
    const startRot = piece.rot
    setSelectedId(id)

    const onMove = (ev: PointerEvent) => {
      let d = angleAt(ev) - start
      if (d > 180) d -= 360
      if (d < -180) d += 360
      setPieceRot(id, startRot + d)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // ---- dragging (shared by board pieces and tray prints) ----
  const beginDrag = (id: string, e: React.PointerEvent, fromTray: boolean) => {
    if (phase !== 'playing') return
    e.preventDefault()
    const board = boardRef.current!
    const rect = board.getBoundingClientRect()
    const piece = piecesRef.current.find((p) => p.id === id)!
    const s = displayScale()
    const w = piece.img.naturalWidth * s
    const h = piece.img.naturalHeight * s

    if (fromTray) {
      grabOffset.current = { x: w / 2, y: h / 2 }
      movePiece(id, e.clientX - rect.left - w / 2, e.clientY - rect.top - h / 2)
    } else {
      grabOffset.current = { x: e.clientX - rect.left - piece.x, y: e.clientY - rect.top - piece.y }
    }
    setDraggingId(id)
    setSelectedId(id)

    const onMove = (ev: PointerEvent) => {
      const r = board.getBoundingClientRect()
      movePiece(id, ev.clientX - r.left - grabOffset.current.x, ev.clientY - r.top - grabOffset.current.y)
    }
    const onUp = () => {
      setDraggingId(null)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // ---- mouse wheel over the selected print rotates it ----
  useEffect(() => {
    const board = boardRef.current
    if (!board) return
    const onWheel = (e: WheelEvent) => {
      const id = selectedIdRef.current
      if (!id) return
      const el = (e.target as HTMLElement).closest?.('[data-piece-id]')
      if (!el || el.getAttribute('data-piece-id') !== id) return
      e.preventDefault()
      rotatePiece(id, e.deltaY > 0 ? 1 : -1)
    }
    board.addEventListener('wheel', onWheel, { passive: false })
    return () => board.removeEventListener('wheel', onWheel)
  }, [rotatePiece, phase])

  // ---- keyboard nudging + rotation for the selected print (works right after a drag) ----
  useEffect(() => {
    if (phase !== 'playing') return
    const onKey = (e: KeyboardEvent) => {
      const id = selectedIdRef.current
      if (!id) return
      const p = piecesRef.current.find((q) => q.id === id)
      if (!p || !p.placed) return
      const step = e.shiftKey ? 8 : 1
      const d: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      }
      if (d[e.key]) {
        e.preventDefault()
        movePiece(id, p.x + d[e.key][0], p.y + d[e.key][1])
        return
      }
      if (e.key === 'q' || e.key === 'Q' || e.key === 'e' || e.key === 'E') {
        e.preventDefault()
        const rstep = e.shiftKey ? 5 : 1
        rotatePiece(id, e.key.toLowerCase() === 'q' ? -rstep : rstep)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, movePiece, rotatePiece])

  const removeFromBoard = (id: string) => {
    setPieces((ps) => ps.map((p) => (p.id === id ? { ...p, placed: false } : p)))
    setSelectedId(null)
  }

  // ---- scoring ----
  const submit = useCallback(() => {
    if (submittedRef.current) return
    submittedRef.current = true
    const outcome = stitchRef.current!
    const ps = piecesRef.current
    const s = displayScale()

    // Compare print centres (rotation is about the centre, so centres are stable).
    const real = outcome.pieces.map((_, i) => ps.find((p) => p.id === `P${i}`)!)
    let pieceErrors: PieceError[] | null = null
    if (real.every((p) => p.placed)) {
      const centre = (p: PieceState) => ({
        x: (p.x + (p.img.naturalWidth * s) / 2) / s,
        y: (p.y + (p.img.naturalHeight * s) / 2) / s,
      })
      const targetCentre = (i: number) => ({
        x: outcome.pieces[i].x + outcome.pieces[i].img.naturalWidth / 2,
        y: outcome.pieces[i].y + outcome.pieces[i].img.naturalHeight / 2,
      })
      const u0 = centre(real[0])
      const t0 = targetCentre(0)
      pieceErrors = real.map((p, i) => {
        if (i === 0) return { posErrPx: 0, rotErrDeg: p.rot }
        const u = centre(p)
        const t = targetCentre(i)
        return {
          posErrPx: Math.hypot(u.x - u0.x - (t.x - t0.x), u.y - u0.y - (t.y - t0.y)),
          rotErrDeg: p.rot,
        }
      })
    }
    const decoysPlaced = ps.filter((p) => p.isDecoy && p.placed).length
    const result = scoreAttempt({ pieceErrors, decoysPlaced })

    const placed = ps.filter((p) => p.placed)
    let userUrl: string | null = null
    if (placed.length > 0) {
      const minX = Math.min(...placed.map((p) => p.x))
      const minY = Math.min(...placed.map((p) => p.y))
      const canvas = renderPanorama(
        placed.map((p) => ({
          img: p.img,
          x: (p.x - minX) / s,
          y: (p.y - minY) / s,
          gain: p.gain,
          rot: p.rot,
        })),
        { scale: RENDER_SCALE },
      )
      userUrl = canvas.toDataURL('image/jpeg', 0.88)
    }

    onFinish({
      result,
      targetUrl: targetUrl!,
      userUrl,
      secondsUsed: Math.min(level.timeLimit, level.timeLimit - secondsLeft),
      usedFallback: outcome.usedFallback,
      inliers: outcome.inliers,
      totalMatches: outcome.totalMatches,
    })
  }, [onFinish, targetUrl, secondsLeft, level.timeLimit])

  useEffect(() => {
    if (phase === 'playing' && secondsLeft === 0) submit()
  }, [phase, secondsLeft, submit])

  // ---- render ----
  const s = displayScale()
  const trayPieces = pieces.filter((p) => !p.placed)
  const boardPieces = pieces.filter((p) => p.placed)
  const crooked = level.maxTilt > 0

  return (
    <div className="screen play-screen">
      <div className="hud">
        <div className="panel hud-title">
          <span className="caption-strip">{levelActLabel(level.act)}</span>
          <h1>{level.title}</h1>
        </div>
        <div className="panel hud-target">
          <span className="caption-strip">the system's answer</span>
          {targetUrl && <img src={targetUrl} alt="Target panorama stitched by the algorithm" />}
        </div>
        <div className="hud-right">
          <div className={`timer${secondsLeft <= 10 && phase === 'playing' ? ' timer--urgent' : ''}`}>
            {secondsLeft}s
          </div>
          <div className="play-actions">
            <button className="btn" onClick={submit} disabled={phase !== 'playing'}>
              Stitch it!
            </button>
            <button className="btn btn--quiet" onClick={onQuit}>
              Give up
            </button>
          </div>
        </div>
      </div>

      <div className="board-wrap">
        <div
          ref={boardRef}
          className="board"
          style={{ height: boardHeight() }}
          onPointerDown={(e) => {
            if (e.target === boardRef.current) setSelectedId(null)
          }}
        >
          {boardPieces.map((p) => (
            <div
              key={p.id}
              role="button"
              tabIndex={0}
              data-piece-id={p.id}
              aria-label={`Photo print ${p.id}`}
              className={`piece${draggingId === p.id ? ' piece--dragging' : ''}${
                selectedId === p.id ? ' piece--selected' : ''
              }`}
              style={{
                left: p.x,
                top: p.y,
                width: p.img.naturalWidth * s,
                height: p.img.naturalHeight * s,
                transform: p.rot !== 0 ? `rotate(${p.rot}deg)` : undefined,
                zIndex: draggingId === p.id ? 30 : selectedId === p.id ? 20 : 10,
                opacity: draggingId === p.id ? 0.82 : selectedId === p.id ? 0.94 : 1,
              }}
              onPointerDown={(e) => beginDrag(p.id, e, false)}
            >
              {selectedId === p.id && (
                <>
                  <button
                    className="piece-remove"
                    aria-label="Return print to tray"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => removeFromBoard(p.id)}
                  >
                    ×
                  </button>
                  <RotateButton dir={-1} pieceId={p.id} rotatePiece={rotatePiece} />
                  <RotateButton dir={1} pieceId={p.id} rotatePiece={rotatePiece} />
                  <div
                    className="piece-handle"
                    role="slider"
                    aria-label="Drag to rotate print"
                    aria-valuenow={p.rot}
                    aria-valuemin={-MAX_ROT}
                    aria-valuemax={MAX_ROT}
                    onPointerDown={(e) => beginRotateDrag(p.id, e)}
                  />
                  <span className="piece-angle">{p.rot > 0 ? `+${p.rot}` : p.rot}°</span>
                </>
              )}
              <img src={p.img.src} alt="" draggable={false} />
            </div>
          ))}
        </div>
      </div>

      <div className="panel tray">
        <span className="tray-label">tray</span>
        {trayPieces.map((p) => (
          <button
            key={p.id}
            className="tray-piece"
            aria-label="Drag print onto the board"
            style={p.rot !== 0 ? { transform: `rotate(${p.rot}deg)` } : undefined}
            onPointerDown={(e) => beginDrag(p.id, e, true)}
          >
            <img src={p.img.src} alt="" draggable={false} />
          </button>
        ))}
        {trayPieces.length === 0 && <span className="tray-empty">every print is on the board</span>}
        <span className="play-hint" style={{ marginLeft: 'auto' }}>
          drag prints · arrow keys nudge (shift = ×8) · grab the knob to rotate (⟲⟳, Q/E or
          scroll work too) · × returns it
        </span>
      </div>

      {phase === 'loading' && (
        <div className="overlay">
          <div className="loading-stitch">
            EXTRACTING FEATURES… RUNNING RANSAC…
            <hr className="thread" />
          </div>
        </div>
      )}

      {phase === 'reveal' && targetUrl && (
        <div className="overlay">
          <div className="reveal-panel">
            <span className="caption-strip">the system stitched this</span>
            <h2>Memorize the seam.</h2>
            <img src={targetUrl} alt="Target panorama" />
            <TelemetryLine />
            {crooked && (
              <p className="telemetry">
                warning: the prints came back from the lab crooked — straighten them before you seam
              </p>
            )}
            <button className="btn" onClick={startPlaying}>
              Thread the needle — {level.timeLimit}s →
            </button>
          </div>
        </div>
      )}
    </div>
  )

  function TelemetryLine() {
    const o = stitchRef.current
    if (!o) return null
    const plural = o.linkCount > 1 ? 's' : ''
    return (
      <p className="telemetry">
        {o.linksVerified === 0
          ? 'verification below threshold — using archived registration'
          : o.usedFallback
            ? `${o.linksVerified}/${o.linkCount} seams verified live (${o.inliers}/${o.totalMatches} inliers) · archived registration for the rest`
            : `match verified: ${o.inliers}/${o.totalMatches} RANSAC inliers across ${o.linkCount} seam${plural}`}
      </p>
    )
  }
}

/** Hold-to-repeat rotation button (⟲ / ⟳). */
function RotateButton({
  dir,
  pieceId,
  rotatePiece,
}: {
  dir: -1 | 1
  pieceId: string
  rotatePiece: (id: string, delta: number) => void
}) {
  const timer = useRef(0)
  const stop = () => {
    window.clearInterval(timer.current)
  }
  useEffect(() => stop, [])
  return (
    <button
      className={`piece-rotate piece-rotate--${dir === -1 ? 'ccw' : 'cw'}`}
      aria-label={dir === -1 ? 'Rotate counter-clockwise' : 'Rotate clockwise'}
      onPointerDown={(e) => {
        e.stopPropagation()
        e.preventDefault()
        // Capture the pointer: the button rotates along with the print, so
        // without capture it slides out from under the cursor and the hold dies.
        e.currentTarget.setPointerCapture(e.pointerId)
        rotatePiece(pieceId, dir)
        stop()
        let ticks = 0
        timer.current = window.setInterval(() => {
          ticks++
          rotatePiece(pieceId, dir * (ticks > 8 ? 3 : 1))
        }, 70)
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
    >
      {dir === -1 ? '⟲' : '⟳'}
    </button>
  )
}

function levelActLabel(act: 1 | 2 | 3 | 4): string {
  return act === 1
    ? 'act i · warm-up reels'
    : act === 2
      ? 'act ii · the messy darkroom'
      : act === 3
        ? 'act iii · wide sweeps'
        : 'act iv · master cuts'
}
