// The patient's garden: home, journal (log), "My garden" and the leaf menu.
// The psychologist portal never imports from here.
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  Check,
  Leaf,
  LogOut,
  Settings2,
  Sprout,
  X,
} from "lucide-react";
import {
  catmullRom,
  cubicD,
  gaussianEnvelope,
  hashString,
  mulberry32,
  r1,
  sampleCubic,
  voiceWave,
  type Cubic,
  type Pt,
} from "./design/voiceLine";
import type { Entry, Insights, User } from "./types";
import { ContextCards, ErrorNotice, Loading } from "./components";
import { SimpleModeControl, useGrowth } from "./growth";
import {
  daysTended,
  isToday,
  localDayKey,
  plantsFrom,
  reflectionFor,
  rhythmPhrase,
  todayState,
  todayTarget,
  type Plant,
  type TodayState,
} from "./today";

const longDate = (value: string | Date) =>
  new Date(value).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
const shortDate = (value: string) =>
  new Date(value).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
const savedNewestFirst = (entries: Entry[]) =>
  entries
    .filter((e) => e.saved)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

/* ───────────────────────── Garden illustration ───────────────────────── */

const LEAF = ["var(--g-moss)", "var(--g-leaf)", "var(--g-sage)"];

function PlantShape({ plant }: { plant: Plant }) {
  const leaf = LEAF[plant.hue],
    leaf2 = LEAF[(plant.hue + 1) % 3];
  const stem = (
    <path
      d={
        plant.kind === "tuft"
          ? ""
          : plant.kind === "fern"
            ? "M0 0 C3 -14 -3 -30 1 -46"
            : "M0 0 C1.5 -10 -1.5 -20 0 -32"
      }
      stroke="var(--g-stem)"
      strokeWidth="1.6"
      strokeLinecap="round"
      fill="none"
    />
  );
  switch (plant.kind) {
    case "tuft":
      return (
        <g stroke={leaf} strokeWidth="2" strokeLinecap="round" fill="none">
          <path d="M0 0 Q-3 -12 -10 -20" />
          <path d="M0 0 Q-1 -15 -3 -27" />
          <path d="M0 0 Q2 -14 5 -24" />
          <path d="M0 0 Q4 -9 11 -15" />
        </g>
      );
    case "fern":
      return (
        <>
          {stem}
          {[-12, -22, -32, -41].map((y, i) => (
            <ellipse
              key={y}
              cx={i % 2 ? 6 : -6}
              cy={y}
              rx="6.5"
              ry="2.6"
              fill={i % 2 ? leaf : leaf2}
              transform={`rotate(${i % 2 ? -28 : 28} ${i % 2 ? 6 : -6} ${y})`}
            />
          ))}
        </>
      );
    case "flower":
      return (
        <>
          {stem}
          <path
            d="M0 -12 C-9 -13 -13 -20 -12 -25 C-5 -23 -1 -18 0 -12Z"
            fill={leaf}
          />
          {Array.from({ length: 5 }, (_, i) => (
            <ellipse
              key={i}
              cx="0"
              cy="-40"
              rx="3.2"
              ry="5.6"
              fill={i % 2 ? "var(--g-petal)" : "var(--g-butter)"}
              transform={`rotate(${i * 72} 0 -34)`}
            />
          ))}
          <circle cx="0" cy="-34" r="2.6" fill="var(--g-clay)" />
        </>
      );
    case "bud":
      return (
        <>
          {stem}
          <path
            d="M0 -14 C9 -15 13 -22 12 -27 C5 -25 1 -20 0 -14Z"
            fill={leaf}
          />
          <path
            d="M0 -31 C-5 -35 -4 -42 0 -46 C4 -42 5 -35 0 -31Z"
            fill="var(--g-clay)"
          />
        </>
      );
    default:
      return (
        <>
          {stem}
          <path
            d="M0 -16 C-10 -18 -15 -26 -14 -32 C-6 -30 -1 -24 0 -16Z"
            fill={leaf}
          />
          <path
            d="M0 -23 C9 -25 14 -32 13 -38 C5 -36 0 -30 0 -23Z"
            fill={leaf2}
          />
        </>
      );
  }
}

const ROW_Y = [118, 132, 148];
const ROW_SCALE = [0.85, 1.05, 1.3];

export function Garden({
  plants,
  label,
  growOnView = false,
  animate = false,
  className = "",
}: {
  plants: Plant[];
  label: string;
  growOnView?: boolean;
  /** Start hidden and grow — only when useGrowOnce() says it will really run. */
  animate?: boolean;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const ordered = [...plants].sort((a, b) => a.row - b.row);
  return (
    <svg
      className={"garden " + className}
      viewBox="0 42 360 134"
      role="img"
      aria-label={label}
      preserveAspectRatio="xMidYMax meet"
    >
      <path
        d="M-4 112 C40 98 92 104 140 100 C196 95 250 104 300 98 C330 95 350 99 364 102 V176 H-4Z"
        fill="var(--g-hill)"
      />
      <path
        d="M-4 136 C46 126 104 134 160 128 C222 122 286 132 364 126 V176 H-4Z"
        fill="var(--g-ground)"
      />
      <path
        d="M-4 158 C60 150 130 156 190 152 C252 148 312 156 364 152 V176 H-4Z"
        fill="var(--g-soil)"
      />
      {plants.length === 0 && (
        <g transform="translate(180 150)">
          <ellipse cx="0" cy="-3" rx="7" ry="4.5" fill="var(--g-clay)" />
          <path
            d="M0 -6 C0 -11 2 -14 5 -16"
            stroke="var(--g-leaf)"
            strokeWidth="1.6"
            strokeLinecap="round"
            fill="none"
          />
        </g>
      )}
      {ordered.map((plant, i) => {
        const x = 12 + plant.x * 336;
        const s = plant.scale * ROW_SCALE[plant.row];
        const grow = {
          initial: { scaleY: 0, opacity: 0 },
          transition: {
            duration: 1.6,
            delay: 0.2 + i * 0.06,
            ease: [0.22, 1, 0.36, 1] as const,
          },
          ...(growOnView
            ? {
                whileInView: { scaleY: 1, opacity: 1 },
                viewport: { once: true, amount: 0.4 },
              }
            : { animate: { scaleY: 1, opacity: 1 } }),
        };
        return (
          <g
            key={plant.id}
            transform={`translate(${x.toFixed(1)} ${ROW_Y[plant.row]}) scale(${s.toFixed(2)})`}
            opacity={plant.row === 0 ? 0.78 : 1}
          >
            <motion.g
              style={{ transformBox: "fill-box", originY: 1, originX: 0.5 }}
              {...(animate && !reduced ? grow : {})}
            >
              <PlantShape plant={plant} />
              {plant.fresh && (
                <circle cx="2" cy="-50" r="2.4" fill="var(--g-butter)" />
              )}
            </motion.g>
          </g>
        );
      })}
    </svg>
  );
}

function gardenLabel(count: number) {
  return count === 0
    ? "Your garden: a single seed, waiting for your first entry."
    : `Your garden: ${count} small ${count === 1 ? "plant" : "plants"}, one for each entry you have saved.`;
}

/* ───────────────────────── Leaf menu ───────────────────────── */

export function LeafMenu({ onSignOut }: { onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null),
    panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>("a")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!panel.current?.contains(target) && !button.current?.contains(target))
        setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);
  return (
    <div className="leaf-menu">
      <button
        ref={button}
        type="button"
        className="leaf-button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        {open ? <X size={20} /> : <Leaf size={20} />}
      </button>
      {open && (
        <div className="leaf-panel" id={id} ref={panel}>
          <nav aria-label="Garden menu">
            <NavLink to="/patient/journal">Journal</NavLink>
            <NavLink to="/patient/garden">My garden</NavLink>
          </nav>
          <button type="button" className="leaf-signout" onClick={onSignOut}>
            <LogOut size={15} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Today's action ───────────────────────── */

/* ───────────────────────── Today's action ───────────────────────── */

/** "Today", the state, the main action and "Add another entry", as one group. */
export function TodayAction({
  state,
  sample,
}: {
  state: TodayState<Entry> | null;
  sample: boolean;
}) {
  const label = <span className="gh-today-label">Today</span>;
  if (!state)
    return (
      <div className="today-action" aria-busy="true">
        {label}
        <p className="today-status">Opening your garden…</p>
      </div>
    );
  if (state.kind === "done")
    return (
      <div className="today-action">
        {label}
        <p className="today-status" role="status">
          <Check size={16} aria-hidden="true" /> Today’s entry is planted.
        </p>
        <Link className="garden-cta" to={todayTarget(state)}>
          See today’s entry
        </Link>
        {!sample && (
          <Link className="quiet-link" to="/patient/new">
            Add another entry
          </Link>
        )}
      </div>
    );
  if (state.kind === "in_progress")
    return (
      <div className="today-action">
        {label}
        <p className="today-status" role="status">
          <Sprout size={16} aria-hidden="true" /> You started an entry earlier
          today.
        </p>
        <Link className="garden-cta" to={todayTarget(state)}>
          Continue today’s entry
        </Link>
      </div>
    );
  if (sample)
    return (
      <div className="today-action">
        {label}
        <p className="today-status">
          This sample garden is read only. Use the fresh profile to add your own
          entries.
        </p>
      </div>
    );
  return (
    <div className="today-action">
      {label}
      <Link className="garden-cta" to={todayTarget(state)}>
        Add an entry
      </Link>
      <p className="today-hint">A voice note or a few written words.</p>
    </div>
  );
}

/** Shown on /patient/new so a direct visit never hides today's existing entry. */
export function TodayNotice({ entries }: { entries: Entry[] | null }) {
  if (!entries) return null;
  const state = todayState(entries);
  if (state.kind === "pending") return null;
  return (
    <p className="today-notice" role="status">
      {state.kind === "done"
        ? "You already planted an entry today. You can add another, or "
        : "You have an unfinished entry from today. You can start fresh, or "}
      <Link to={todayTarget(state)}>
        {state.kind === "done" ? "see today’s entry" : "continue that one"}
      </Link>
      .
    </p>
  );
}

/* ───────────────────────── Voice garden (home) ───────────────────────── */
// One voice line for the last 14 days (7 on small screens). Earlier days are
// small, secondary plants on soft bursts; the line then turns up, as on "/",
// and becomes TODAY's plant — the protagonist. Every variation comes from a
// hash of the entry id, never from duration, energy, acoustic or mood data.
// Nothing withers or shrinks.

const GROWN_KEY = "numa-garden-grown";
function firstGrowthThisSession(key = GROWN_KEY) {
  try {
    return sessionStorage.getItem(key) !== "1";
  } catch {
    return false;
  }
}
function markGrown(key = GROWN_KEY) {
  try {
    sessionStorage.setItem(key, "1");
  } catch {
    /* storage unavailable: the garden simply appears grown */
  }
}

/**
 * True only when a growth animation will really run: the first visit of this
 * session, motion allowed, and the tab visible. Otherwise every plant is drawn
 * in its final state, so nothing can stay hidden if an animation never plays.
 */
function useGrowOnce(key: string, ready: boolean) {
  const reduced = useReducedMotion();
  const [first] = useState(
    () =>
      firstGrowthThisSession(key) &&
      typeof document !== "undefined" &&
      document.visibilityState === "visible",
  );
  useEffect(() => {
    if (ready) markGrown(key);
  }, [ready, key]);
  return first && !reduced;
}

const LEAF_PATH = "M0 0 C12 -19 40 -30 70 -21 C53 -2 26 7 0 0Z"; // 70 units long, as on "/"
const LEAF_TONES = ["var(--n-sage)", "var(--n-natural)", "var(--n-moss)"];
// Typical height (px at 1440) of an earlier day's plant, by kind.
const PAST_HEIGHT: Record<Plant["kind"], number> = {
  tuft: 58,
  sprout: 66,
  bud: 88,
  fern: 100,
  flower: 106,
};

function LeafAt({
  x = 0,
  y,
  side,
  length,
  tone,
  tilt = -16,
  className,
  style,
}: {
  x?: number;
  y: number;
  side: 1 | -1;
  length: number;
  tone: string;
  tilt?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const s = length / 70;
  return (
    <g
      transform={`translate(${r1(x)} ${r1(y)}) scale(${r1(side * s * 100) / 100} ${r1(s * 100) / 100}) rotate(${r1(tilt)})`}
    >
      <path d={LEAF_PATH} fill={tone} className={className} style={style} />
    </g>
  );
}

function Bloom({
  r,
  petal,
  centre = "var(--n-ivory)",
}: {
  r: number;
  petal: string;
  centre?: string;
}) {
  return (
    <>
      {Array.from({ length: 6 }, (_, i) => (
        <ellipse
          key={i}
          cy={r1(-r * 0.5)}
          rx={r1(r * 0.28)}
          ry={r1(r * 0.5)}
          fill={petal}
          transform={`rotate(${i * 60})`}
        />
      ))}
      <circle r={r1(r * 0.24)} fill={centre} />
    </>
  );
}

/** An earlier day's plant: secondary, drawn at its base (0,0), growing up. */
function PastPlant({
  kind,
  h,
  hue,
  leaf,
  sway,
  bloomClass,
}: {
  kind: Plant["kind"];
  h: number;
  hue: number;
  leaf: number;
  sway: number;
  bloomClass?: string;
}) {
  const tone = (i: number) => LEAF_TONES[(hue + i) % 3];
  const stem = (height: number) => (
    <path
      className="gh-stem"
      d={`M0 0 C${r1(sway)} ${r1(-height * 0.35)} ${r1(-sway)} ${r1(-height * 0.7)} 0 ${r1(-height)}`}
    />
  );
  if (kind === "tuft")
    return (
      <g className="gh-blades">
        {(
          [
            [-0.6, 0.62],
            [-0.2, 1],
            [0.22, 0.86],
            [0.55, 0.6],
          ] as const
        ).map(([dx, dy], i) => (
          <path
            key={i}
            stroke={tone(i)}
            d={`M0 0 Q${r1(dx * leaf * 0.25)} ${r1(-h * dy * 0.6)} ${r1(dx * leaf)} ${r1(-h * dy)}`}
          />
        ))}
      </g>
    );
  if (kind === "sprout")
    return (
      <>
        {stem(h)}
        <LeafAt y={-h * 0.5} side={1} length={leaf * 0.85} tone={tone(0)} />
        <LeafAt y={-h * 0.82} side={-1} length={leaf * 0.75} tone={tone(1)} />
      </>
    );
  if (kind === "fern")
    return (
      <>
        {stem(h)}
        {[0.3, 0.46, 0.62, 0.78].map((f, i) => (
          <LeafAt
            key={f}
            y={-h * f}
            side={i % 2 ? -1 : 1}
            length={leaf * 0.8 * (1 - i * 0.1)}
            tone={tone(i)}
            tilt={-12 - i * 3}
          />
        ))}
      </>
    );
  const top = kind === "bud" ? h * 0.9 : h;
  return (
    <>
      {stem(top)}
      <LeafAt y={-top * 0.36} side={1} length={leaf} tone={tone(0)} />
      <LeafAt y={-top * 0.6} side={-1} length={leaf * 0.85} tone={tone(1)} />
      {kind === "bud" ? (
        <ellipse cy={r1(-top - 5)} rx="3.4" ry="6" fill="var(--n-past-bloom)" />
      ) : (
        <g transform={`translate(0 ${r1(-top)})`}>
          <g className={bloomClass}>
            <Bloom r={Math.max(7, leaf * 0.36)} petal="var(--n-past-bloom)" />
          </g>
        </g>
      )}
    </>
  );
}

/**
 * The deterministic look of an earlier day's plant, shared by the home garden
 * and the entry page. Everything comes from a hash of the entry id — never from
 * duration, energy, acoustic or mood data.
 */
export function pastPlantShape(
  entryId: string,
  kind: Plant["kind"],
  k: number,
  slot: number,
) {
  const h = hashString(entryId);
  const unit = (shift: number, span: number) =>
    ((h >>> shift) % (span + 1)) / span; // 0..1 from the id
  return {
    offset: unit(0, 60) - 0.5, // within the day's slot
    h: Math.min(
      120 * k,
      Math.max(50 * k, PAST_HEIGHT[kind] * k * (0.85 + 0.3 * unit(4, 30))),
    ),
    tilt: -5 + 10 * unit(9, 20),
    leaf: Math.min(30, slot * 0.42) * k * (0.85 + 0.3 * unit(13, 30)),
    sway: (unit(17, 8) - 0.5) * 6,
    burstSigma: (slot * (0.35 + 0.35 * unit(21, 30))) / 2.4, // 35–70% of the day
    burstWeight: 0.8 + 0.2 * unit(25, 20),
  };
}

/** Garden slot width at 1440, so an entry's plant matches its look on the home. */
const HOME_SLOT = 84;

/**
 * The plant this entry has in the garden, growing from its own short burst of
 * voice line: a past plant (past-bloom flower) for earlier days, today's
 * flowering plant (apricot) for today's saved entry, a young plant for a draft.
 */
export function EntryPlant({
  entry,
  glyph = false,
  decorative = false,
}: {
  entry: Entry;
  /** A small glyph (the journal's rows): cropped around the plant. */
  glyph?: boolean;
  /** Inside a link that already names the entry: hidden from assistive tech. */
  decorative?: boolean;
}) {
  const reduced = useReducedMotion();
  const plant = plantsFrom([{ ...entry, saved: true }])[0];
  const mode = !entry.saved
    ? "young"
    : isToday(entry.created_at)
      ? "today"
      : "past";
  // When feedback turns an earlier plant into a flower, let it open once.
  const previous = useRef(plant.kind);
  const opening =
    !reduced &&
    mode === "past" &&
    previous.current !== "flower" &&
    plant.kind === "flower";
  useEffect(() => {
    previous.current = plant.kind;
  });
  const shape = pastPlantShape(entry.id, plant.kind, 1, HOME_SLOT);
  const size = 200,
    axis = 172,
    cx = 96;
  const wave = voiceWave({
    to: size,
    axis,
    amp: 13,
    wavelength: 12,
    rand: mulberry32(hashString(entry.id)),
    envelope: (x) =>
      gaussianEnvelope(
        [
          {
            c: cx,
            s: mode === "past" ? shape.burstSigma * 1.1 : 20,
            w: shape.burstWeight,
          },
        ],
        x,
      ),
    settle: false,
  });
  const d = `M${r1(wave[0][0])} ${r1(wave[0][1])}` + catmullRom(wave);
  const tall = mode === "today" ? 138 : 104;
  const stem: Cubic = [
    [cx, axis],
    [cx + 3, axis - tall * 0.4],
    [cx - 5, axis - tall * 0.72],
    [cx + 1, axis - tall],
  ];
  const points = sampleCubic(stem);
  const onStem = (y: number) =>
    points.reduce((a, b) => (Math.abs(b[1] - y) < Math.abs(a[1] - y) ? b : a));
  const leaves = mode === "today" ? [0.24, 0.4, 0.55, 0.68, 0.8] : [0.34, 0.58];
  const seed = hashString(entry.id);
  // As a glyph, the plant fills its box: base 6px above the bottom (where the
  // date's baseline sits), top 4px below the edge. Measured, never guessed.
  const svgRef = useRef<SVGSVGElement>(null);
  const plantRef = useRef<SVGGElement>(null);
  const [glyphBox, setGlyphBox] = useState("16 12 168 168");
  useLayoutEffect(() => {
    if (!glyph || !svgRef.current || !plantRef.current) return;
    const measured = svgRef.current.getBoundingClientRect().height;
    const px = measured > 10 ? measured : 56;
    const b = plantRef.current.getBBox();
    const air = 4,
      under = 6;
    const scale = (px - air - under) / Math.max(1, axis - b.y); // px per unit
    const side = px / scale;
    setGlyphBox(
      [b.x + b.width / 2 - side / 2, b.y - air / scale, side, side]
        .map(r1)
        .join(" "),
    );
  }, [glyph, entry.id, mode, plant.kind]);
  return (
    <svg
      ref={svgRef}
      className={"entry-plant" + (glyph ? " is-glyph" : "")}
      viewBox={glyph ? glyphBox : `0 0 ${size} ${size}`}
      {...(decorative
        ? { "aria-hidden": true }
        : {
            role: "img",
            "aria-label":
              mode === "today"
                ? "Today's plant in your garden, in flower."
                : mode === "young"
                  ? "A young plant: this entry is not saved yet."
                  : "This entry's plant in your garden.",
          })}
    >
      <path className="gh-line" d={d} pathLength={1} />
      <g ref={plantRef}>
        {mode === "past" ? (
          <g
            transform={`translate(${cx} ${axis}) scale(1.3) rotate(${r1(shape.tilt)})`}
          >
            <PastPlant
              kind={plant.kind}
              h={shape.h}
              hue={plant.hue}
              leaf={shape.leaf}
              sway={shape.sway}
              bloomClass={opening ? "is-opening" : undefined}
            />
          </g>
        ) : (
          <>
            <path
              className="gh-stem entry-plant-stem"
              d={`M${cx} ${axis}` + cubicD(stem)}
            />
            {leaves.map((f, i) => {
              const [x, y] = onStem(axis - tall * f);
              return (
                <LeafAt
                  key={f}
                  x={x}
                  y={y}
                  side={i % 2 ? -1 : 1}
                  length={(mode === "today" ? 40 : 34) * (1 - i * 0.07)}
                  tone={LEAF_TONES[(seed + i) % 3]}
                  tilt={-16 + (((seed >>> (i * 3)) % 7) - 3)}
                />
              );
            })}
            {mode === "today" && (
              <g transform={`translate(${cx + 1} ${axis - tall})`}>
                <Bloom r={17} petal="var(--n-apricot)" />
              </g>
            )}
          </>
        )}
      </g>
    </svg>
  );
}

/** While an entry is being read: the line draws once, then a dot breathes at its end. */
export function ListeningLine() {
  const wave = voiceWave({
    to: 176,
    axis: 140,
    amp: 12,
    wavelength: 12,
    rand: mulberry32(20261114),
    envelope: (x) =>
      gaussianEnvelope(
        [
          { c: 46, s: 16, w: 0.8 },
          { c: 118, s: 14, w: 0.6 },
        ],
        x,
      ),
  });
  const d = `M${r1(wave[0][0])} ${r1(wave[0][1])}` + catmullRom(wave);
  // Draw the line only when the drawing can really be seen; otherwise show it whole.
  const reduced = useReducedMotion();
  const [visible] = useState(
    () =>
      typeof document === "undefined" || document.visibilityState === "visible",
  );
  return (
    <svg className="entry-listening" viewBox="0 0 200 200" aria-hidden="true">
      <path
        className={
          "gh-line" + (visible && !reduced ? " entry-listening-line" : "")
        }
        d={d}
        pathLength={1}
      />
      <circle
        className="entry-listening-dot"
        cx="186"
        cy="140"
        r="5"
        fill="var(--n-moss)"
      />
    </svg>
  );
}

/** When the left-to-right trace (eased with --n-ease) reaches a fraction of its length. */
const traceDelay = (fraction: number) =>
  1.3 * (1 - Math.pow(1 - Math.min(1, Math.max(0, fraction)), 1 / 3));

interface PlacedPlant {
  id: string;
  plant: Plant;
  x: number;
  h: number;
  tilt: number;
  leaf: number;
  sway: number;
}

function VoiceGarden({
  entries,
  state,
  days: fixedDays,
  compact = false,
}: {
  entries: Entry[] | null;
  state: TodayState<Entry> | null;
  /** A fixed number of days; by default 14 (7 on small screens). */
  days?: number;
  /** About 110px tall, no growth animation: the journal's week. */
  compact?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, mobile: false });
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      const width = el.clientWidth;
      const mobile = window.matchMedia("(max-width: 720px)").matches;
      setSize((s) =>
        s.width === width && s.mobile === mobile ? s : { width, mobile },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  // The compact week never animates and never uses up the home's first growth.
  const growOnce = useGrowOnce(
    compact ? "numa-journal-week" : GROWN_KEY,
    !!entries,
  );
  const growing = !compact && growOnce && !!entries;

  const { width: W, mobile } = size;
  const days = fixedDays ?? (mobile ? 7 : 14);
  const k = compact
    ? mobile
      ? 0.5
      : 0.58
    : mobile
      ? 0.72
      : Math.min(1, Math.max(0.82, W / 1280)); // earlier plants' scale
  const amp = compact
    ? mobile
      ? 9
      : 12
    : Math.min(22, Math.max(9, (19 * W) / 1440)); // ±16–22px at 1440
  const radius = compact ? (mobile ? 22 : 30) : mobile ? 34 : 64;
  const petal = compact ? (mobile ? 9 : 11) : mobile ? 14 : 20; // today's flower radius
  const todayH = compact
    ? mobile
      ? 64
      : 76
    : mobile
      ? 150
      : Math.min(195, Math.max(170, W * 0.15));
  const kind = state?.kind ?? "loading";
  const todayLeafLength = compact
    ? mobile
      ? 17
      : 21
    : mobile
      ? 30
      : Math.min(52, todayH * 0.27);
  // Today's plant (leaves included) stays inside the content column.
  const reach =
    kind === "done" || kind === "in_progress"
      ? Math.max(petal, todayLeafLength * 0.92)
      : 8;
  const stemX = W - reach - 2;
  const waveEnd = stemX - radius;

  // Several entries today: today's plant is the newest one; up to 3 small
  // sprouts beside it stand for the others (never more, however many there are).
  const now = new Date();
  const todaysSaved = (entries ?? [])
    .filter((e) => e.saved && localDayKey(e.created_at) === localDayKey(now))
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  const extras =
    state?.kind === "done"
      ? todaysSaved.filter((e) => e.id !== state.entry.id).slice(0, 3)
      : [];
  const sproutGap = compact ? 12 : mobile ? 14 : 20;

  // Earlier days fill the line up to just before the turn.
  const start = mobile ? 8 : 12;
  const slot =
    (waveEnd - start - (mobile ? 26 : 44) - extras.length * sproutGap) /
    (days - 1);
  const byDay = new Map<string, Entry[]>();
  for (const e of entries ?? [])
    if (e.saved) {
      const key = localDayKey(e.created_at);
      byDay.set(key, [...(byDay.get(key) ?? []), e]);
    }
  const plantById = new Map(plantsFrom(entries ?? []).map((p) => [p.id, p]));
  const placed: PlacedPlant[] = [];
  const bursts: { c: number; s: number; w: number }[] = [];
  for (let i = 0; i < days - 1; i++) {
    const date = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - (days - 1 - i),
    );
    const centre = start + (i + 0.5) * slot;
    const list = (byDay.get(localDayKey(date)) ?? [])
      .sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      )
      .slice(-3);
    list.forEach((entry, j) => {
      const plant = plantById.get(entry.id);
      if (!plant) return;
      const shape = pastPlantShape(entry.id, plant.kind, k, slot);
      const group = (j - (list.length - 1) / 2) * Math.min(12, slot * 0.2); // slight overlap
      const x =
        centre +
        shape.offset * 0.6 * slot * (list.length > 1 ? 0.4 : 1) +
        group;
      placed.push({
        id: entry.id,
        plant,
        x,
        h: shape.h,
        tilt: shape.tilt,
        leaf: shape.leaf,
        sway: shape.sway,
      });
      bursts.push({ c: x, s: shape.burstSigma, w: shape.burstWeight });
    });
  }
  // Today's voice: one burst just before the line turns into today's plant.
  if (kind === "done" || kind === "in_progress")
    bursts.push({ c: waveEnd - (mobile ? 30 : 46), s: mobile ? 9 : 14, w: 1 });
  // Today's other entries: small sprouts (40–60px) on the same stretch of line.
  const sprouts = extras.map((entry, i) => {
    const h = hashString(entry.id);
    const unit = (shift: number, span: number) =>
      ((h >>> shift) % (span + 1)) / span;
    const x = waveEnd - (mobile ? 20 : 30) - i * sproutGap;
    bursts.push({ c: x, s: sproutGap * 0.45, w: 0.85 });
    return {
      id: entry.id,
      x,
      h: (40 + 20 * unit(4, 30)) * (compact ? 0.55 : mobile ? 0.8 : 1),
      tilt: -5 + 10 * unit(9, 20),
      leaf: (compact ? 13 : mobile ? 16 : 22) * (0.85 + 0.3 * unit(13, 30)),
      sway: (unit(17, 8) - 0.5) * 4,
      hue: h % 3,
    };
  });

  // The SVG is exactly as tall as what grows in it.
  const pastTop = placed.reduce((m, p) => Math.max(m, p.h + p.leaf * 0.4), 0);
  const todayTop =
    kind === "done"
      ? todayH + petal
      : kind === "in_progress"
        ? todayH * 0.72 + 8
        : radius + 10;
  const axis = Math.ceil(Math.max(pastTop, todayTop) + 8);
  const height = Math.ceil(axis + amp + 6);

  const wave =
    W > 0 && entries
      ? voiceWave({
          to: waveEnd,
          axis,
          amp,
          wavelength: Math.max(10, (16 * W) / 1280),
          rand: mulberry32(20261114),
          envelope: (x) => gaussianEnvelope(bursts, x),
        })
      : ([
          [0, axis],
          [waveEnd, axis],
        ] as Pt[]);
  const turn: Cubic = [
    [waveEnd, axis],
    [waveEnd + radius * 0.55, axis],
    [stemX, axis - radius * 0.45],
    [stemX, axis - radius],
  ];
  const stemTop = axis - (kind === "in_progress" ? todayH * 0.72 : todayH);
  const sway = mobile ? 4 : 9;
  const stem: Cubic = [
    [stemX, axis - radius],
    [stemX, axis - radius - (axis - radius - stemTop) * 0.4],
    [stemX - sway, stemTop + (axis - radius - stemTop) * 0.35],
    [stemX + sway * 0.3, stemTop],
  ];
  const hasStem = kind === "done" || kind === "in_progress";
  const d =
    `M${r1(wave[0][0])} ${r1(wave[0][1])}` +
    catmullRom(wave) +
    cubicD(turn) +
    (hasStem ? cubicD(stem) : "");

  const stemPoints = sampleCubic(stem);
  const onStem = (y: number) =>
    stemPoints.reduce((a, b) =>
      Math.abs(b[1] - y) < Math.abs(a[1] - y) ? b : a,
    );
  const todayLeaves =
    kind === "done"
      ? [0.24, 0.4, 0.55, 0.68, 0.8]
      : kind === "in_progress"
        ? [0.34, 0.56]
        : [];
  const todaySeed = hashString(
    state && state.kind !== "pending" ? state.entry.id : "today",
  );

  const count = placed.length;
  const todayCount = todaysSaved.length;
  const daysWithEntry = Array.from({ length: days }, (_, i) =>
    localDayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)),
  ).filter((key) => byDay.has(key)).length;
  const label = compact
    ? `This week: ${daysWithEntry} of the last ${days} days ${daysWithEntry === 1 ? "has" : "have"} an entry.`
    : `Your garden over the last ${mobile ? "seven days" : "two weeks"}: ` +
      (count
        ? `${count} small ${count === 1 ? "plant" : "plants"} on earlier days, one for each entry you saved. `
        : "no plants on earlier days yet. ") +
      (kind === "done"
        ? `Today, ${todayCount} ${todayCount === 1 ? "entry" : "entries"}: your plant has flowered` +
          (sprouts.length
            ? `, with ${sprouts.length} small ${sprouts.length === 1 ? "sprout" : "sprouts"} beside it.`
            : ".")
        : kind === "in_progress"
          ? "Today, a young plant: your entry is not saved yet."
          : "Today, a seed waits for an entry.");

  return (
    <div className="gh-garden-art" ref={box}>
      {W > 0 && (
        <svg
          width={W}
          height={height}
          viewBox={`0 0 ${r1(W)} ${height}`}
          role="img"
          aria-label={label}
          className={growing ? "is-growing" : undefined}
        >
          <path
            key={wave.length > 2 ? "voice" : "waiting"}
            className="gh-line"
            d={d}
            pathLength={1}
          />
          {placed.map((p) => (
            <g
              key={p.id}
              transform={`translate(${r1(p.x)} ${r1(axis)}) rotate(${r1(p.tilt)})`}
            >
              <g
                className="gh-plant"
                style={
                  {
                    "--d": `${Math.max(0, traceDelay((p.x / W) * 0.8) - 0.1).toFixed(2)}s`,
                  } as CSSProperties
                }
              >
                <PastPlant
                  kind={p.plant.kind}
                  h={p.h}
                  hue={p.plant.hue}
                  leaf={p.leaf}
                  sway={p.sway}
                />
              </g>
            </g>
          ))}
          {sprouts.map((s) => (
            <g
              key={s.id}
              transform={`translate(${r1(s.x)} ${r1(axis)}) rotate(${r1(s.tilt)})`}
            >
              <g
                className="gh-plant"
                style={
                  {
                    "--d": `${Math.max(0, traceDelay((s.x / W) * 0.8) - 0.1).toFixed(2)}s`,
                  } as CSSProperties
                }
              >
                <PastPlant
                  kind="sprout"
                  h={s.h}
                  hue={s.hue}
                  leaf={s.leaf}
                  sway={s.sway}
                />
              </g>
            </g>
          ))}
          {todayLeaves.map((f, i) => {
            const [x, y] = onStem(axis - todayH * f);
            return (
              <LeafAt
                key={f}
                x={x}
                y={y}
                side={i % 2 ? -1 : 1}
                length={todayLeafLength * (1 - i * 0.07)}
                tone={LEAF_TONES[(todaySeed + i) % 3]}
                tilt={-16 + (((todaySeed >>> (i * 3)) % 7) - 3)}
                className="gh-unfurl"
                style={{ "--i": i } as CSSProperties}
              />
            );
          })}
          {kind === "done" && (
            <g transform={`translate(${r1(stem[3][0])} ${r1(stemTop)})`}>
              <g className="gh-bloom">
                <Bloom r={petal} petal="var(--n-apricot)" />
              </g>
            </g>
          )}
          {kind === "pending" && (
            <ellipse
              className="gh-seed"
              cx={r1(stemX)}
              cy={r1(axis - radius - 4)}
              rx="6"
              ry="4"
              fill="var(--n-natural)"
              transform={`rotate(-30 ${r1(stemX)} ${r1(axis - radius - 4)})`}
            />
          )}
        </svg>
      )}
    </div>
  );
}

/* ───────────────────────── Home ───────────────────────── */

export function GardenHome({
  user,
  entries,
  error,
}: {
  user: User;
  entries: Entry[] | null;
  error: string;
}) {
  const { growth } = useGrowth();
  const simple = !!growth?.simple_mode;
  const sample = user.source === "simulated";
  const state = entries ? todayState(entries) : null;
  const saved = savedNewestFirst(entries ?? []);
  const tended = daysTended(entries ?? []);
  const helped = saved.filter((e) => e.action?.feedback === "helpful").length;
  const latest = saved[0];
  const first = user.name.split(" ")[0];
  const lede =
    state?.kind === "done"
      ? "Your garden has had a little water today."
      : state?.kind === "in_progress"
        ? "Your garden is keeping your place."
        : entries && !saved.length
          ? "Your garden is ready for its first seed."
          : "Your garden has been waiting.";
  return (
    <div className={"garden-home" + (simple ? " is-simple" : "")}>
      <section
        className="garden-hero gh-wrap"
        aria-labelledby="garden-greeting"
      >
        <p className="garden-date">{longDate(new Date())}</p>
        <h1 id="garden-greeting">So good to see you, {first}.</h1>
        <p className="garden-lede">{lede}</p>
        <ErrorNotice message={error} />
      </section>
      <section className="gh-garden gh-wrap" aria-label="Your garden and today">
        <VoiceGarden entries={entries} state={state} />
        <div className="gh-under">
          <span className="gh-start-label" aria-hidden="true">
            <span className="gh-wide-only">Two weeks ago</span>
            <span className="gh-narrow-only">This week</span>
          </span>
          <TodayAction state={state} sample={sample} />
        </div>
        {simple && (
          <p className="gh-simple-note">
            Your entries and choices are kept. You can return to your fuller
            space whenever you want.
          </p>
        )}
      </section>
      {!simple && entries && (
        <section className="gh-earth" aria-label="Your latest entry">
          <div className="gh-wrap gh-earth-grid">
            <article className="gh-sheet">
              {latest ? (
                <>
                  <p className="gh-sheet-kicker">
                    {isToday(latest.created_at)
                      ? "Today’s entry"
                      : "Your latest entry"}{" "}
                    <time dateTime={latest.created_at}>
                      {shortDate(latest.created_at)}
                    </time>
                  </p>
                  <h2 className="gh-reflection">{reflectionFor(latest)}</h2>
                  <h3>{latest.title}</h3>
                  {latest.summary && (
                    <p className="gh-summary">{latest.summary}</p>
                  )}
                  <Link
                    className="gh-sheet-link"
                    to={"/patient/entries/" + latest.id}
                  >
                    Open this entry
                  </Link>
                </>
              ) : (
                <p className="gh-reflection">
                  Your first entry will rest here, with a few words just for
                  you.
                </p>
              )}
            </article>
            <div className="gh-growth">
              <h2>How your garden is growing</h2>
              <p>
                {saved.length
                  ? `${saved.length} ${saved.length === 1 ? "entry" : "entries"} planted so far. Over the last two weeks ${rhythmPhrase(tended)}${
                      helped > 0
                        ? `, and ${helped === 1 ? "once" : helped + " times"} something helped.`
                        : "."
                    }`
                  : "Nothing planted yet. Your first entry starts the garden."}
              </p>
              <div className="gh-growth-links">
                <Link to="/patient/journal">Read your journal</Link>
                <Link to="/patient/garden">Visit my garden</Link>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

/* ───────────────────────── Journal (log) ───────────────────────── */

/** The first line of the person's own words, if there are any. */
const firstLine = (text: string | null | undefined) =>
  (text ?? "").trim().split(/\n+/)[0]?.trim() ?? "";

export function JournalLog({
  entries,
  error,
  sample,
}: {
  entries: Entry[] | null;
  error: string;
  sample: boolean;
}) {
  const sorted = [...(entries ?? [])].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const months: { label: string; items: Entry[] }[] = [];
  for (const e of sorted) {
    const label = new Date(e.created_at).toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric",
    });
    if (months.at(-1)?.label !== label) months.push({ label, items: [] });
    months.at(-1)!.items.push(e);
  }
  const state = entries ? todayState(entries) : null;
  return (
    <div className="jl-page">
      <div className="jl-wrap">
        <nav className="jl-back" aria-label="Back">
          <Link to="/patient/garden">My garden</Link>
        </nav>
        <header className="jl-head">
          <h1>Journal</h1>
          <p>Every entry you’ve planted, newest first.</p>
        </header>
        <ErrorNotice message={error} />
        {!entries ? (
          <Loading />
        ) : sorted.length === 0 ? (
          <div className="jl-empty">
            <p>Your journal is waiting for its first entry.</p>
            {!sample && (
              <Link className="ep-primary" to="/patient/new">
                Add an entry
              </Link>
            )}
          </div>
        ) : (
          <>
            <section className="jl-week" aria-label="This week">
              <VoiceGarden entries={entries} state={state} days={7} compact />
              <div className="jl-week-labels" aria-hidden="true">
                <span>This week</span>
                <span>Today</span>
              </div>
            </section>
            {months.map((month) => (
              <section
                key={month.label}
                className="jl-month"
                aria-label={month.label}
              >
                <h2>{month.label}</h2>
                <ol className="jl-list">
                  {month.items.map((e) => {
                    const today = isToday(e.created_at);
                    const busy = ["pending", "processing"].includes(e.status);
                    const words = firstLine(e.transcript);
                    const meta = busy
                      ? "Still listening"
                      : !e.saved
                        ? "Draft, not saved yet"
                        : e.action?.feedback === "helpful"
                          ? "Something helped"
                          : "";
                    return (
                      <li key={e.id}>
                        <Link
                          to={"/patient/entries/" + e.id}
                          className={
                            "log-entry jl-row" +
                            (today ? " is-today" : "") +
                            (e.saved ? "" : " is-draft")
                          }
                        >
                          <span className="jl-date">
                            <time dateTime={e.created_at}>
                              {today ? "Today" : shortDate(e.created_at)}
                            </time>
                          </span>
                          <span className="jl-plant">
                            <EntryPlant entry={e} glyph decorative />
                          </span>
                          <span className="jl-body">
                            <span className="jl-title">
                              {busy ? "Listening to your day…" : e.title}
                            </span>
                            {!busy && (
                              <span className="jl-reflection">
                                {reflectionFor(e)}
                              </span>
                            )}
                            {words && (
                              <span className="jl-quote">{words}</span>
                            )}
                            {meta && (
                              <span className="jl-meta">
                                {meta === "Something helped" && (
                                  <Sprout size={14} aria-hidden="true" />
                                )}
                                {meta}
                              </span>
                            )}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              </section>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── My garden ───────────────────────── */

function WeeksMeadow({
  entries,
  animate,
}: {
  entries: Entry[];
  animate: boolean;
}) {
  const now = new Date();
  const monday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - ((now.getDay() + 6) % 7),
  );
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const start = new Date(
      monday.getFullYear(),
      monday.getMonth(),
      monday.getDate() - (7 - i) * 7,
    );
    const end = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate() + 7,
    );
    const count = entries.filter(
      (e) =>
        e.saved &&
        new Date(e.created_at) >= start &&
        new Date(e.created_at) < end,
    ).length;
    return {
      key: localDayKey(start),
      label: start.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
      }),
      count,
      visible: i % 2 === 1,
    };
  });
  const reduced = useReducedMotion();
  return (
    <figure className="meadow">
      <svg
        viewBox="0 0 320 120"
        aria-hidden="true"
        preserveAspectRatio="xMidYMax meet"
      >
        <path
          d="M0 104 C80 98 160 106 240 100 C280 98 300 101 320 100 V120 H0Z"
          fill="var(--g-ground)"
        />
        {weeks.map((w, i) => {
          const x = 20 + i * 40;
          const h = w.count ? 18 + Math.min(w.count, 7) * 10 : 4;
          return (
            <g key={w.key} transform={`translate(${x} 102)`}>
              <motion.g
                style={{ transformBox: "fill-box", originY: 1 }}
                {...(!animate || reduced
                  ? {}
                  : {
                      initial: { scaleY: 0 },
                      whileInView: { scaleY: 1 },
                      viewport: { once: true },
                      transition: {
                        duration: 1.4,
                        delay: i * 0.08,
                        ease: [0.22, 1, 0.36, 1],
                      },
                    })}
              >
                <path
                  d={`M0 0 C2 ${-h / 3} -2 ${(-2 * h) / 3} 0 ${-h}`}
                  stroke="var(--g-stem)"
                  strokeWidth="1.8"
                  fill="none"
                  strokeLinecap="round"
                />
                {Array.from({ length: Math.min(w.count, 7) }, (_, j) => (
                  <ellipse
                    key={j}
                    cx={j % 2 ? 5 : -5}
                    cy={-12 - j * 10}
                    rx="5.5"
                    ry="2.4"
                    fill={LEAF[j % 3]}
                    transform={`rotate(${j % 2 ? -25 : 25} ${j % 2 ? 5 : -5} ${-12 - j * 10})`}
                  />
                ))}
                {w.count === 0 && (
                  <circle cx="0" cy="-2" r="2.5" fill="var(--g-clay)" />
                )}
              </motion.g>
            </g>
          );
        })}
      </svg>
      <div className="meadow-labels" aria-hidden="true">
        {weeks.map((w) => (
          <span key={w.key}>{w.visible ? w.label : ""}</span>
        ))}
      </div>
      <figcaption>
        Each stem is a week; every leaf is an entry.
        <ul className="visually-hidden">
          {weeks.map((w) => (
            <li key={w.key}>
              Week of {w.label}: {w.count} {w.count === 1 ? "entry" : "entries"}
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}

export function MyGarden({
  user,
  entries,
  insights,
  error,
}: {
  user: User;
  entries: Entry[] | null;
  insights: Insights | null;
  error: string;
}) {
  const { growth, update, busy, error: growthError } = useGrowth();
  const navigate = useNavigate();
  const grow = useGrowOnce("numa-my-garden-grown", !!growth && !!entries);
  if (!growth || !entries)
    return (
      <>
        <ErrorNotice message={error || growthError} />
        {!(error || growthError) && <Loading />}
      </>
    );
  const simple = growth.simple_mode;
  const saved = savedNewestFirst(entries);
  const tended = daysTended(entries);
  const plants = plantsFrom(entries);
  const invitation = !simple ? growth.invitations[0] : undefined;
  const contextModules = growth.modules.filter((m) =>
    ["sleep", "activity", "music"].includes(m),
  );
  const canExplore =
    !simple &&
    (growth.modules.includes("patterns") || growth.modules.includes("voice"));
  return (
    <div className="my-garden">
      <header className="garden-page-heading">
        <h1>My garden</h1>
        <p>
          {saved.length
            ? `${saved.length} ${saved.length === 1 ? "plant" : "plants"} so far — ${rhythmPhrase(tended)} lately.`
            : "A quiet place to watch your journal grow."}
        </p>
      </header>
      <ErrorNotice message={error || growthError} />
      <section className="garden-panel" aria-label="Your whole garden">
        <Garden
          plants={plants}
          label={gardenLabel(saved.length)}
          className="garden-wide"
          animate={grow}
        />
      </section>

      <section className="garden-section" aria-labelledby="over-time">
        <h2 id="over-time">Over time</h2>
        <WeeksMeadow entries={entries} animate={grow} />
      </section>

      <section className="garden-section" aria-labelledby="recent">
        <h2 id="recent">Recent entries</h2>
        {saved.length ? (
          <ul className="recent-list">
            {saved.slice(0, 3).map((e) => (
              <li key={e.id}>
                <Link to={"/patient/entries/" + e.id}>
                  <span className="soft-date">{longDate(e.created_at)}</span>
                  <span className="reflection">{reflectionFor(e)}</span>
                  <span className="recent-title">{e.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="garden-empty">Your reflections will gather here.</p>
        )}
        <Link className="text-link" to="/patient/journal">
          Read your whole journal <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </section>

      {invitation && (
        <section
          className="garden-section growth-invitation"
          aria-labelledby="invitation"
        >
          <h2 id="invitation">{invitation.title}</h2>
          <p>{invitation.text}</p>
          <div className="invitation-choices">
            <button
              className="text-link"
              disabled={busy}
              onClick={async () => {
                if (
                  await update({
                    modules: [
                      ...new Set([...growth.modules, invitation.module]),
                    ],
                    dismiss_invitation: invitation.id,
                  })
                )
                  navigate("/patient/insights");
              }}
            >
              Explore this pattern <ArrowRight size={15} />
            </button>
            <button
              className="quiet-button"
              disabled={busy}
              onClick={() => void update({ dismiss_invitation: invitation.id })}
            >
              Not now
            </button>
          </div>
        </section>
      )}

      {!simple && growth.modules.includes("habits") && growth.habit_label && (
        <section
          className="garden-section habit-today"
          aria-labelledby="intention"
        >
          <div>
            <h2 id="intention">{growth.habit_label}</h2>
            <p>Optional, every time. A missed day takes nothing away.</p>
          </div>
          <button
            className={
              "button outline " + (growth.habit_done_today ? "habit-done" : "")
            }
            disabled={busy}
            aria-pressed={growth.habit_done_today}
            onClick={() =>
              void update({ habit_done: !growth.habit_done_today })
            }
          >
            {growth.habit_done_today ? (
              <>
                <Check size={16} /> Noted for today
              </>
            ) : (
              "I made room for this"
            )}
          </button>
        </section>
      )}

      {!simple && contextModules.length > 0 && insights && (
        <section className="garden-section" aria-labelledby="around">
          <h2 id="around">Around your days</h2>
          <p className="garden-note">
            Only the context you chose · simulated data.
          </p>
          <ContextCards context={insights.context} modules={contextModules} />
        </section>
      )}

      <section className="garden-section tend-space" aria-labelledby="tend">
        <h2 id="tend">Tend your space</h2>
        <p>Add or put away small windows, whenever you feel curious.</p>
        <div className="tend-links">
          <Link className="text-link" to="/patient/space">
            <Settings2 size={16} aria-hidden="true" /> Your space
          </Link>
          {canExplore && (
            <Link className="text-link" to="/patient/insights">
              <Sprout size={16} aria-hidden="true" /> What helps
            </Link>
          )}
        </div>
        <SimpleModeControl />
        {simple && (
          <p className="garden-note">
            Simple view is on. Your pages and choices are kept for whenever you
            want to return.
          </p>
        )}
      </section>
      {user.source === "simulated" && (
        <p className="garden-note">This is a fictional sample garden.</p>
      )}
    </div>
  );
}
