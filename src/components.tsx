import {
  forwardRef,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import {
  Mic,
  Square,
  RotateCcw,
  LoaderCircle,
  CircleAlert,
  Play,
  Pause,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { Context } from "./types";
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
      <LoaderCircle className="spin" size={22} aria-hidden="true" /> Making a
      little space…
    </div>
  );
}

/** The small activities Numa can suggest, in the order they are offered. */
export const ACTION_KINDS = ["walk", "music", "breathe", "connect"] as const;

/** A borderless textarea that grows with its words. */
export const GrowingTextarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function GrowingTextarea(props, forwarded) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [props.value]);
  return (
    <textarea
      ref={(el) => {
        ref.current = el;
        if (typeof forwarded === "function") forwarded(el);
        else if (forwarded) forwarded.current = el;
      }}
      rows={1}
      {...props}
    />
  );
});

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

/* ───────────── Recording: your voice draws the line ─────────────
   See DESIGN.md → "The mailbox". The live line uses only the measured loudness
   (RMS from the AnalyserNode, ~10 samples a second). The carrier that makes it
   read as a line is fixed and deterministic; its height at every point is the
   measured loudness at that moment, nothing invented. */

export const LIMIT_SECONDS = 120;
const SAMPLE_MS = 100;

/** Loudness at a moment: seconds since the start and smoothed 0..1. */
export type Level = { t: number; v: number };

export const clock = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** 0..1 from the measured RMS: a small noise floor and a soft limit. */
const loudness = (rms: number) => Math.tanh(Math.max(0, rms - 0.004) * 9);

/** The measured loudness at second t, interpolated between samples. */
export function levelAt(levels: Level[], t: number) {
  if (t <= 0 || !levels.length) return 0;
  if (t < levels[0].t) return levels[0].v * (t / levels[0].t);
  let lo = 0,
    hi = levels.length - 1;
  if (t >= levels[hi].t) return levels[hi].v;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (levels[mid].t <= t) lo = mid;
    else hi = mid;
  }
  const a = levels[lo],
    b = levels[hi];
  return a.v + ((b.v - a.v) * (t - a.t)) / Math.max(1e-6, b.t - a.t);
}

export type CaptureStatus = "idle" | "recording" | "done";

/**
 * The microphone: start, stop, the real loudness ~10 times a second, the
 * 2-minute limit and a full clean-up (tracks stopped, audio context closed)
 * when recording ends or the component goes away.
 */
export function useVoiceCapture({
  onBlob,
  active = true,
}: {
  onBlob: (blob: Blob, seconds: number) => void;
  /** When false (e.g. the person switched to writing) a running recording stops. */
  active?: boolean;
}) {
  const [status, setStatus] = useState<CaptureStatus>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const levels = useRef<Level[]>([]);
  const capture = useRef<{
    recorder: MediaRecorder;
    stream: MediaStream;
    ctx: AudioContext;
    analyser: AnalyserNode;
  } | null>(null);
  const callback = useRef(onBlob);
  callback.current = onBlob;
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
  useEffect(() => {
    if (active) return;
    if (capture.current?.recorder.state === "recording")
      capture.current.recorder.stop();
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
    levels.current = [];
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
        const seconds = Math.min(
          LIMIT_SECONDS,
          (performance.now() - recordingAt.current) / 1000,
        );
        setElapsed(seconds);
        stream!.getTracks().forEach((t) => t.stop());
        void ctx!.close();
        capture.current = null;
        setStatus("done");
        callback.current(blob, seconds);
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
  function stop() {
    if (capture.current?.recorder.state === "recording")
      capture.current.recorder.stop();
  }
  function reset() {
    setStatus("idle");
    setElapsed(0);
    setError("");
    levels.current = [];
  }
  return {
    status,
    elapsed,
    error,
    setError,
    levels: levels.current,
    start,
    stop,
    reset,
  };
}

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

const PEBBLE = 72; // the comparison's record button: the line leaves its edge
const HINT_HEIGHT = 26; // "Tap to begin" sits above the highest crest

/**
 * The comparison recorder's line: the pebble is its origin. From its edge, a
 * quiet start, then the two minutes up to the right edge of the content:
 * recorded voice, then dots for the time still free.
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
  status: CaptureStatus;
  control: ReactNode;
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
    const envelope = (local: number) => {
      const x = local + PEBBLE;
      // Before any recording: the line at rest, a micro-undulation only.
      if (x < recStart)
        return (
          0.07 *
          Math.sqrt(Math.sin((Math.PI * (x - PEBBLE)) / (2 * lead))) *
          (0.6 + 0.4 * Math.sin(x / 17) ** 2)
        );
      return levelAt(levels, ((x - recStart) / span) * LIMIT_SECONDS);
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
        } as CSSProperties
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

/** The optional voice comparison on an entry page (on the green band). */
export function Recorder({
  onReady,
  onClear,
  label = "Record a voice comparison",
}: {
  onReady: (blob: Blob) => void;
  onClear: () => void;
  label?: string;
}) {
  const [url, setUrl] = useState("");
  const [playing, setPlaying] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  const voice = useVoiceCapture({
    onBlob(blob) {
      setUrl(URL.createObjectURL(blob));
      onReady(blob);
    },
  });
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  function begin() {
    setUrl("");
    setPlaying(false);
    onClear();
    void voice.start();
  }
  function toggleListen() {
    const a = audio.current;
    if (!a) return;
    if (a.paused) void a.play().catch(() => setPlaying(false));
    else a.pause();
  }
  const { status, elapsed } = voice;
  return (
    <div className="rec is-dark">
      <RecordingLine
        levels={voice.levels}
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
              onClick={voice.stop}
              aria-label="Stop recording"
            >
              <Square size={22} fill="currentColor" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              className="rec-pebble"
              onClick={begin}
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
      {voice.error && (
        <p className="rec-error" role="alert">
          <CircleAlert size={18} aria-hidden="true" />
          <span>{voice.error}</span>
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
