export default function Title({ onStart }: { onStart: () => void }) {
  return (
    <div className="screen title-screen">
      <div>
        <span className="caption-strip">a panorama puzzle in three acts</span>
        <div className="logo" aria-label="STITCH">
          {'STITCH'.split('').map((ch, i) => (
            <span key={i} className="logo-letter" style={{ animationDelay: `${i * 70}ms` }} aria-hidden="true">
              {ch}
            </span>
          ))}
        </div>
        <p className="tagline">
          The machine stitched a panorama from loose photographs.{' '}
          <strong>Can your hands beat its algorithm?</strong>
        </p>
      </div>

      <div className="howto">
        <div className="panel howto-panel">
          <span className="caption-strip">panel 1</span>
          <h3>Study the seam</h3>
          <p>
            The system fuses overlapping photos into one panorama — invariant features, RANSAC and
            blended seams — and shows you <strong>its answer</strong>.
          </p>
        </div>
        <div className="panel howto-panel">
          <span className="caption-strip">panel 2</span>
          <h3>Stitch by hand</h3>
          <p>
            You get the loose prints. Drag them onto the board and overlap them to rebuild the very
            same panorama — in <strong>60 seconds</strong>.
          </p>
        </div>
        <div className="panel howto-panel">
          <span className="caption-strip">panel 3</span>
          <h3>Reject the noise</h3>
          <p>
            Later trays hide photos from a <strong>different scene</strong>. The algorithm rejects
            noise images. So should you — leave them in the tray.
          </p>
        </div>
      </div>

      <button className="btn" onClick={onStart}>
        Open the contact sheet →
      </button>

      <p className="paper-credit">
        Stitching per M. Brown &amp; D. G. Lowe, “Automatic Panoramic Image Stitching using
        Invariant Features” — interest points, ratio-test matching, RANSAC + verification, gain
        compensation, weighted blending. Recomputed live in your browser for every level.
      </p>
    </div>
  )
}
