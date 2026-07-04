/**
 * Level definitions. Every level is one connected component from the
 * Brown–Lowe panorama dataset: two photos that genuinely overlap. Decoys are
 * "noise images" from other components — the paper's algorithm rejects them
 * via the eq. 13 verification test, and so must the player.
 *
 * `fallback` is the offset of piece B relative to piece A in source pixels
 * (800px-wide assets), precomputed with the same algorithm offline. It is
 * only used if the in-browser run fails verification.
 */
export interface LevelDef {
  id: string
  act: 1 | 2 | 3
  title: string
  blurb: string
  pieceA: string
  pieceB: string
  decoys: string[]
  fallback: { dx: number; dy: number }
}

const asset = (name: string) => `${import.meta.env.BASE_URL}dataset/${name}.jpg`

export const LEVELS: LevelDef[] = [
  {
    id: 'torpedo',
    act: 1,
    title: 'The Torpedo Monument',
    blurb: 'A gentle first seam — the two frames share most of their view.',
    pieceA: asset('11080085_l'),
    pieceB: asset('11080086_r'),
    decoys: [],
    fallback: { dx: 112, dy: -8 },
  },
  {
    id: 'fountain',
    act: 1,
    title: 'Fountain Plaza',
    blurb: 'Line up the cairn of stones and the lamp posts.',
    pieceA: asset('11070009_l'),
    pieceB: asset('11070010_l'),
    decoys: [],
    fallback: { dx: 150, dy: -28 },
  },
  {
    id: 'tumblers',
    act: 1,
    title: 'Bronze Tumblers',
    blurb: 'Watch the sculpture — and mind the vertical drift.',
    pieceA: asset('11090038_l'),
    pieceB: asset('11090039_r'),
    decoys: [],
    fallback: { dx: 134, dy: 34 },
  },
  {
    id: 'village',
    act: 2,
    title: 'Village Corner',
    blurb: 'Three photos in the pile. One of them belongs to another roll of film…',
    pieceA: asset('11090001_l'),
    pieceB: asset('11090002_r'),
    decoys: [asset('11090021_l')],
    fallback: { dx: 184, dy: 6 },
  },
  {
    id: 'musicroom',
    act: 2,
    title: 'The Music Room',
    blurb: 'A harp, a sofa, and a suspiciously similar library. Reject the noise!',
    pieceA: asset('11130065_l'),
    pieceB: asset('11130066_l'),
    decoys: [asset('21130059_l')],
    fallback: { dx: 234, dy: 20 },
  },
  {
    id: 'rosegarden',
    act: 2,
    title: 'Gold Medal Roses',
    blurb: 'Every photo is roses. Only two of them actually overlap.',
    pieceA: asset('11080016_l'),
    pieceB: asset('11080017_l'),
    decoys: [asset('11080018_l')],
    fallback: { dx: 308, dy: 6 },
  },
  {
    id: 'blossoms',
    act: 3,
    title: 'Cherry Blossom Walk',
    blurb: 'A sliver of overlap and two impostors. Master-tailor territory.',
    pieceA: asset('DSCF2427_l'),
    pieceB: asset('DSCF2428_l'),
    decoys: [asset('DSCF2436_l'), asset('DSCF2548_l')],
    fallback: { dx: 568, dy: 14 },
  },
  {
    id: 'sunroom',
    act: 3,
    title: 'The Sunroom',
    blurb: 'Wicker chairs and a narrow seam. Two noise images lurk in the tray.',
    pieceA: asset('11130107_l'),
    pieceB: asset('11130108_r'),
    decoys: [asset('21130059_l'), asset('11130065_l')],
    fallback: { dx: 442, dy: 24 },
  },
  {
    id: 'portland',
    act: 3,
    title: 'Downtown Portland',
    blurb: 'The final panorama. Rails, wires and rooftops must all line up.',
    pieceA: asset('11040035_l'),
    pieceB: asset('11040036_r'),
    decoys: [asset('DSCF2548_l'), asset('11070024_l')],
    fallback: { dx: 288, dy: -24 },
  },
]

export const ACT_NAMES: Record<1 | 2 | 3, string> = {
  1: 'Act I — Warm-Up Reels',
  2: 'Act II — Spot the Noise',
  3: 'Act III — Master Cuts',
}

export const TIME_LIMIT = 60
