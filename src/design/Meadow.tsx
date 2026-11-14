// The meadow: the grass with one plant for every saved entry, growing among
// the blades (DESIGN.md → "The new garden"). Kind, place and size come from
// plantsFrom() in src/today.ts; only the drawing lives here. A plant flowers
// (peach petals, butter centre) when its entry was marked "helpful"; every
// other plant stays green. Nothing withers and nothing is taken away.
import { useEffect, useId, useRef, type CSSProperties } from "react";
import { hashString, r1 } from "./voiceLine";
import { GrassLayers, useBoxWidth } from "./Grass";
import {
  isToday,
  plantsFrom,
  type DayEntry,
  type Plant,
  type PlantKind,
} from "../today";

/* ───────────── One plant, drawn at its base (0, 0), growing up ───────────── */

// A broad, soft leaf, 34 units long, pointing right and a little up.
const LEAF = "M0 0C6 -9 20 -15 34 -11C25 -1 11 3 0 0Z";
// A long broad leaf for the rosette.
const BROAD = "M0 0C9 -13 31 -22 54 -15C39 0 17 5 0 0Z";
// A closed bud, a teardrop.
const BUD = "M0 0C-5.5 -4 -5 -12 0 -17C5 -12 5.5 -4 0 0Z";

const TONES = ["var(--n-grass-2)", "var(--n-grass-3)", "var(--n-ground)"];

/** Nominal height of each kind, before its scale. */
export const KIND_HEIGHT: Record<PlantKind, number> = {
  sprout: 40,
  tuft: 44,
  fern: 82,
  bud: 64,
  flower: 74,
};

function Leaf({
  at,
  angle,
  side,
  size = 1,
  fill,
  d = LEAF,
}: {
  at: number;
  angle: number;
  side: 1 | -1;
  size?: number;
  fill: string;
  d?: string;
}) {
  return (
    <path
      d={d}
      fill={fill}
      transform={`translate(0 ${r1(-at)}) scale(${side * size} ${size}) rotate(${angle})`}
    />
  );
}

function Stem({ h, sway }: { h: number; sway: number }) {
  return (
    <path
      className="pt-stem"
      d={`M0 0C${r1(sway)} ${r1(-h * 0.35)} ${r1(-sway)} ${r1(-h * 0.7)} 0 ${r1(-h)}`}
    />
  );
}

/** Five or six round petals and a butter centre. */
export function Flower({
  r = 8.5,
  petals = 5,
  className,
}: {
  r?: number;
  petals?: number;
  className?: string;
}) {
  return (
    <g className={className}>
      {Array.from({ length: petals }, (_, i) => (
        <ellipse
          key={i}
          cy={r1(-r * 0.58)}
          rx={r1(r * 0.42)}
          ry={r1(r * 0.62)}
          fill="var(--n-peach)"
          transform={`rotate(${r1((360 / petals) * i)})`}
        />
      ))}
      <circle r={r1(r * 0.36)} fill="var(--n-butter)" />
    </g>
  );
}

export function PlantArt({
  kind,
  hue,
  seed,
  bloom,
  bloomClass,
}: {
  kind: PlantKind;
  hue: number;
  seed: number;
  /** This entry was marked helpful: it flowers. */
  bloom: boolean;
  bloomClass?: string;
}) {
  const tone = (i: number) => TONES[(hue + i) % 3];
  const sway = ((seed >>> 3) % 7) - 3;
  const petals = seed % 2 ? 6 : 5;
  const top = (h: number) =>
    bloom ? (
      <g transform={`translate(0 ${-h})`}>
        <Flower petals={petals} className={bloomClass} />
      </g>
    ) : null;
  switch (kind) {
    case "tuft": {
      // Broad leaves from the ground; a flower rises on its own stem.
      return (
        <>
          {bloom && <Stem h={40} sway={sway * 0.6} />}
          <Leaf at={0} angle={-58} side={-1} size={0.78} fill={tone(1)} d={BROAD} />
          <Leaf at={0} angle={-34} side={-1} size={0.92} fill={tone(0)} d={BROAD} />
          <Leaf at={0} angle={-62} side={1} size={0.86} fill={tone(0)} d={BROAD} />
          <Leaf at={0} angle={-30} side={1} size={0.74} fill={tone(1)} d={BROAD} />
          {top(40)}
        </>
      );
    }
    case "sprout":
      return (
        <>
          <Stem h={bloom ? 46 : 34} sway={sway * 0.5} />
          <Leaf at={bloom ? 26 : 32} angle={-26} side={-1} size={1} fill={tone(0)} />
          <Leaf at={bloom ? 30 : 34} angle={-32} side={1} size={0.92} fill={tone(1)} />
          {top(46)}
        </>
      );
    case "fern": {
      // A spike: a tall stem, a leaf at its foot, grains along its top.
      const grains = bloom ? [] : [46, 52, 58, 64, 70, 76];
      return (
        <>
          <Stem h={bloom ? 74 : 80} sway={sway} />
          <Leaf at={10} angle={-48} side={1} size={1.1} fill={tone(1)} d={BROAD} />
          <Leaf at={22} angle={-30} side={-1} size={0.8} fill={tone(0)} />
          {grains.map((y, i) => (
            <ellipse
              key={y}
              cx={i % 2 ? 3 : -3}
              cy={-y}
              rx="2.8"
              ry="5.4"
              fill={i % 3 === 2 ? "var(--n-grass-2)" : "var(--n-grass-1)"}
              transform={`rotate(${i % 2 ? 26 : -26} ${i % 2 ? 3 : -3} ${-y})`}
            />
          ))}
          {!bloom && <ellipse cy={-82} rx="2.6" ry="5.2" fill="var(--n-grass-1)" />}
          {top(74)}
        </>
      );
    }
    case "bud":
    case "flower": {
      const h = kind === "bud" ? 60 : 70;
      return (
        <>
          <Stem h={h} sway={sway} />
          <Leaf at={h * 0.3} angle={-24} side={1} size={1.05} fill={tone(0)} />
          <Leaf at={h * 0.5} angle={-28} side={-1} size={0.95} fill={tone(1)} />
          {kind === "flower" && (
            <Leaf at={h * 0.68} angle={-30} side={1} size={0.75} fill={tone(2)} />
          )}
          {bloom ? (
            top(h)
          ) : (
            <path d={BUD} fill="var(--n-grass-1)" transform={`translate(0 ${-h + 2})`} />
          )}
        </>
      );
    }
  }
}

const helpedIds = (entries: DayEntry[]) =>
  new Set(
    entries.filter((e) => e.action?.feedback === "helpful").map((e) => e.id),
  );

/** "plant-<id>" as a valid view-transition-name. */
export const plantTransitionName = (id: string) =>
  "plant-" + id.replace(/[^a-zA-Z0-9_-]/g, "-");

/* ───────────── The meadow ───────────── */

const ROW_DEPTH = [0.74, 0.87, 1];

export function meadowLabel(entries: DayEntry[]) {
  const count = entries.filter((e) => e.saved).length;
  if (!count) return "Your garden: grass, waiting for your first entry.";
  const flowered = entries.filter(
    (e) => e.saved && e.action?.feedback === "helpful",
  ).length;
  return (
    `Your garden: ${count} small ${count === 1 ? "plant" : "plants"}, one for each entry you have saved.` +
    (flowered
      ? ` ${flowered} ${flowered === 1 ? "has" : "have"} flowered, where something helped.`
      : "")
  );
}

/**
 * The grass with every saved entry's plant in it. `compact` is the low strip
 * at the foot of Home and My journal; otherwise the full meadow of My garden.
 * `grow` names the plant that has just been planted: it grows once.
 */
export function Meadow({
  entries,
  height,
  compact = false,
  grow,
  decorative = false,
  className = "",
  style,
}: {
  entries: DayEntry[];
  height: number;
  compact?: boolean;
  grow?: string | null;
  decorative?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const [box, W] = useBoxWidth<HTMLDivElement>();
  const plants = plantsFrom(entries);
  const helped = helpedIds(entries);
  const mobile = W > 0 && W < 640;
  const soil = compact ? Math.round(height * 0.16) : mobile ? 18 : 26;
  const grassHeight = compact ? height * 0.56 : height * (mobile ? 0.36 : 0.32);
  // How big a plant of scale 1 is. Every plant stands a little above the
  // grass around it: in the low strip they peek out, in the meadow they lead.
  const unit = compact ? 0.92 : mobile ? 1.25 : 1.85;
  const minTop = grassHeight * (compact ? 1.05 : 1.15);
  const pad = compact ? 24 : mobile ? 20 : 48;
  const placed = plants.map((p) => {
    const seed = hashString(p.id);
    return {
      p,
      seed,
      x: pad + p.x * Math.max(0, W - 2 * pad),
      base: height - soil * 0.5 - (2 - p.row) * (compact ? 2 : mobile ? 7 : 12),
      scale: Math.max(
        p.scale * ROW_DEPTH[p.row] * unit,
        minTop / KIND_HEIGHT[p.kind],
      ),
      tilt: ((seed >>> 7) % 13) - 6,
    };
  });
  const row = (r: Plant["row"]) =>
    placed
      .filter((q) => q.p.row === r)
      .map((q) => (
        <g
          key={q.p.id}
          transform={`translate(${r1(q.x)} ${r1(q.base)}) rotate(${q.tilt}) scale(${r1(q.scale * 100) / 100})`}
        >
          <g className={"pt-plant" + (q.p.id === grow ? " is-sprouting" : "")}>
            <PlantArt
              kind={q.p.kind}
              hue={q.p.hue}
              seed={q.seed}
              bloom={helped.has(q.p.id)}
            />
          </g>
        </g>
      ));
  const seed = compact ? 20261114 : 20261115;
  return (
    <div
      ref={box}
      className={"pt-meadow " + className}
      style={{ height, ...style }}
      {...(decorative
        ? { "aria-hidden": true }
        : { role: "img", "aria-label": meadowLabel(entries) })}
    >
      {W > 0 && (
        <svg
          width={W}
          height={height}
          viewBox={`0 0 ${W} ${height}`}
          aria-hidden="true"
          focusable="false"
        >
          <GrassLayers width={W} base={height} height={grassHeight} soil={soil} seed={seed} only={0} />
          {row(0)}
          <GrassLayers width={W} base={height} height={grassHeight} soil={soil} seed={seed} only={1} />
          {row(1)}
          <GrassLayers width={W} base={height} height={grassHeight} soil={soil} seed={seed} only={2} />
          {row(2)}
          <GrassLayers width={W} base={height} height={grassHeight} soil={soil} seed={seed} only="soil" />
        </svg>
      )}
    </div>
  );
}

/* ───────────── One entry's plant, on its own little patch ───────────── */

type FigureEntry = DayEntry & { action?: DayEntry["action"] };

/**
 * The plant an entry has in the garden, standing in a small tuft of grass:
 * the journal's rows (56px) and the entry page's header. A draft is a young
 * sprout. When "helpful" arrives, the flower opens once.
 */
export function PlantFigure({
  entry,
  decorative = false,
  className = "",
  style,
}: {
  entry: FigureEntry;
  decorative?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const plant = plantsFrom([{ ...entry, saved: true }])[0];
  const seed = hashString(entry.id);
  const patch = "pt-patch" + useId().replace(/:/g, "");
  const bloom = entry.saved && entry.action?.feedback === "helpful";
  const young = !entry.saved;
  // Open once when the flower arrives while the page is open.
  const was = useRef(bloom);
  const opening = bloom && !was.current;
  useEffect(() => {
    was.current = bloom;
  });
  const kind: PlantKind = young ? "sprout" : plant.kind;
  const scale = young ? 0.7 : 1;
  const label = young
    ? "A young plant: this entry is not saved yet."
    : bloom
      ? "This entry's plant in your garden, in flower: something helped."
      : isToday(entry.created_at)
        ? "Today's plant in your garden."
        : "This entry's plant in your garden.";
  return (
    <svg
      className={"pt-figure " + className}
      style={style}
      viewBox="-54 -104 108 112"
      {...(decorative
        ? { "aria-hidden": true, focusable: "false" }
        : { role: "img", "aria-label": label })}
    >
      <g transform={`scale(${scale})`}>
        <PlantArt
          kind={kind}
          hue={plant.hue}
          seed={seed}
          bloom={bloom}
          bloomClass={opening ? "is-opening" : undefined}
        />
      </g>
      <defs>
        <clipPath id={patch}>
          <ellipse cx="0" cy="2" rx="46" ry="30" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${patch})`}>
        <g transform="translate(-54 6)">
          <GrassLayers width={108} base={2} height={22} soil={5} seed={seed} />
        </g>
      </g>
    </svg>
  );
}
