import { useEffect, useRef, useState } from "react";
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
} from "lucide-react";
import { Link } from "react-router-dom";
import type { Context, Trend } from "./types";
import { dateLabel } from "./api";

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
  return (
    <div className="context-grid">
      {[
        {
          module: "sleep",
          Icon: Moon,
          value: `${context.sleep_hours} h`,
          label: "Sleep",
          detail: "Room for rest",
        },
        {
          module: "activity",
          Icon: Footprints,
          value: context.steps.toLocaleString(),
          label: "Steps",
          detail: `${context.outdoor_minutes} min outdoors`,
        },
        {
          module: "weather",
          Icon: CloudSun,
          value: `${context.temperature_c}°`,
          label: context.weather,
          detail: "A little daily context",
        },
        {
          module: "music",
          Icon: Music,
          value: `${context.music_minutes} min`,
          label: "Music",
          detail: "Your listening rhythm",
        },
      ]
        .filter((card) => !modules || modules.includes(card.module))
        .map(({ Icon, value, label, detail }) => (
          <div className="context-card" key={label}>
            <Icon size={18} />
            <span className="context-value">{value}</span>
            <strong>{label}</strong>
            <small>{detail}</small>
          </div>
        ))}
    </div>
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

export function Recorder({
  onReady,
  onClear,
  label = "Record a voice note",
}: {
  onReady: (blob: Blob) => void;
  onClear: () => void;
  label?: string;
}) {
  const [status, setStatus] = useState<"idle" | "recording" | "done">("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const [url, setUrl] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null);
  const capture = useRef<{
    recorder: MediaRecorder;
    stream: MediaStream;
    ctx: AudioContext;
    animation: number;
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
        cancelAnimationFrame(c.animation);
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
    if (status !== "recording") return;
    const t = setInterval(() => {
      const s = Math.floor((Date.now() - recordingAt.current) / 1000);
      setSeconds(s);
      if (s >= 120 && capture.current?.recorder.state === "recording")
        capture.current.recorder.stop();
    }, 250);
    return () => clearInterval(t);
  }, [status]);
  async function start() {
    setError("");
    setSeconds(0);
    setUrl("");
    onClear();
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError(
        "Recording is not available here. Try Chrome or Safari over HTTPS, or use a written entry below.",
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
      analyser.fftSize = 1024;
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
        setUrl(URL.createObjectURL(blob));
        callback.current(blob);
        stream!.getTracks().forEach((t) => t.stop());
        void ctx!.close();
        if (capture.current) cancelAnimationFrame(capture.current.animation);
        capture.current = null;
        setStatus("done");
      };
      stream.getAudioTracks().forEach(
        (t) =>
          (t.onended = () => {
            if (recorder.state === "recording") recorder.stop();
          }),
      );
      capture.current = { recorder, stream, ctx, animation: 0 };
      const data = new Uint8Array(analyser.frequencyBinCount);
      const draw = () => {
        const el = canvas.current;
        const c = el?.getContext("2d");
        if (el && c) {
          analyser.getByteTimeDomainData(data);
          el.width = el.clientWidth * 2;
          el.height = 150;
          c.clearRect(0, 0, el.width, el.height);
          c.strokeStyle =
            getComputedStyle(document.documentElement)
              .getPropertyValue("--organic")
              .trim() || "#3f422e";
          c.lineWidth = 2.5;
          c.beginPath();
          for (let i = 0; i < data.length; i++) {
            const x = (i / data.length) * el.width,
              y = (data[i] / 128) * 75;
            i ? c.lineTo(x, y) : c.moveTo(x, y);
          }
          c.stroke();
        }
        if (capture.current)
          capture.current.animation = requestAnimationFrame(draw);
      };
      recordingAt.current = Date.now();
      recorder.start(250);
      setStatus("recording");
      draw();
    } catch {
      stream?.getTracks().forEach((t) => t.stop());
      if (ctx) void ctx.close();
      setError(
        "Microphone access was not available. You can allow it in your browser or write a note instead.",
      );
      setStatus("idle");
    }
  }
  return (
    <div className="recorder">
      <canvas
        ref={canvas}
        aria-label={
          status === "recording"
            ? "Live microphone waveform"
            : "Voice recording area"
        }
        className={status === "recording" ? "live" : ""}
      />
      <div className="recorder-copy">
        {status === "recording" ? (
          <>
            <span className="record-dot" />
            Listening · {Math.floor(seconds / 60)}:
            {String(seconds % 60).padStart(2, "0")}
          </>
        ) : status === "done" ? (
          "A little piece of your day, captured."
        ) : (
          "No perfect words needed. Just start anywhere."
        )}
      </div>
      <div className="recorder-controls">
        {status === "recording" ? (
          <button
            className="record-button stop"
            onClick={() => capture.current?.recorder.stop()}
            aria-label="Stop recording"
          >
            <Square size={22} />
          </button>
        ) : (
          <button
            className="record-button"
            onClick={() => void start()}
            aria-label={status === "done" ? "Record again" : label}
          >
            {status === "done" ? <RotateCcw size={24} /> : <Mic size={24} />}
          </button>
        )}
        <span>
          {status === "recording"
            ? "Tap to finish"
            : status === "done"
              ? "Record again"
              : "Tap to begin"}
        </span>
      </div>
      {url && (
        <audio controls src={url} aria-label="Listen to your recording" />
      )}
      <ErrorNotice message={error} />
      <small>Up to 2 minutes. Record only when you choose.</small>
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
