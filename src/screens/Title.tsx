export default function Title({ onStart }: { onStart: () => void }) {
  return (
    <div className="screen title-screen">
      <div>
        <span className="caption-strip">a panorama puzzle in four acts</span>
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
            You get the loose prints — up to <strong>four per panorama</strong>. Drag them onto the
            board and overlap them to rebuild the very same seam before the clock runs out.
          </p>
        </div>
        <div className="panel howto-panel">
          <span className="caption-strip">panel 3</span>
          <h3>Straighten &amp; reject</h3>
          <p>
            Later trays hide <strong>crooked prints</strong> (straighten them with Q/E or the scroll
            wheel) and photos from a <strong>different scene</strong> — leave those in the tray.
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
