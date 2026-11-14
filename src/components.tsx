import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Mic,
  Square,
  RotateCcw,
  ArrowUpRight,
  Leaf,
  Wind,
  Music,
  Users,
  CloudSun,
  Moon,
  Footprints,
  LockKeyhole,
  Sprout,
  Check,
  LoaderCircle,
  CircleAlert,
  Play,
  Pause,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { Context, Trend } from "./types";
import { dateLabel } from "./api";
import { catmullRom, cubicD, r1, voiceWave, type Pt } from "./design/voiceLine";

export function Wordmark() {
  return (
    <Link to="/" className="wordmark" aria-label="Numa home">
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <path d="M7 29V16c0-9 13-9 13 0v13-9c0-9 13-9 13 0v9" />
      </svg>
      numa<span className="wordmark-dot">.</span>
    </Link>
  );
}
export function Badge({
  children,
  tone = "quiet",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return <span className={"badge " + tone}>{children}</span>;
}
export function ErrorNotice({ message }: { message: string }) {
  return message ? (
    <div role="alert" className="error-notice">
      {message}
    </div>
  ) : null;
}
export function Loading() {
  return (
    <div className="loading">
      <LoaderCircle className="spin" size={22} /> Making a little space…
    </div>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="empty">
      <Sprout size={32} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export const actionIcons: Record<string, typeof Leaf> = {
  walk: Footprints,
  music: Music,
  breathe: Wind,
  connect: Users,
};

export function ContextCards({
  context,
  modules,
}: {
  context: Context;
  modules?: string[];
}) {
  // A definition list in one row: the value first, its label under it.
  // (.context-card stays on each item: the tests count them.)
  return (
    <dl className="ctx-list">
      {[
        { module: "sleep", value: `${context.sleep_hours} h`, label: "Sleep" },
        {
          module: "activity",
          value: context.steps.toLocaleString("en-GB"),
          label: "Steps",
        },
        {
          module: "activity",
          value: `${context.outdoor_minutes} min`,
          label: "Outdoors",
        },
        {
          module: "weather",
          value: `${context.weather} ${context.temperature_c}°`,
          label: "Weather",
        },
        {
          module: "music",
          value: `${context.music_minutes} min`,
          label: "Music",
        },
      ]
        .filter((item) => !modules || modules.includes(item.module))
        .map(({ value, label }) => (
          <div className="context-card ctx-item" key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
    </dl>
  );
}

export function VoiceChart({ trend }: { trend: Trend }) {
  const [selected, setSelected] = useState<number | null>(null);
  if (!trend.ready)
    return (
      <div className="baseline-building">
        <div className="seed-circles">
          {Array.from({ length: 5 }, (_, i) => (
            <span className={i < trend.days ? "filled" : ""} key={i}>
              {i < trend.days ? <Check size={14} /> : i + 1}
            </span>
          ))}
        </div>
        <h3>Learning your voice</h3>
        <p>{trend.days} of 5 days. Your own voice will be your reference.</p>
      </div>
    );
  const w = 680,
    h = 180,
    p = 25,
    max = Math.max(5, ...trend.points.map((p) => p.deviation));
  const x = (i: number) =>
    p + (i * (w - 2 * p)) / Math.max(1, trend.points.length - 1);
  const y = (v: number) => h - p - (v * (h - 2 * p)) / max;
  const path = trend.points
    .map((point, i) => `${i ? "L" : "M"} ${x(i)} ${y(point.deviation)}`)
    .join(" ");
  return (
    <div className="voice-chart">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label="Vocal differences relative to your personal baseline. This is not a mood score."
      >
        <rect
          x={p}
          y={y(3)}
          width={w - p * 2}
          height={y(0) - y(3)}
          fill="#eaf0e7"
          rx="8"
        />
        {[0, 3].map((v) => (
          <g key={v}>
            <line
              x1={p}
              y1={y(v)}
              x2={w - p}
              y2={y(v)}
              stroke="#c9d5c7"
              strokeDasharray="4 5"
            />
            <text x={p + 7} y={y(v) + 14} className="chart-label">
              {v === 0 ? "Personal baseline" : "Observation threshold"}
            </text>
          </g>
        ))}
        <path
          d={path}
          fill="none"
          stroke="#50745a"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {trend.points.map((point, i) => (
          <circle
            key={point.date}
            cx={x(i)}
            cy={y(point.deviation)}
            r={selected === i ? 6 : 4}
            fill={point.outside ? "#be805d" : "#50745a"}
            stroke="#fff"
            strokeWidth="2"
            onMouseEnter={() => setSelected(i)}
            onFocus={() => setSelected(i)}
            tabIndex={0}
            aria-label={`${point.date}: ${point.outside ? "outside typical range" : "within typical range"}`}
          />
        ))}
      </svg>
      <div className="chart-dates">
        <span>{dateLabel(trend.points[0].date)}</span>
        <span>
          {selected !== null
            ? `${dateLabel(trend.points[selected].date)} · ${trend.points[selected].outside ? "Outside typical range" : "Within typical range"}`
            : "Differences in voice, not a mood score"}
        </span>
        <span>{dateLabel(trend.points.at(-1)!.date)}</span>
      </div>
    </div>
  );
}

/* ───────────── Recording: your voice draws the line ─────────────
   See DESIGN.md → "Recording". The live line uses only the measured loudness
   (RMS from the AnalyserNode, ~10 samples a second). The carrier that makes it
   read as a line is fixed and deterministic; its height at every point is the
   measured loudness at that moment, nothing invented. */

const LIMIT_SECONDS = 120;
const SAMPLE_MS = 100;

/** Loudness at a moment: seconds since the start and smoothed 0..1. */
type Level = { t: number; v: number };

const clock = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** 0..1 from the measured RMS: a small noise floor and a soft limit. */
const loudness = (rms: number) => Math.tanh(Math.max(0, rms - 0.004) * 9);

function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(el.getBoundingClientRect().width);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

const PEBBLE = 72; // the record button: the line leaves its edge
const HINT_HEIGHT = 26; // "Tap to begin" sits above the highest crest

/**
 * The record pebble is the origin of the line. From its edge, a quiet start
 * with the system's micro-undulation, then the two minutes up to the right edge
 * of the content: recorded voice, then dots for the time still free.
 */
function RecordingLine({
  levels,
  elapsed,
  status,
  control,
  hint,
}: {
  levels: Level[];
  elapsed: number;
  status: "idle" | "recording" | "done";
  control: React.ReactNode;
  hint: string;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const compact = width < 640;
  const amp = compact ? 18 : 28;
  const wavelength = compact ? 9 : 12;
  const rise = compact ? 18 : 24;
  const lead = compact ? 36 : 64; // the quiet start, before the first second
  const axis = HINT_HEIGHT + 8 + amp;
  const height = axis + PEBBLE / 2 + 2;
  const recStart = PEBBLE + lead; // where recorded time begins
  const span = Math.max(1, width - recStart); // the 2 minutes, to the right edge
  const end =
    status === "idle"
      ? recStart
      : recStart + Math.min(1, elapsed / LIMIT_SECONDS) * span;

  let path = "";
  let tip: Pt = [end, axis];
  let seed: Pt = [end, axis];
  if (width > 0) {
    let i = 0;
    const envelope = (local: number) => {
      const x = local + PEBBLE;
      // Before any recording: the line at rest, a micro-undulation only.
      // It leaves the pebble on the axis and eases in.
      if (x < recStart)
        return (
          0.07 *
          Math.sqrt(Math.sin((Math.PI * (x - PEBBLE)) / (2 * lead))) *
          (0.6 + 0.4 * Math.sin(x / 17) ** 2)
        );
      const t = ((x - recStart) / span) * LIMIT_SECONDS;
      if (t <= 0 || !levels.length) return 0;
      if (t < levels[0].t) return levels[0].v * (t / levels[0].t);
      while (i < levels.length - 1 && levels[i + 1].t < t) i++;
      const a = levels[i],
        b = levels[i + 1];
      if (!b) return a.v;
      return a.v + ((b.v - a.v) * (t - a.t)) / Math.max(1e-6, b.t - a.t);
    };
    const wave: Pt[] = voiceWave({
      to: end - PEBBLE,
      axis,
      amp,
      wavelength,
      envelope,
      rand: () => 1, // no invented variation: height is the measured loudness only
      settle: false,
      endOnAxis: false,
    }).map(([x, y]) => [x + PEBBLE, y]);
    tip = wave[wave.length - 1];
    if (status === "done") {
      // It comes home to the axis, then rises a little to a seed. The recorded
      // part is never reshaped; near the 2-minute edge the rise gets narrower.
      const room = width - end;
      const settle = Math.min(wavelength * 0.75, room * 0.35);
      const from = end + settle;
      const riseW = Math.max(4, Math.min(rise, room - settle - 8));
      wave.push([from, axis]);
      path = `M${r1(wave[0][0])} ${r1(wave[0][1])}` + catmullRom(wave);
      path += cubicD([
        [from, axis],
        [from + riseW * 0.55, axis],
        [from + riseW, axis - rise * 0.45],
        [from + riseW, axis - rise],
      ]);
      seed = [from + riseW, axis - rise - 4];
    } else {
      path = `M${r1(wave[0][0])} ${r1(wave[0][1])}` + catmullRom(wave);
    }
  }
  const label =
    status === "recording"
      ? "Your voice, drawn as you speak. Up to 2 minutes."
      : status === "done"
        ? `Your recording, ${clock(elapsed)} long.`
        : "Your voice line. Up to 2 minutes of recording.";
  // The clock rides beside the tip; on small screens it sits under it.
  const time: Pt = compact
    ? [Math.min(Math.max(end - 16, recStart - 16), width - 96), axis + 12]
    : [end + 14 + 48 > width ? end - 62 : end + 14, axis - 12];
  const showLimit =
    status !== "done" && !(status === "recording" && time[0] + 48 > width - 44);
  return (
    <div
      className="rec-line"
      ref={ref}
      style={
        {
          "--rec-axis": `${axis}px`,
          "--rec-height": `${height}px`,
        } as React.CSSProperties
      }
    >
      <div className="rec-origin">{control}</div>
      <span
        className="rec-hint"
        aria-hidden="true"
        style={{ left: PEBBLE + 14 }}
      >
        {hint}
      </span>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={label}
      >
        {status !== "done" && end + 6 < width && (
          <line
            className="rec-remaining"
            x1={r1(end + 6)}
            y1={axis}
            x2={width}
            y2={axis}
          />
        )}
        <path className="rec-trace" d={path} />
        {status === "recording" && (
          <circle className="rec-tip" cx={r1(tip[0])} cy={r1(tip[1])} r="3" />
        )}
        {status === "done" && (
          <ellipse
            className="rec-seed"
            cx={r1(seed[0])}
            cy={r1(seed[1])}
            rx="6"
            ry="4"
            transform={`rotate(-30 ${r1(seed[0])} ${r1(seed[1])})`}
          />
        )}
      </svg>
      {showLimit && (
        <span className="rec-limit" aria-hidden="true">
          2 min
        </span>
      )}
      {status === "recording" && (
        <span
          className={"rec-time" + (compact ? " is-below" : "")}
          style={{ left: Math.max(0, r1(time[0])), top: time[1] }}
        >
          {clock(elapsed)}
        </span>
      )}
    </div>
  );
}

export function Recorder({
  onReady,
  onClear,
  label = "Record a voice note",
  tone = "light",
  active = true,
  onWriteInstead,
}: {
  onReady: (blob: Blob) => void;
  onClear: () => void;
  label?: string;
  /** "dark" for the moss band: ivory strokes and text. */
  tone?: "light" | "dark";
  /** When false (e.g. the person switched to writing) a running recording stops. */
  active?: boolean;
  /** Offered beside microphone errors. */
  onWriteInstead?: () => void;
}) {
  const [status, setStatus] = useState<"idle" | "recording" | "done">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [url, setUrl] = useState("");
  const [playing, setPlaying] = useState(false);
  const levels = useRef<Level[]>([]);
  const audio = useRef<HTMLAudioElement>(null);
  const capture = useRef<{
    recorder: MediaRecorder;
    stream: MediaStream;
    ctx: AudioContext;
    analyser: AnalyserNode;
  } | null>(null);
  const callback = useRef(onReady);
  callback.current = onReady;
  const recordingAt = useRef(0);
  useEffect(
    () => () => {
      const c = capture.current;
      if (c) {
        c.recorder.onstop = null;
        if (c.recorder.state !== "inactive") c.recorder.stop();
        c.stream.getTracks().forEach((t) => t.stop());
        void c.ctx.close();
      }
    },
    [],
  );
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  useEffect(() => {
    if (active) return;
    if (capture.current?.recorder.state === "recording")
      capture.current.recorder.stop();
    audio.current?.pause();
  }, [active]);
  // ~10 times a second: the real RMS of the microphone, smoothed, and the clock.
  useEffect(() => {
    if (status !== "recording") return;
    const c = capture.current;
    if (!c) return;
    const buffer = new Float32Array(c.analyser.fftSize);
    let smooth = 0;
    const timer = setInterval(() => {
      const s = (performance.now() - recordingAt.current) / 1000;
      c.analyser.getFloatTimeDomainData(buffer);
      let sum = 0;
      for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i];
      smooth += (loudness(Math.sqrt(sum / buffer.length)) - smooth) * 0.5;
      levels.current.push({ t: s, v: smooth });
      setElapsed(Math.min(s, LIMIT_SECONDS));
      if (s >= LIMIT_SECONDS && c.recorder.state === "recording")
        c.recorder.stop();
    }, SAMPLE_MS);
    return () => clearInterval(timer);
  }, [status]);
  async function start() {
    setError("");
    setElapsed(0);
    setUrl("");
    setPlaying(false);
    levels.current = [];
    onClear();
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError(
        "Recording is not available in this browser. Try Chrome or Safari over HTTPS.",
      );
      return;
    }
    let stream: MediaStream | undefined, ctx: AudioContext | undefined;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
        },
      });
      ctx = new AudioContext();
      await ctx.resume();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find(
        (m) => MediaRecorder.isTypeSupported(m),
      );
      const recorder = new MediaRecorder(
        stream,
        mime ? { mimeType: mime } : {},
      );
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks, {
          type: recorder.mimeType || "audio/webm",
        });
        setElapsed(
          Math.min(
            LIMIT_SECONDS,
            (performance.now() - recordingAt.current) / 1000,
          ),
        );
        setUrl(URL.createObjectURL(blob));
        callback.current(blob);
        stream!.getTracks().forEach((t) => t.stop());
        void ctx!.close();
        capture.current = null;
        setStatus("done");
      };
      stream.getAudioTracks().forEach(
        (t) =>
          (t.onended = () => {
            if (recorder.state === "recording") recorder.stop();
          }),
      );
      capture.current = { recorder, stream, ctx, analyser };
      recordingAt.current = performance.now();
      recorder.start(250);
      setStatus("recording");
    } catch (e) {
      stream?.getTracks().forEach((t) => t.stop());
      if (ctx) void ctx.close();
      const name = (e as DOMException)?.name;
      setError(
        name === "NotFoundError" || name === "OverconstrainedError"
          ? "No microphone was found on this device."
          : "Microphone access was not available. You can allow it in your browser settings.",
      );
      setStatus("idle");
    }
  }
  function toggleListen() {
    const a = audio.current;
    if (!a) return;
    if (a.paused) void a.play().catch(() => setPlaying(false));
    else a.pause();
  }
  return (
    <div className={"rec" + (tone === "dark" ? " is-dark" : "")}>
      <RecordingLine
        levels={levels.current}
        elapsed={elapsed}
        status={status}
        hint={
          status === "recording"
            ? "Tap to finish"
            : status === "done"
              ? "Record again"
              : "Tap to begin"
        }
        control={
          status === "recording" ? (
            <button
              type="button"
              className="rec-pebble"
              onClick={() => capture.current?.recorder.stop()}
              aria-label="Stop recording"
            >
              <Square size={22} fill="currentColor" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              className="rec-pebble"
              onClick={() => void start()}
              aria-label={status === "done" ? "Record again" : label}
            >
              {status === "done" ? (
                <RotateCcw size={26} aria-hidden="true" />
              ) : (
                <Mic size={26} aria-hidden="true" />
              )}
            </button>
          )
        }
      />
      {url && (
        <div className="rec-listen-row">
          <button
            type="button"
            className="rec-listen"
            aria-label="Listen to your recording"
            aria-pressed={playing}
            onClick={toggleListen}
          >
            {playing ? (
              <Pause size={18} aria-hidden="true" />
            ) : (
              <Play size={18} aria-hidden="true" />
            )}
            {playing ? "Pause" : "Listen back"}
          </button>
          <span className="rec-duration">{clock(elapsed)}</span>
          <audio
            ref={audio}
            src={url}
            hidden
            preload="metadata"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
          />
        </div>
      )}
      {error && (
        <p className="rec-error" role="alert">
          <CircleAlert size={18} aria-hidden="true" />
          <span>
            {error}
            {onWriteInstead && (
              <>
                {" "}
                <button
                  type="button"
                  className="rec-link"
                  onClick={onWriteInstead}
                >
                  Write a note instead
                </button>
              </>
            )}
          </span>
        </p>
      )}
      <p className="visually-hidden" role="status">
        {status === "recording"
          ? "Recording."
          : status === "done"
            ? `Recording finished, ${clock(elapsed)}.`
            : ""}
      </p>
    </div>
  );
}

export function PrivacyNote() {
  return (
    <div className="privacy-note">
      <LockKeyhole size={15} />
      <span>
        Your words stay in your journal. Your psychologist sees trends only.
      </span>
    </div>
  );
}
export function SectionTitle({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
      </div>
      {children}
    </div>
  );
}
export function TextLink({
  to,
  children,
}: {
  to: string;
  children: React.ReactNode;
}) {
  return (
    <Link className="text-link" to={to}>
      {children}
      <ArrowUpRight size={16} />
    </Link>
  );
}
