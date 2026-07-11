/**
 * Level definitions. Every level is one connected component from the
 * Brown–Lowe panorama dataset: two to four photos that genuinely overlap,
 * in left-to-right chain order. Decoys are "noise images" from other
 * components — the paper's algorithm rejects them via the eq. 13
 * verification test, and so must the player.
 *
 * `fallbacks[i]` is the offset of piece i+1 relative to piece i in source
 * pixels (800px-wide assets), precomputed with exhaustive NCC alignment
 * offline. It is only used if the in-browser run fails verification.
 *
 * `maxTilt` > 0 means the prints spawn crooked by up to that many degrees
 * and must be straightened by hand. The mechanics (tilt, noise, multi-print
 * chains) are deliberately mixed within each act — the acts ramp difficulty,
 * not one mechanic each.
 */
export interface LevelDef {
  id: string
  act: 1 | 2 | 3 | 4
  title: string
  blurb: string
  /** Genuinely overlapping prints, in panorama order. */
  pieces: string[]
  decoys: string[]
  /** Max spawn tilt in degrees; 0 = prints arrive square. */
  maxTilt: number
  /** Offset of pieces[i+1] relative to pieces[i], source px. */
  fallbacks: { dx: number; dy: number }[]
  /** Seconds on the clock. */
  timeLimit: number
}

const asset = (name: string) => `${import.meta.env.BASE_URL}dataset/${name}.jpg`

export const LEVELS: LevelDef[] = [
  // ---- Act I — warm-up: each trick introduced gently, one at a time ----
  {
    id: 'torpedo',
    act: 1,
    title: 'The Torpedo Monument',
    blurb: 'A gentle first seam — the two frames share most of their view.',
    pieces: [asset('11080085_l'), asset('11080086_r')],
    decoys: [],
    maxTilt: 0,
    fallbacks: [{ dx: 112, dy: -8 }],
    timeLimit: 60,
  },
  {
    id: 'fountain',
    act: 1,
    title: 'Fountain Plaza',
    blurb: 'The lab returned these prints crooked. Straighten them, then line up the cairn.',
    pieces: [asset('11070009_l'), asset('11070010_l')],
    decoys: [],
    maxTilt: 8,
    fallbacks: [{ dx: 176, dy: -28 }],
    timeLimit: 60,
  },
  {
    id: 'lodge',
    act: 1,
    title: 'Sunset Lodge',
    blurb: 'Three prints in the tray, but one is an indoor library. Leave the noise out.',
    pieces: [asset('11090021_l'), asset('11090022_l')],
    decoys: [asset('21130060_l')],
    maxTilt: 0,
    fallbacks: [{ dx: 218, dy: -4 }],
    timeLimit: 60,
  },
  {
    id: 'tumblers',
    act: 1,
    title: 'Bronze Tumblers',
    blurb: 'Crooked prints and an impostor park in the same tray. Everything at once.',
    pieces: [asset('11090038_l'), asset('11090039_r')],
    decoys: [asset('DSCF2437_l')],
    maxTilt: 10,
    fallbacks: [{ dx: 134, dy: 34 }],
    timeLimit: 60,
  },

  // ---- Act II — the messy darkroom: tilts and noise, mixed ----
  {
    id: 'village',
    act: 2,
    title: 'Village Corner',
    blurb: 'Three photos in the pile. One of them belongs to another roll of film…',
    pieces: [asset('11090001_l'), asset('11090002_r')],
    decoys: [asset('11090021_l')],
    maxTilt: 0,
    fallbacks: [{ dx: 184, dy: 6 }],
    timeLimit: 60,
  },
  {
    id: 'hatcart',
    act: 2,
    title: 'The Hat Cart',
    blurb: 'Badly crooked prints — straighten the shopfront before you seam it.',
    pieces: [asset('11080007_l'), asset('11080008_l')],
    decoys: [],
    maxTilt: 12,
    fallbacks: [{ dx: 232, dy: 6 }],
    timeLimit: 60,
  },
  {
    id: 'mansion',
    act: 2,
    title: 'The Mansion Lawn',
    blurb: 'Tilted prints of a grand house — and one print from a different park.',
    pieces: [asset('11100094_l'), asset('11100095_l')],
    decoys: [asset('DSCF2549_l')],
    maxTilt: 10,
    fallbacks: [{ dx: 262, dy: -12 }],
    timeLimit: 60,
  },
  {
    id: 'musicroom',
    act: 2,
    title: 'The Music Room',
    blurb: 'A harp, a sofa, and a suspiciously similar library. Reject the noise!',
    pieces: [asset('11130065_l'), asset('11130066_l')],
    decoys: [asset('21130059_l')],
    maxTilt: 0,
    fallbacks: [{ dx: 234, dy: 20 }],
    timeLimit: 60,
  },
  {
    id: 'rosegarden',
    act: 2,
    title: 'Gold Medal Roses',
    blurb: 'Every photo is roses, every print is crooked. Only two of them overlap.',
    pieces: [asset('11080016_l'), asset('11080017_l')],
    decoys: [asset('11080018_l')],
    maxTilt: 12,
    fallbacks: [{ dx: 308, dy: 6 }],
    timeLimit: 75,
  },

  // ---- Act III — wide sweeps: the first three-print seam, harder trays ----
  {
    id: 'teapots',
    act: 3,
    title: 'The Teapot Shelves',
    blurb: 'Crooked prints, crowded shelves, and a stately library that doesn’t belong.',
    pieces: [asset('11080011_l'), asset('11080012_l')],
    decoys: [asset('21130060_l')],
    maxTilt: 12,
    fallbacks: [{ dx: 268, dy: -2 }],
    timeLimit: 75,
  },
  {
    id: 'plaza3',
    act: 3,
    title: 'Plaza Sweep',
    blurb: 'Three prints, one sweep of the square — plus the same cairn shot from the wrong corner.',
    pieces: [asset('11070011_l'), asset('11070012_l'), asset('11070009_l')],
    decoys: [asset('11070024_l')],
    maxTilt: 8,
    fallbacks: [
      { dx: 172, dy: 0 },
      { dx: 428, dy: 148 },
    ],
    timeLimit: 90,
  },
  {
    id: 'gazebo',
    act: 3,
    title: 'Gazebo in the Roses',
    blurb: 'Same garden, same roses — but only two frames share the gazebo.',
    pieces: [asset('11080018_l'), asset('11080019_l')],
    decoys: [asset('11080016_l')],
    maxTilt: 12,
    fallbacks: [{ dx: 270, dy: 26 }],
    timeLimit: 75,
  },
  {
    id: 'sunroom',
    act: 3,
    title: 'The Sunroom',
    blurb: 'Wicker chairs, a narrow seam, and two noise images lurking in the tray.',
    pieces: [asset('11130107_l'), asset('11130108_r')],
    decoys: [asset('21130059_l'), asset('11130065_l')],
    maxTilt: 14,
    fallbacks: [{ dx: 442, dy: 24 }],
    timeLimit: 75,
  },

  // ---- Act IV — master cuts: slivers, impostors, and the four-print finale ----
  {
    id: 'koin',
    act: 4,
    title: 'KOIN Center Plaza',
    blurb: 'Umbrellas and pansies everywhere — including on the prints that don’t fit.',
    pieces: [asset('DSCF2460_l'), asset('DSCF2461_l')],
    decoys: [asset('ESCF2457_l'), asset('DSCF2548_l')],
    maxTilt: 15,
    fallbacks: [{ dx: 300, dy: -30 }],
    timeLimit: 75,
  },
  {
    id: 'blossoms',
    act: 4,
    title: 'Cherry Blossom Walk',
    blurb: 'A sliver of overlap, two impostor parks, and everything askew.',
    pieces: [asset('DSCF2427_l'), asset('DSCF2428_l')],
    decoys: [asset('DSCF2436_l'), asset('DSCF2437_l')],
    maxTilt: 14,
    fallbacks: [{ dx: 568, dy: 14 }],
    timeLimit: 75,
  },
  {
    id: 'monument',
    act: 4,
    title: 'The Park Monument',
    blurb: 'Dense foliage on every side. The column is your only anchor.',
    pieces: [asset('DSCF2548_l'), asset('DSCF2549_l')],
    decoys: [asset('DSCF2437_l'), asset('DSCF2461_l')],
    maxTilt: 15,
    fallbacks: [{ dx: 212, dy: -10 }],
    timeLimit: 75,
  },
  {
    id: 'plaza4',
    act: 4,
    title: 'The Full Sweep',
    blurb: 'The final panorama: four crooked prints and two impostors of the very same plaza.',
    pieces: [
      asset('11070011_l'),
      asset('11070012_l'),
      asset('11070009_l'),
      asset('11070010_l'),
    ],
    decoys: [asset('11070024_l'), asset('11070025_l')],
    maxTilt: 12,
    fallbacks: [
      { dx: 172, dy: 0 },
      { dx: 428, dy: 148 },
      { dx: 176, dy: -28 },
    ],
    timeLimit: 90,
  },
]

export const ACT_NAMES: Record<1 | 2 | 3 | 4, string> = {
  1: 'Act I — Warm-Up Reels',
  2: 'Act II — The Messy Darkroom',
  3: 'Act III — Wide Sweeps',
  4: 'Act IV — Master Cuts',
}
