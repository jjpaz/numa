// The login page's motif: a short stretch of the voice line that ends in a
// plant (a seed for a new journal, a flowering plant for the sample). It keeps
// the original identity of the public pages; the patient portal draws its own
// garden in src/design/Grass.tsx and Meadow.tsx.
import type { CSSProperties } from "react";
import {
  catmullRom,
  cubicD,
  gaussianEnvelope,
  mulberry32,
  r1,
  sampleCubic,
  voiceWave,
  type Cubic,
} from "./design/voiceLine";

const LEAF_PATH = "M0 0 C12 -19 40 -30 70 -21 C53 -2 26 7 0 0Z"; // 70 units long, as on "/"
const LEAF_TONES = ["var(--n-sage)", "var(--n-natural)", "var(--n-moss)"];

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

/* ───────────────────────── Login motif ───────────────────────── */

/**
 * A short stretch of the voice line that ends in a plant: a seed for a new
 * journal, a flowering plant for the sample. Static and decorative.
 */
export function LoginMotif({ flower }: { flower: boolean }) {
  const W = 520,
    axis = 420,
    radius = 64,
    stemX = 440,
    waveEnd = stemX - radius;
  const wave = voiceWave({
    to: waveEnd,
    axis,
    amp: 26,
    wavelength: 16,
    rand: mulberry32(flower ? 20261113 : 20261112),
    envelope: (x) =>
      gaussianEnvelope(
        [
          { c: 110, s: 34, w: 0.9 },
          { c: 250, s: 26, w: 0.6 },
        ],
        x,
      ),
  });
  const turn: Cubic = [
    [waveEnd, axis],
    [waveEnd + radius * 0.55, axis],
    [stemX, axis - radius * 0.45],
    [stemX, axis - radius],
  ];
  const stemTop = axis - 300;
  const stem: Cubic = [
    [stemX, axis - radius],
    [stemX, axis - radius - (axis - radius - stemTop) * 0.4],
    [stemX - 10, stemTop + (axis - radius - stemTop) * 0.35],
    [stemX + 3, stemTop],
  ];
  const points = sampleCubic(stem);
  const onStem = (y: number) =>
    points.reduce((a, b) => (Math.abs(b[1] - y) < Math.abs(a[1] - y) ? b : a));
  const d =
    `M${r1(wave[0][0])} ${r1(wave[0][1])}` +
    catmullRom(wave) +
    cubicD(turn) +
    (flower ? cubicD(stem) : "");
  return (
    <svg
      className="login-motif"
      viewBox={`0 0 ${W} ${axis + 40}`}
      aria-hidden="true"
    >
      <path className="gh-line" d={d} />
      {flower ? (
        <>
          {[0.26, 0.42, 0.57, 0.7, 0.82].map((f, i) => {
            const [x, y] = onStem(axis - 300 * f);
            return (
              <LeafAt
                key={f}
                x={x}
                y={y}
                side={i % 2 ? -1 : 1}
                length={56 * (1 - i * 0.07)}
                tone={LEAF_TONES[i % 3]}
              />
            );
          })}
          <g transform={`translate(${stem[3][0]} ${stemTop})`}>
            <Bloom r={26} petal="var(--n-apricot)" />
          </g>
        </>
      ) : (
        <ellipse
          cx={stemX}
          cy={axis - radius - 5}
          rx="8"
          ry="5"
          fill="var(--n-natural)"
          transform={`rotate(-30 ${stemX} ${axis - radius - 5})`}
        />
      )}
    </svg>
  );
}
