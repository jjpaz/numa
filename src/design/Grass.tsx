// Grass: blades drawn as filled shapes in three greens, plus the dark soil
// they grow from (DESIGN.md → "The new garden"). Wild and uneven, never
// symmetric, and fully deterministic: every blade comes from a hash of its own
// index, so the same width always draws the same grass and a wider screen only
// adds blades at the edges.
import { useLayoutEffect, useRef, useState } from "react";
import { r1 } from "./voiceLine";

/** A stable 0..1 number for (seed, layer, index). */
function rnd(seed: number, layer: number, i: number) {
  let h = Math.imul(seed ^ Math.imul(i + 1, 374761393), 2246822519);
  h ^= Math.imul(layer + 7, 668265263);
  h ^= h >>> 13;
  h = Math.imul(h, 3266489917);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Slow swells along the strip, so the grass grows in clumps and hollows. */
function clump(seed: number, x: number) {
  const p1 = (seed % 997) / 97,
    p2 = (seed % 613) / 61;
  return 0.62 + 0.24 * Math.sin(x / 83 + p1) + 0.14 * Math.sin(x / 31 + p2);
}

/** One tapering, slightly curved blade from (x, base) to its tip. */
function blade(x: number, base: number, h: number, w: number, lean: number) {
  const l = x - w / 2,
    r = x + w / 2,
    tx = x + lean,
    ty = base - h;
  return (
    `M${r1(l)} ${r1(base)}` +
    `C${r1(l + lean * 0.05)} ${r1(base - h * 0.45)} ${r1(tx - w * 0.18 - lean * 0.25)} ${r1(base - h * 0.84)} ${r1(tx)} ${r1(ty)}` +
    `C${r1(tx + w * 0.16 - lean * 0.3)} ${r1(base - h * 0.78)} ${r1(r + lean * 0.06)} ${r1(base - h * 0.4)} ${r1(r)} ${r1(base)}Z`
  );
}

export interface GrassLayer {
  /** Average distance between blades, px. */
  spacing: number;
  /** Blade height as a fraction of the grass height: [min, max]. */
  tall: [number, number];
  /** Blade width at its base, px: [min, max]. */
  wide: [number, number];
  fill: string;
}

/** Back to front: light, middle, dark. The soil comes last. */
export const GRASS_LAYERS: GrassLayer[] = [
  { spacing: 9, tall: [0.5, 1], wide: [5, 9], fill: "var(--n-grass-1)" },
  { spacing: 7, tall: [0.36, 0.8], wide: [4.5, 8], fill: "var(--n-grass-2)" },
  { spacing: 6, tall: [0.2, 0.55], wide: [4, 7], fill: "var(--n-grass-3)" },
];

/** All the blades of one layer as a single path. */
export function bladesPath(
  layer: number,
  width: number,
  base: number,
  height: number,
  seed: number,
  spec: GrassLayer = GRASS_LAYERS[layer],
) {
  let d = "";
  const count = Math.ceil(width / spec.spacing) + 2;
  for (let i = -1; i < count; i++) {
    const a = rnd(seed, layer, i),
      b = rnd(seed, layer + 11, i),
      c = rnd(seed, layer + 23, i);
    const x = (i + 0.5) * spec.spacing + (a - 0.5) * spec.spacing * 0.9;
    const tall = spec.tall[0] + (spec.tall[1] - spec.tall[0]) * b;
    const h = Math.max(4, height * tall * clump(seed + layer * 31, x));
    const w = spec.wide[0] + (spec.wide[1] - spec.wide[0]) * c;
    // Most blades lean a little; a few lean a lot.
    const lean = (a - 0.5) * h * (c > 0.8 ? 0.9 : 0.42);
    d += blade(x, base, h, w, lean);
  }
  return d;
}

/** The soil: short dark blades on a solid band, so its edge is a silhouette. */
export function soilPath(
  width: number,
  base: number,
  soil: number,
  seed: number,
) {
  const top = base - soil;
  let d = `M-4 ${r1(base + 1)}V${r1(top)}H${r1(width + 4)}V${r1(base + 1)}Z`;
  d += bladesPath(3, width, top + 1, Math.max(8, soil * 0.9), seed, {
    spacing: 4.5,
    tall: [0.35, 1],
    wide: [3.5, 6],
    fill: "",
  });
  return d;
}

/** The three blade layers and the soil, in drawing order. */
export function GrassLayers({
  width,
  base,
  height,
  soil,
  seed,
  only,
}: {
  width: number;
  /** The y of the ground line (the soil's bottom). */
  base: number;
  /** How tall the tallest blades can grow, px. */
  height: number;
  /** Height of the soil band, px. */
  soil: number;
  seed: number;
  /** Draw a single layer (0–2) or "soil"; by default everything. */
  only?: number | "soil";
}) {
  const ground = base - soil * 0.55;
  return (
    <>
      {GRASS_LAYERS.map((spec, i) =>
        only === undefined || only === i ? (
          <path
            key={i}
            d={bladesPath(i, width, ground, height, seed)}
            fill={spec.fill}
          />
        ) : null,
      )}
      {(only === undefined || only === "soil") && (
        <path d={soilPath(width, base, soil, seed)} fill="var(--n-ground)" />
      )}
    </>
  );
}

/** The width of a box in CSS px, kept current with a ResizeObserver. */
export function useBoxWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Layout width, not the painted box: a scaling animation must not resize the drawing.
    const measure = () => setWidth(el.offsetWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** A plain strip of grass, full width, decorative. */
export function Grass({
  height = 72,
  seed = 20261114,
  className = "",
}: {
  height?: number;
  seed?: number;
  className?: string;
}) {
  const [box, width] = useBoxWidth<HTMLDivElement>();
  const soil = Math.round(height * 0.16);
  return (
    <div ref={box} className={"pt-grass " + className} style={{ height }}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          aria-hidden="true"
          focusable="false"
        >
          <GrassLayers
            width={width}
            base={height}
            height={height - soil * 0.4}
            soil={soil}
            seed={seed}
          />
        </svg>
      )}
    </div>
  );
}
