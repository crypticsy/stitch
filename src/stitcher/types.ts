/** A grayscale image as float32 [0,1], row-major. */
export interface GrayImage {
  data: Float32Array
  width: number
  height: number
}

export interface Point {
  x: number
  y: number
}

/** A feature match: point in image A ↔ point in image B. */
export interface Match {
  a: Point
  b: Point
}

export interface AlignResult {
  /** Offset of image B's top-left relative to image A's top-left, in source pixels. */
  dx: number
  dy: number
  inliers: number
  totalMatches: number
  /** Brown–Lowe eq. 13 verification: n_i > alpha + beta * n_f */
  verified: boolean
}
