// The clinician's charts (see DESIGN.md → "Clinic"). Pure SVG drawn from the
// restricted projection (`trend.points`): nothing is invented. The patient's
// VoiceChart in components.tsx is left untouched.
import { useLayoutEffect, useRef, useState } from "react";
import { catmullRom, r1, type Pt } from "./design/voiceLine";
import { dateLabel } from "./api";
import type { Trend } from "./types";

/** Beyond 3 robust deviations a day counts as outside this person's range
 *  (backend/domain.py). The band 0–3 is drawn as "Personal range". */
const RANGE_EDGE = 3;

const rangeWord = (outside: boolean) =>
  outside ? "outside personal range" : "within personal range";

/** 140×32: the recent days of one person, compared only with themselves. */
export function Sparkline({ trend }: { trend: Trend }) {
  const points = trend.points.slice(-14);
  if (!points.length)
    return (
      <span className="cl-spark-empty">
        {trend.days > 0
          ? `Learning, ${trend.days} of ${trend.required_days} days`
          : "No voice entries yet"}
      </span>
    );
  const w = 140,
    h = 32,
    pad = 4;
  const max = Math.max(RANGE_EDGE * 1.6, ...points.map((p) => p.deviation));
  const x = (i: number) =>
    points.length === 1
      ? w / 2
      : pad + (i * (w - 2 * pad)) / (points.length - 1);
  const y = (v: number) => h - pad - (Math.min(v, max) / max) * (h - 2 * pad);
  const pts: Pt[] = points.map((p, i) => [x(i), y(p.deviation)]);
  const d = `M${r1(pts[0][0])} ${r1(pts[0][1])}` + catmullRom(pts);
  const outside = points.filter((p) => p.outside).length;
  return (
    <svg
      className="cl-spark"
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={`Voice, last ${points.length} observation ${points.length === 1 ? "day" : "days"}: ${
        outside ? `${outside} outside` : "none outside"
      } personal range.`}
    >
      <rect
        className="cl-spark-band"
        x={0}
        y={r1(y(RANGE_EDGE))}
        width={w}
        height={r1(y(0) - y(RANGE_EDGE))}
        rx={2}
      />
      <path className="cl-spark-line" d={d} />
      {points.map((p, i) =>
        p.outside ? (
          <circle
            key={p.date + i}
            className="cl-spark-out"
            cx={r1(pts[i][0])}
            cy={r1(pts[i][1])}
            r={2.5}
          />
        ) : null,
      )}
    </svg>
  );
}

/** The protagonist of a person's page: each observation day against their own range. */
export function ObservationChart({ trend }: { trend: Trend }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const ready = trend.ready && trend.points.length > 0;
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setWidth(el.getBoundingClientRect().width);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ready]);

  const points = trend.points;
  if (!ready)
    return (
      <p className="cl-chart-empty">
        {trend.days > 0
          ? `Learning this person’s range: ${trend.days} of ${trend.required_days} observation days so far. Nothing is compared until the baseline is complete.`
          : "No voice observations yet. Written entries carry no vocal signal, so there is nothing to compare."}
      </p>
    );

  const narrow = width < 560;
  const H = narrow ? 240 : 280;
  const left = 8,
    right = 12,
    top = 40,
    bottom = 76;
  const n = points.length;
  const plotW = Math.max(1, width - left - right);
  const plotH = H - top - bottom;
  const maxDev =
    Math.max(RANGE_EDGE * 1.8, ...points.map((p) => p.deviation)) * 1.08;
  const x = (i: number) => left + (n === 1 ? plotW / 2 : (i * plotW) / (n - 1));
  const y = (v: number) => top + plotH - (v / maxDev) * plotH;
  const pts: Pt[] = points.map((p, i) => [x(i), y(p.deviation)]);
  const d = `M${r1(pts[0][0])} ${r1(pts[0][1])}` + catmullRom(pts);
  const base = points
    .map((p, i) => (p.baseline ? i : -1))
    .filter((i) => i >= 0);
  const axisY = y(0);
  const dateY = axisY + 24;
  const bracketY = axisY + 42;
  const every = narrow ? 4 : 5;
  const ticks = points
    .map((_, i) => i)
    .filter(
      (i) =>
        i === 0 || i === n - 1 || (i % every === 0 && n - 1 - i >= every / 2),
    );
  const last = points[n - 1];
  const outsideCount = points.filter((p) => p.outside).length;
  return (
    <div className="cl-chart" ref={box}>
      {width > 0 && (
        <svg
          width={width}
          height={H}
          viewBox={`0 0 ${r1(width)} ${H}`}
          role="img"
          aria-label={`Voice observations on ${n} days, compared only with this person’s own range. ${outsideCount} ${outsideCount === 1 ? "day" : "days"} outside it. Last observation, ${dateLabel(last.date)}: ${rangeWord(last.outside)}.`}
        >
          <text className="cl-chart-label" x={left} y={16}>
            Difference from personal range
          </text>
          <rect
            className="cl-chart-band"
            x={left}
            y={r1(y(RANGE_EDGE))}
            width={r1(plotW)}
            height={r1(axisY - y(RANGE_EDGE))}
          />
          <text
            className="cl-chart-label"
            x={r1(left + plotW - 10)}
            y={r1(y(RANGE_EDGE) + 20)}
            textAnchor="end"
          >
            Personal range
          </text>
          <line
            className="cl-chart-axis"
            x1={left}
            x2={r1(left + plotW)}
            y1={r1(axisY)}
            y2={r1(axisY)}
          />
          <path className="cl-chart-line" d={d} />
          {points.map((p, i) => (
            <g key={p.date + i}>
              {p.outside && (
                <circle
                  className="cl-chart-ring"
                  cx={r1(pts[i][0])}
                  cy={r1(pts[i][1])}
                  r={7}
                />
              )}
              <circle
                className={"cl-chart-dot" + (p.outside ? " is-outside" : "")}
                cx={r1(pts[i][0])}
                cy={r1(pts[i][1])}
                r={3}
              >
                <title>{`${dateLabel(p.date)}: ${rangeWord(p.outside)}`}</title>
              </circle>
            </g>
          ))}
          {ticks.map((i) => (
            <text
              key={"t" + i}
              className="cl-chart-date"
              x={r1(x(i))}
              y={r1(dateY)}
              textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
            >
              {dateLabel(points[i].date)}
            </text>
          ))}
          {base.length > 1 && (
            <>
              <path
                className="cl-chart-bracket"
                d={`M${r1(x(base[0]))} ${r1(bracketY - 6)}V${r1(bracketY)}H${r1(x(base.at(-1)!))}V${r1(bracketY - 6)}`}
              />
              <text
                className="cl-chart-date"
                x={r1(x(base[0]))}
                y={r1(bracketY + 20)}
              >
                Baseline days
              </text>
            </>
          )}
        </svg>
      )}
      <div className="visually-hidden">
        <table>
          <caption>Voice observations by day</caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Difference from personal range</th>
              <th scope="col">Range</th>
              <th scope="col">Baseline day</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p, i) => (
              <tr key={p.date + i}>
                <td>{dateLabel(p.date)}</td>
                <td>{p.deviation.toFixed(1)}</td>
                <td>{p.outside ? "Outside" : "Within"}</td>
                <td>{p.baseline ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
