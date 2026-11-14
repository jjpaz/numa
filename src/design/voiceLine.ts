// Shared drawing helpers for Numa's voice line (see DESIGN.md → "The voice line").
// Pure functions, no React. Everything is in CSS pixels: 1 SVG unit = 1px.

export type Pt = [number, number];

/** Seeded PRNG so every drawing is identical on every load. */
export function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a: a stable 32-bit number from a string (e.g. an entry id). */
export function hashString(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++)
    h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

export const r1 = (n: number) => Math.round(n * 10) / 10;

/** Catmull-Rom through the points, emitted as cubic béziers: smooth, no corners. */
export function catmullRom(points: Pt[]) {
  let d = "";
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i],
      p1 = points[i],
      p2 = points[i + 1],
      p3 = points[i + 2] ?? p2;
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${r1(c1[0])} ${r1(c1[1])} ${r1(c2[0])} ${r1(c2[1])} ${r1(p2[0])} ${r1(p2[1])}`;
  }
  return d;
}

export type Cubic = [Pt, Pt, Pt, Pt];
export function cubicAt(p: Cubic, t: number): Pt {
  const u = 1 - t;
  const k = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  return [
    k[0] * p[0][0] + k[1] * p[1][0] + k[2] * p[2][0] + k[3] * p[3][0],
    k[0] * p[0][1] + k[1] * p[1][1] + k[2] * p[2][1] + k[3] * p[3][1],
  ];
}
export const sampleCubic = (p: Cubic, n = 48) =>
  Array.from({ length: n + 1 }, (_, i) => cubicAt(p, i / n));
export const lengthOf = (pts: Pt[]) =>
  pts.reduce(
    (sum, pt, i) =>
      i ? sum + Math.hypot(pt[0] - pts[i - 1][0], pt[1] - pts[i - 1][1]) : 0,
    0,
  );
/** The " C…" segment for a cubic that continues the current path. */
export const cubicD = (p: Cubic) =>
  ` C${p
    .slice(1)
    .map(([x, y]) => `${r1(x)} ${r1(y)}`)
    .join(" ")}`;

/** Sum of Gaussian bursts, capped at 1. */
export function gaussianEnvelope(
  bursts: { c: number; s: number; w: number }[],
  at: number,
) {
  let env = 0;
  for (const b of bursts) env += b.w * Math.exp(-0.5 * ((at - b.c) / b.s) ** 2);
  return Math.min(1, env);
}

export interface WaveOptions {
  /** Right end of the wave (it always starts at x = 0). */
  to: number;
  axis: number;
  /** Peak amplitude in px. */
  amp: number;
  wavelength: number;
  /** 0..1 loudness at x: Gaussian bursts for speech, ~0 for pauses. */
  envelope: (x: number) => number;
  rand: () => number;
  /** Optional reshaping of the upward lift at x (e.g. stay clear of text). */
  limitLift?: (x: number, lift: number) => number;
  /** Settle to the axis over the last two wavelengths (default true). */
  settle?: boolean;
  /** Close the wave with a point on the axis at `to` (default true). A live
   *  recording sets it false so the line ends exactly where the voice is. */
  endOnAxis?: boolean;
}

/**
 * A smooth voice waveform: a carrier with gentle frequency drift, a fresh
 * amplitude every half cycle (it changes at zero crossings, so the curve stays
 * continuous) and the given envelope. Pauses keep only a micro-undulation.
 * Returns the points; pass them to catmullRom() for the path.
 */
export function voiceWave(o: WaveOptions): Pt[] {
  const { to, axis, amp, wavelength, envelope, rand, limitLift } = o;
  const step = wavelength / 6;
  const halfAmps = Array.from(
    { length: Math.ceil((to / wavelength) * 2) + 4 },
    () => 0.45 + 0.55 * rand(),
  );
  const liftAt = (x: number) => {
    const env = envelope(x);
    const drift =
      x + wavelength * 0.12 * Math.sin((2 * Math.PI * x) / (wavelength * 11));
    const half = Math.floor(drift / (wavelength / 2));
    const carrier = Math.sin((2 * Math.PI * drift) / wavelength);
    const breath = 0.6 * Math.sin((2 * Math.PI * x) / (wavelength * 7)); // micro-undulation
    const fade =
      o.settle === false ? 1 : Math.min(1, (to - x) / (wavelength * 2));
    const lift = (amp * env * halfAmps[half] * carrier + breath) * fade; // + is upwards
    return limitLift ? limitLift(x, lift) : lift;
  };
  const wave: Pt[] = [];
  let last = 0;
  for (let x = 0; x <= to; x += step) {
    wave.push([x, axis - liftAt(x)]);
    last = x;
  }
  if (o.endOnAxis === false) {
    if (to - last > 0.01) wave.push([to, axis - liftAt(to)]);
  } else wave.push([to, axis]);
  return wave;
}
