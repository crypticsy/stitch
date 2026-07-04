import { useCallback, useEffect, useRef, useState } from 'react'
import type { LevelDef } from '../game/levels'
import { TIME_LIMIT } from '../game/levels'
import { scoreAttempt } from '../game/scoring'
import { loadImage } from '../stitcher/image'
import { renderPanorama, stitchPair } from '../stitcher/stitch'
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
}

type Phase = 'loading' | 'reveal' | 'playing'

/** Fraction of the board width a single print occupies. */
const PIECE_FRACTION = 0.42
const RENDER_SCALE = 0.55

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
  const [secondsLeft, setSecondsLeft] = useState(TIME_LIMIT)
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

  // ---- level setup: run the paper's pipeline on the real pair, load decoys ----
  useEffect(() => {
    let cancelled = false
    setPhase('loading')
    ;(async () => {
      const [outcome, ...decoys] = await Promise.all([
        stitchPair(level.pieceA, level.pieceB, level.fallback),
        ...level.decoys.map(loadImage),
      ])
      if (cancelled) return
      stitchRef.current = outcome
      const pano = renderPanorama(outcome.pieces, { scale: RENDER_SCALE })
      setTargetUrl(pano.toDataURL('image/jpeg', 0.88))

      const all: PieceState[] = [
        { id: 'A', img: outcome.pieces[0].img, isDecoy: false, gain: outcome.pieces[0].gain },
        { id: 'B', img: outcome.pieces[1].img, isDecoy: false, gain: outcome.pieces[1].gain },
        ...decoys.map((img, i) => ({ id: `N${i}`, img, isDecoy: true, gain: 1 })),
      ].map((p) => ({ ...p, placed: false, x: 0, y: 0 }))
      // Shuffle the tray so "first two prints" is never the answer key.
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
    endTimeRef.current = Date.now() + TIME_LIMIT * 1000
    setSecondsLeft(TIME_LIMIT)
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
    return (board.clientWidth * PIECE_FRACTION) / 800
  }

  const boardHeight = () => {
    const maxH = Math.max(0, ...pieces.map((p) => p.img.naturalHeight))
    return Math.max(280, maxH * displayScale() * 2.05)
  }

  const clampToBoard = useCallback((p: PieceState, x: number, y: number) => {
    const board = boardRef.current
    if (!board) return { x, y }
    const s = (board.clientWidth * PIECE_FRACTION) / 800
    const w = p.img.naturalWidth * s
    const h = p.img.naturalHeight * s
    return {
      x: Math.min(Math.max(x, 2), board.clientWidth - w - 2),
      y: Math.min(Math.max(y, 2), board.clientHeight - h - 2),
    }
  }, [])

  const movePiece = useCallback(
    (id: string, x: number, y: number, placed = true) => {
      setPieces((ps) =>
        ps.map((p) => (p.id === id ? { ...p, ...clampToBoard(p, x, y), placed } : p)),
      )
    },
    [clampToBoard],
  )

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

  // ---- keyboard nudging for precision (and accessibility) ----
  const nudge = (id: string, e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 8 : 1
    const p = piecesRef.current.find((q) => q.id === id)
    if (!p || !p.placed) return
    const d: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }
    if (d[e.key]) {
      e.preventDefault()
      movePiece(id, p.x + d[e.key][0], p.y + d[e.key][1])
    }
  }

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

    const a = ps.find((p) => p.id === 'A')!
    const b = ps.find((p) => p.id === 'B')!
    const userOffset =
      a.placed && b.placed ? { dx: (b.x - a.x) / s, dy: (b.y - a.y) / s } : null
    const targetOffset = {
      dx: outcome.pieces[1].x - outcome.pieces[0].x,
      dy: outcome.pieces[1].y - outcome.pieces[0].y,
    }
    const decoysPlaced = ps.filter((p) => p.isDecoy && p.placed).length
    const result = scoreAttempt({ userOffset, targetOffset, decoysPlaced })

    const placed = ps.filter((p) => p.placed)
    let userUrl: string | null = null
    if (placed.length > 0) {
      const minX = Math.min(...placed.map((p) => p.x))
      const minY = Math.min(...placed.map((p) => p.y))
      const canvas = renderPanorama(
        placed.map((p) => ({ img: p.img, x: (p.x - minX) / s, y: (p.y - minY) / s, gain: p.gain })),
        { scale: RENDER_SCALE },
      )
      userUrl = canvas.toDataURL('image/jpeg', 0.88)
    }

    onFinish({
      result,
      targetUrl: targetUrl!,
      userUrl,
      secondsUsed: Math.min(TIME_LIMIT, TIME_LIMIT - secondsLeft),
      usedFallback: outcome.usedFallback,
      inliers: outcome.align.inliers,
      totalMatches: outcome.align.totalMatches,
    })
  }, [onFinish, targetUrl, secondsLeft])

  useEffect(() => {
    if (phase === 'playing' && secondsLeft === 0) submit()
  }, [phase, secondsLeft, submit])

  // ---- render ----
  const s = displayScale()
  const trayPieces = pieces.filter((p) => !p.placed)
  const boardPieces = pieces.filter((p) => p.placed)

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
              aria-label={`Photo print ${p.id}`}
              className={`piece${draggingId === p.id ? ' piece--dragging' : ''}${
                selectedId === p.id ? ' piece--selected' : ''
              }`}
              style={{
                left: p.x,
                top: p.y,
                width: p.img.naturalWidth * s,
                height: p.img.naturalHeight * s,
                zIndex: draggingId === p.id ? 30 : selectedId === p.id ? 20 : 10,
                opacity: draggingId === p.id ? 0.82 : selectedId === p.id ? 0.94 : 1,
              }}
              onPointerDown={(e) => beginDrag(p.id, e, false)}
              onKeyDown={(e) => nudge(p.id, e)}
            >
              {selectedId === p.id && (
                <button
                  className="piece-remove"
                  aria-label="Return print to tray"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => removeFromBoard(p.id)}
                >
                  ×
                </button>
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
            onPointerDown={(e) => beginDrag(p.id, e, true)}
          >
            <img src={p.img.src} alt="" draggable={false} />
          </button>
        ))}
        {trayPieces.length === 0 && <span className="tray-empty">every print is on the board</span>}
        <span className="play-hint" style={{ marginLeft: 'auto' }}>
          drag prints · click a print then arrow keys to nudge (shift = ×8) · × returns it
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
            <button className="btn" onClick={startPlaying}>
              Thread the needle — {TIME_LIMIT}s →
            </button>
          </div>
        </div>
      )}
    </div>
  )

  function TelemetryLine() {
    const o = stitchRef.current
    if (!o) return null
    return (
      <p className="telemetry">
        {o.usedFallback
          ? 'verification below threshold — using archived registration'
          : `match verified: ${o.align.inliers}/${o.align.totalMatches} RANSAC inliers · Δx ${Math.round(
              o.align.dx,
            )}px · Δy ${Math.round(o.align.dy)}px`}
      </p>
    )
  }
}

function levelActLabel(act: 1 | 2 | 3): string {
  return act === 1 ? 'act i · warm-up' : act === 2 ? 'act ii · spot the noise' : 'act iii · master cut'
}
