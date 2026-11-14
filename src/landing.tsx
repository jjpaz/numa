// The public home page ("/"). One idea: the voice becomes a plant.
import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { Wordmark } from "./components";

/* ───────── Deterministic, smooth voice trace ───────── */

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Pt = [number, number];
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Catmull-Rom through the points, emitted as cubic béziers: smooth, no corners. */
function catmullRom(points: Pt[]) {
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
function cubicAt(p: [Pt, Pt, Pt, Pt], t: number): Pt {
  const u = 1 - t;
  const k = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  return [
    k[0] * p[0][0] + k[1] * p[1][0] + k[2] * p[2][0] + k[3] * p[3][0],
    k[0] * p[0][1] + k[1] * p[1][1] + k[2] * p[2][1] + k[3] * p[3][1],
  ];
}
const sampleCubic = (p: [Pt, Pt, Pt, Pt], n = 48) =>
  Array.from({ length: n + 1 }, (_, i) => cubicAt(p, i / n));
const lengthOf = (pts: Pt[]) =>
  pts.reduce(
    (sum, pt, i) =>
      i ? sum + Math.hypot(pt[0] - pts[i - 1][0], pt[1] - pts[i - 1][1]) : 0,
    0,
  );
const cubicD = (p: [Pt, Pt, Pt, Pt]) =>
  ` C${p
    .slice(1)
    .map(([x, y]) => `${r1(x)} ${r1(y)}`)
    .join(" ")}`;

// Speech bursts as Gaussian envelopes: centre and width as fractions of the wave, peak weight.
// The strongest burst sits in the open stretch between the words and the plant.
const BURSTS = [
  { c: 0.07, s: 0.03, w: 0.55 },
  { c: 0.28, s: 0.036, w: 0.62 },
  { c: 0.47, s: 0.026, w: 0.45 },
  { c: 0.7, s: 0.055, w: 1 },
  { c: 0.88, s: 0.03, w: 0.6 },
];

interface Measure {
  width: number; // stage width (px)
  contentRight: number; // right edge of the text column
  baseline: number; // baseline of "come later." from the stage top
  firstLine: number; // vertical centre of the first headline line
  lines: { left: number; right: number; top: number; bottom: number }[];
}
interface Leaf {
  x: number;
  y: number;
  side: 1 | -1;
  angle: number;
  scale: number;
  fill: string;
}
interface Geometry {
  width: number;
  height: number;
  d: string;
  stemShare: number;
  leaves: Leaf[];
  leafLength: number;
  flower: Pt;
  petal: number;
  padBottom: number;
}

const LEAF_FILLS = [
  "var(--n-sage)",
  "var(--n-natural)",
  "var(--n-moss)",
  "var(--n-sage)",
  "var(--n-natural)",
];

/** Everything in CSS pixels: 1 SVG unit = 1px, so stroke and amplitude are exact. */
function buildGeometry(m: Measure, contentTop: number): Geometry {
  const rand = mulberry32(20261114);
  const mobile = m.width <= 720;
  const amp = Math.max(9, (28 * m.width) / 1440); // ±28px at 1440, scaled to width
  const axis = m.baseline + 14; // the headline rests 14px above the wave
  const petal = mobile ? 12 : Math.min(30, Math.max(20, m.width * 0.019));
  const edge = mobile ? 24 : 64; // flower keeps its distance from the viewport edge
  const stemX = Math.min(m.contentRight, m.width - edge) - petal - 4; // 4 = stem sway
  const top = mobile ? Math.min(m.firstLine, axis - 150) : m.firstLine;
  const radius = mobile ? 36 : Math.min(110, Math.max(64, m.width * 0.065));
  const waveEnd = stemX - radius;

  // Wave: a carrier with gentle frequency drift, a fresh amplitude every half
  // cycle (it changes at zero crossings, so the curve stays continuous) and
  // Gaussian envelopes per burst. Pauses keep only a micro-undulation.
  const wavelength = Math.max(11, (22 * m.width) / 1440);
  const step = wavelength / 6;
  const halfAmps = Array.from(
    { length: Math.ceil((waveEnd / wavelength) * 2) + 4 },
    () => 0.45 + 0.55 * rand(),
  );
  // Under the last headline line, crests rise at most ~9px (soft limit) so the
  // words can rest 14px above the axis; troughs and other stretches keep ±amp.
  const last = m.lines[m.lines.length - 1];
  const ceiling = 9;
  const underText = (x: number) => {
    if (!last) return 0;
    const ramp = 40;
    return Math.max(
      0,
      Math.min(
        1,
        (x - last.left + ramp) / ramp,
        (last.right + ramp - x) / ramp,
      ),
    );
  };
  const wave: Pt[] = [];
  for (let x = 0; x <= waveEnd; x += step) {
    const f = x / waveEnd;
    let env = 0;
    for (const b of BURSTS)
      env += b.w * Math.exp(-0.5 * ((f - b.c) / b.s) ** 2);
    env = Math.min(1, env);
    const drift =
      x + wavelength * 0.12 * Math.sin((2 * Math.PI * x) / (wavelength * 11));
    const half = Math.floor(drift / (wavelength / 2));
    const carrier = Math.sin((2 * Math.PI * drift) / wavelength);
    const breath = 0.6 * Math.sin((2 * Math.PI * x) / (wavelength * 7)); // micro-undulation
    const fade = Math.min(1, (waveEnd - x) / (wavelength * 2)); // settle before the stem
    let lift = (amp * env * halfAmps[half] * carrier + breath) * fade; // + is upwards
    const t = underText(x);
    if (lift > 0 && t > 0)
      lift = (1 - t) * lift + t * ceiling * Math.tanh(lift / ceiling);
    wave.push([x, axis - lift]);
  }
  wave.push([waveEnd, axis]);

  // A wide, continuous turn (a quarter-ellipse), then the stem with a slight sway.
  const turn: [Pt, Pt, Pt, Pt] = [
    [waveEnd, axis],
    [waveEnd + radius * 0.55, axis],
    [stemX, axis - radius * 0.45],
    [stemX, axis - radius],
  ];
  const sway = mobile ? 4 : 10;
  const stem: [Pt, Pt, Pt, Pt] = [
    [stemX, axis - radius],
    [stemX, axis - radius - (axis - radius - top) * 0.4],
    [stemX - sway, top + (axis - radius - top) * 0.35],
    [stemX + sway * 0.3, top],
  ];
  const waveLength = lengthOf(wave);
  const stemPoints = sampleCubic(stem);
  const stemLength = lengthOf(sampleCubic(turn)) + lengthOf(stemPoints);
  const d =
    `M${r1(wave[0][0])} ${r1(wave[0][1])}` +
    catmullRom(wave) +
    cubicD(turn) +
    cubicD(stem);

  // Five alternate leaves, ~20% larger than before, each with its own small tilt.
  const stemHeight = axis - top;
  let leafLength = mobile ? 34 : stemHeight * 0.27;
  if (mobile) {
    // never let a left leaf reach the words
    const clearance = Math.min(
      ...m.lines
        .filter((l) => l.bottom > top && l.top < axis)
        .map((l) => stemX - l.right - 10),
      Infinity,
    );
    leafLength = Math.max(20, Math.min(leafLength, clearance / 0.9));
  }
  const fractions = [0.2, 0.36, 0.52, 0.66, 0.79];
  const leaves: Leaf[] = fractions.map((f, i) => {
    const y = axis - stemHeight * f;
    const nearest = stemPoints.reduce((a, b) =>
      Math.abs(b[1] - y) < Math.abs(a[1] - y) ? b : a,
    );
    return {
      x: nearest[0],
      y,
      side: i % 2 ? -1 : 1,
      angle: -16 + (rand() - 0.5) * 14,
      scale: 1 - i * 0.075,
      fill: LEAF_FILLS[i],
    };
  });

  const below = axis + amp + 32; // lede sits ~32px under the wave
  return {
    width: m.width,
    height: below,
    d,
    stemShare: stemLength / (waveLength + stemLength),
    leaves,
    leafLength,
    flower: [stemX + sway * 0.3, top],
    petal,
    padBottom: Math.max(0, below - contentTop),
  };
}

function useHeroGeometry() {
  const stage = useRef<HTMLDivElement>(null),
    title = useRef<HTMLHeadingElement>(null),
    probe = useRef<HTMLSpanElement>(null);
  const [geometry, setGeometry] = useState<Geometry | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const s = stage.current,
        h = title.current,
        b = probe.current;
      if (!s || !h || !b) return;
      const sr = s.getBoundingClientRect(),
        hr = h.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(h);
      const lines = [...range.getClientRects()]
        .filter((r) => r.width > 1)
        .map((r) => ({
          left: r.left - sr.left,
          right: r.right - sr.left,
          top: r.top - sr.top,
          bottom: r.bottom - sr.top,
        }));
      const style = getComputedStyle(h);
      const next = buildGeometry(
        {
          width: sr.width,
          contentRight: hr.right - sr.left - parseFloat(style.paddingRight),
          baseline: b.getBoundingClientRect().top - sr.top,
          firstLine: lines.length
            ? (lines[0].top + lines[0].bottom) / 2
            : hr.top - sr.top,
          lines,
        },
        hr.bottom - sr.top,
      );
      setGeometry((prev) =>
        prev && prev.d === next.d && prev.padBottom === next.padBottom
          ? prev
          : next,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (stage.current) observer.observe(stage.current);
    void document.fonts?.ready.then(measure); // Young Serif changes the metrics
    return () => observer.disconnect();
  }, []);
  return { stage, title, probe, geometry };
}

const LEAF = "M0 0 C12 -19 40 -30 70 -21 C53 -2 26 7 0 0Z"; // 70 units long

function VoiceToPlant({ g }: { g: Geometry }) {
  const leafScale = g.leafLength / 70;
  return (
    <svg
      className="landing-voice"
      width={g.width}
      height={g.height}
      viewBox={`0 0 ${g.width} ${g.height}`}
      aria-hidden="true"
      focusable="false"
    >
      <path
        className="voice-line"
        d={g.d}
        pathLength={1}
        style={{ "--stem-share": g.stemShare.toFixed(3) } as CSSProperties}
      />
      {g.leaves.map((leaf, i) => (
        <g
          key={i}
          transform={`translate(${r1(leaf.x + leaf.side * 1)} ${r1(leaf.y)}) scale(${r1(leaf.side * leaf.scale * leafScale * 100) / 100} ${r1(leaf.scale * leafScale * 100) / 100}) rotate(${r1(leaf.angle)})`}
        >
          <path
            className="voice-leaf"
            d={LEAF}
            fill={leaf.fill}
            style={{ "--i": i } as CSSProperties}
          />
        </g>
      ))}
      <g transform={`translate(${r1(g.flower[0])} ${r1(g.flower[1])})`}>
        <g className="voice-flower">
          {Array.from({ length: 6 }, (_, i) => (
            <ellipse
              key={i}
              cx="0"
              cy={-g.petal * 0.5}
              rx={g.petal * 0.28}
              ry={g.petal * 0.5}
              fill="var(--n-apricot)"
              transform={`rotate(${i * 60})`}
            />
          ))}
          <circle r={g.petal * 0.24} fill="var(--n-ivory)" />
        </g>
      </g>
    </svg>
  );
}

/* ───────── Small plant glyphs for the example pages ───────── */

function PlantGlyph({ stage }: { stage: "sprout" | "leaves" | "bloom" }) {
  return (
    <svg
      className="page-glyph"
      viewBox="0 0 48 56"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M8 52 H40"
        stroke="var(--n-natural)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d={
          stage === "sprout"
            ? "M24 52 C25 46 23 42 24 36"
            : "M24 52 C26 40 21 28 24 14"
        }
        stroke="var(--n-moss)"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M24 42 C17 42 13 37 13 33 C19 33 23 37 24 42Z"
        fill="var(--n-sage)"
      />
      <path
        d="M24 38 C30 38 34 33 34 29 C28 29 25 33 24 38Z"
        fill="var(--n-moss)"
      />
      {stage !== "sprout" && (
        <>
          <path
            d="M24 30 C17 29 14 24 14 20 C20 20 23 25 24 30Z"
            fill="var(--n-natural)"
          />
          <path
            d="M24 24 C30 23 33 18 33 14 C27 15 24 19 24 24Z"
            fill="var(--n-sage)"
          />
        </>
      )}
      {stage === "bloom" && (
        <g transform="translate(24 11)">
          {Array.from({ length: 6 }, (_, i) => (
            <ellipse
              key={i}
              cy="-4"
              rx="2.6"
              ry="4.4"
              fill="var(--n-apricot)"
              transform={`rotate(${i * 60})`}
            />
          ))}
          <circle r="2.2" fill="var(--n-ivory)" />
        </g>
      )}
    </svg>
  );
}

const PAGES = [
  {
    date: "3 Oct",
    iso: "2026-10-03",
    quote: "Didn’t feel like talking. Said a few words anyway.",
    noticed: "A first page. Nothing to compare yet.",
    stage: "sprout" as const,
  },
  {
    date: "21 Oct",
    iso: "2026-10-21",
    quote: "Walked to the bakery and back. Slept a little better.",
    noticed: "You’ve said walks helped 4 times.",
    stage: "leaves" as const,
  },
  {
    date: "14 Nov",
    iso: "2026-11-14",
    quote: "Called my sister. A long call, a good one.",
    noticed: "Your pauses were shorter than usual this week.",
    stage: "bloom" as const,
  },
];

export function Landing() {
  const { stage, title, probe, geometry } = useHeroGeometry();
  return (
    <div className="landing">
      <header className="landing-header landing-wrap">
        <Wordmark />
        <Link to="/login/psychologist" className="landing-pro">
          Psychologist sign in
        </Link>
      </header>
      <main>
        <section className="landing-hero" aria-labelledby="landing-title">
          <div
            className="landing-stage"
            ref={stage}
            style={geometry ? { paddingBottom: geometry.padBottom } : undefined}
          >
            <h1
              id="landing-title"
              ref={title}
              className="landing-title landing-wrap"
            >
              Some days,
              <br />
              the words
              <br />
              come later.
              <span
                ref={probe}
                className="landing-baseline"
                aria-hidden="true"
              />
            </h1>
            {geometry && <VoiceToPlant g={geometry} />}
          </div>
          <div className="landing-below landing-wrap">
            <p className="landing-lede">
              Talk for a minute, whenever you like. Numa keeps your words and
              slowly learns what helps you.
            </p>
            <div className="landing-actions">
              <Link to="/login/patient" className="landing-cta">
                Start your journal
              </Link>
              <Link to="/login/patient?sample=1" className="landing-sample">
                Open a sample journal
              </Link>
            </div>
          </div>
        </section>

        <section className="landing-earth" aria-labelledby="landing-pages">
          <div className="landing-wrap">
            <h2 id="landing-pages">One page at a time.</h2>
            <ol className="landing-sheets">
              {PAGES.map((page) => (
                <li key={page.iso} className="landing-sheet">
                  <time dateTime={page.iso}>{page.date}</time>
                  <blockquote>{page.quote}</blockquote>
                  <p className="landing-noticed">
                    <span>Numa noticed</span> {page.noticed}
                  </p>
                  <PlantGlyph stage={page.stage} />
                </li>
              ))}
            </ol>
            <p className="landing-fiction">
              Example pages from a fictional journal.
            </p>
          </div>
        </section>

        <section className="landing-privacy landing-wrap" aria-label="Privacy">
          <div>
            <h2>What stays yours</h2>
            <p>
              Recordings are processed, then discarded. Your words stay in your
              journal.
            </p>
          </div>
          <div>
            <h2>What your psychologist sees</h2>
            <p>
              Trends and the activities you mark as helpful. Never your entries.
            </p>
          </div>
        </section>
      </main>
      <footer className="landing-footer landing-wrap">
        <p>
          Numa is a Junction 2026 prototype. Not a medical device or a
          diagnosis.
        </p>
      </footer>
    </div>
  );
}
