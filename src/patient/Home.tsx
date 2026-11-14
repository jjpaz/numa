// Home: the mailbox (DESIGN.md → "The mailbox"). Arrive, speak or write, done.
// One action at a time: the microphone (or a few written words), then the
// mailbox opens in place into a small review window, then the entry is planted.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Check, CircleAlert, Mic, Square } from "lucide-react";
import { useAuth } from "../auth";
import { api, json } from "../api";
import {
  GrowingTextarea,
  LIMIT_SECONDS,
  clock,
  levelAt,
  useVoiceCapture,
  type CaptureStatus,
  type Level,
} from "../components";
import { useBoxWidth } from "../design/Grass";
import { FlowLink } from "../design/flow";
import {
  catmullRom,
  gaussianEnvelope,
  hashString,
  mulberry32,
  r1,
  voiceWave,
} from "../design/voiceLine";
import { dailyLine } from "../dailyLine";
import { reflectionFor, todayState, type TodayState } from "../today";
import type { Entry } from "../types";
import { usePatientEntries } from "./Layout";

/* ───────────── Consent, remembered on this device ───────────── */

const CONSENT_KEY = "numa-audio-consent";
function readConsent() {
  try {
    return localStorage.getItem(CONSENT_KEY) === "1";
  } catch {
    return false;
  }
}
function writeConsent(value: boolean) {
  try {
    if (value) localStorage.setItem(CONSENT_KEY, "1");
    else localStorage.removeItem(CONSENT_KEY);
  } catch {
    /* storage unavailable: the box simply asks again next time */
  }
}

/* ───────────── Voice lines inside the mailbox ───────────── */

/** While recording: the two minutes across the mailbox, drawn by your voice. */
function LiveLine({
  levels,
  elapsed,
  status,
}: {
  levels: Level[];
  elapsed: number;
  status: CaptureStatus;
}) {
  const [box, W] = useBoxWidth<HTMLDivElement>();
  const H = 64,
    axis = 34;
  const end = status === "recording" ? Math.min(1, elapsed / LIMIT_SECONDS) * W : 0;
  let path = "";
  if (W > 0 && end > 1) {
    const wave = voiceWave({
      to: end,
      axis,
      amp: 24,
      wavelength: 11,
      envelope: (x) => levelAt(levels, (x / W) * LIMIT_SECONDS),
      rand: () => 1, // no invented variation: height is the measured loudness only
      settle: false,
      endOnAxis: false,
    });
    path = `M${r1(wave[0][0])} ${r1(wave[0][1])}` + catmullRom(wave);
  }
  return (
    <div className="pt-line" ref={box}>
      {W > 0 && (
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={
            status === "recording"
              ? "Your voice, drawn as you speak. Up to 2 minutes."
              : "Your voice line. Up to 2 minutes of recording."
          }
        >
          <line
            className="pt-line-rest"
            x1={r1(Math.min(W, end + 6))}
            y1={axis}
            x2={W}
            y2={axis}
          />
          {path && <path className="pt-line-voice" d={path} />}
          {status === "recording" && (
            <circle className="pt-line-tip" cx={r1(end)} cy={axis} r="3.5" />
          )}
        </svg>
      )}
    </div>
  );
}

/** While Numa listens: the recording, still. A written note gets a quiet line. */
function StillLine({ levels, seconds, seed }: { levels: Level[] | null; seconds: number; seed: string }) {
  const [box, W] = useBoxWidth<HTMLDivElement>();
  const H = 64,
    axis = 34;
  let path = "";
  if (W > 0) {
    const recorded = levels && levels.length > 2 && seconds > 0.5;
    const wave = voiceWave({
      to: W,
      axis,
      amp: 22,
      wavelength: recorded ? Math.max(8, Math.min(14, W / (seconds * 3))) : 12,
      rand: recorded ? () => 1 : mulberry32(hashString(seed)),
      envelope: recorded
        ? (x) => levelAt(levels!, (x / W) * seconds)
        : (x) =>
            gaussianEnvelope(
              [
                { c: W * 0.24, s: W * 0.07, w: 0.7 },
                { c: W * 0.52, s: W * 0.09, w: 0.9 },
                { c: W * 0.78, s: W * 0.06, w: 0.55 },
              ],
              x,
            ),
    });
    path = `M${r1(wave[0][0])} ${r1(wave[0][1])}` + catmullRom(wave);
  }
  return (
    <div className="pt-line is-still" ref={box} aria-hidden="true">
      {W > 0 && (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
          <path className="pt-line-voice" d={path} />
        </svg>
      )}
    </div>
  );
}

/* ───────────── The review window ───────────── */

/**
 * The mailbox, opened: what Numa heard, ready to plant. Polls the entry while
 * the backend is still listening, as the entry page does.
 */
function ReviewWindow({
  id,
  levels,
  seconds,
  focus,
  onPlanted,
  onDiscarded,
}: {
  /** null while the recording or note is still on its way. */
  id: string | null;
  levels: Level[] | null;
  seconds: number;
  /** Opened by the person (not found open on arrival): the focus moves in. */
  focus: boolean;
  onPlanted: (id: string) => void;
  onDiscarded: () => void;
}) {
  const { refresh, setGrow } = usePatientEntries();
  const [entry, setEntry] = useState<Entry | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const title = useRef<HTMLHeadingElement>(null);
  const filled = useRef("");
  useEffect(() => {
    if (!id) return;
    let alive = true,
      timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const e = await api<Entry>("/patient/entries/" + id);
        if (!alive) return;
        setEntry(e);
        setError("");
        if (["pending", "processing"].includes(e.status))
          timer = setTimeout(() => void poll(), 1800);
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
    };
    void poll();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [id]);
  const ready = !!entry && !["pending", "processing"].includes(entry.status);
  useEffect(() => {
    if (ready && entry && filled.current !== entry.id) {
      setText(entry.transcript);
      filled.current = entry.id;
    }
  }, [ready, entry]);
  // The focus moves to the window's title when it opens, and when it is ready.
  useEffect(() => {
    if (focus) title.current?.focus({ preventScroll: true });
  }, [ready, focus]);
  async function plant() {
    if (!entry) return;
    setBusy(true);
    setError("");
    try {
      await api("/patient/entries/" + entry.id, {
        method: "PATCH",
        body: json({ transcript: text, saved: true }),
      });
      setGrow(entry.id);
      await refresh();
      onPlanted(entry.id);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  async function discard() {
    setBusy(true);
    setError("");
    try {
      if (id) await api("/patient/entries/" + id, { method: "DELETE" });
      await refresh();
      onDiscarded();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <>
      <h2 id="pt-review-title" className="pt-review-title" tabIndex={-1} ref={title}>
        {ready ? "Here’s what I heard" : "Listening to your day…"}
      </h2>
      <p className="visually-hidden" role="status">
        {ready ? "Your words are ready to read." : ""}
      </p>
      {!ready ? (
        <>
          <StillLine levels={levels} seconds={seconds} seed={id ?? "listening"} />
          <p className="pt-hint">Finding the threads. Your voice and your words are read separately.</p>
        </>
      ) : (
        <>
          <GrowingTextarea
            aria-label="Transcript"
            className="pt-transcript"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={16000}
            placeholder="Transcription unavailable? Add the words you want to keep."
          />
          <p className="pt-reflection">{reflectionFor(entry!)}</p>
          <div className="pt-review-actions">
            <button
              type="button"
              className="pt-primary"
              disabled={busy}
              onClick={() => void plant()}
            >
              {busy ? "Planting…" : "Plant this entry"}
            </button>
            <button
              type="button"
              className="pt-link"
              disabled={busy}
              onClick={() => void discard()}
            >
              Record again
            </button>
            <FlowLink className="pt-link" to={"/patient/entries/" + entry!.id}>
              Open the full entry
            </FlowLink>
          </div>
        </>
      )}
      {error && (
        <p className="pt-error" role="alert">
          <CircleAlert size={18} aria-hidden="true" />
          <span>
            {error}{" "}
            {!ready && (
              <button type="button" className="pt-link" onClick={() => void discard()}>
                Start again
              </button>
            )}
          </span>
        </p>
      )}
    </>
  );
}

/* ───────────── The mailbox ───────────── */

type View =
  | { k: "compose" }
  | { k: "review"; id: string | null; levels: Level[] | null; seconds: number }
  | { k: "planted" };

const firstView = (state: TodayState<Entry>): View =>
  state.kind === "done"
    ? { k: "planted" }
    : state.kind === "in_progress"
      ? { k: "review", id: state.entry.id, levels: null, seconds: 0 }
      : { k: "compose" };

function MailboxShell({
  open,
  children,
  label,
}: {
  open: boolean;
  children: ReactNode;
  label?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.section
      layout={!reduced}
      transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
      className={"pt-mailbox" + (open ? " is-open" : "")}
      style={{ borderRadius: 32 }}
      {...(open
        ? { role: "dialog", "aria-modal": false, "aria-labelledby": "pt-review-title" }
        : { "aria-label": label })}
    >
      <motion.div layout={reduced ? false : "position"} className="pt-mailbox-inner">
        {children}
      </motion.div>
    </motion.section>
  );
}

function Mailbox({ entries }: { entries: Entry[] }) {
  const { health } = useAuth();
  const local = health?.mode === "local_preview";
  const state = todayState(entries);
  const [view, setView] = useState<View>(() => firstView(state));
  const [write, setWrite] = useState(false);
  const [text, setText] = useState("");
  const [sendError, setSendError] = useState("");
  const [needWords, setNeedWords] = useState(false);
  const [consent, setConsent] = useState(readConsent);
  const [consentAtLoad] = useState(readConsent);
  const [needConsent, setNeedConsent] = useState(false);
  const consentBox = useRef<HTMLInputElement>(null);
  const planted = useRef<HTMLParagraphElement>(null);
  const micButton = useRef<HTMLButtonElement>(null);
  const note = useRef<HTMLTextAreaElement>(null);
  const focusAfter = useRef<"planted" | "mic" | "note" | null>(null);
  const requestId = useRef(crypto.randomUUID());
  const opened = useRef(false);
  const { setGrow } = usePatientEntries();

  const voice = useVoiceCapture({
    active: !write,
    onBlob(blob, seconds) {
      void send({ blob, levels: [...voice.levels], seconds });
    },
  });

  useEffect(() => {
    const target = focusAfter.current;
    focusAfter.current = null;
    if (target === "planted") planted.current?.focus();
    if (target === "mic") micButton.current?.focus();
    if (target === "note") note.current?.focus();
  }, [view, write]);
  // The plant that has just grown only grows once.
  useEffect(() => {
    if (view.k !== "planted") return;
    const t = setTimeout(() => setGrow(null), 1600);
    return () => clearTimeout(t);
  }, [view, setGrow]);

  function askConsent() {
    if (consent) return true;
    setNeedConsent(true);
    consentBox.current?.focus();
    return false;
  }
  async function send(what: { blob?: Blob; levels: Level[] | null; seconds: number }) {
    opened.current = true;
    setSendError("");
    setView({ k: "review", id: null, levels: what.levels, seconds: what.seconds });
    try {
      let entry: Entry;
      if (what.blob) {
        const form = new FormData();
        form.append("audio", what.blob, "journal.webm");
        form.append("request_id", requestId.current);
        entry = await api<Entry>("/patient/entries/audio", { method: "POST", body: form });
      } else {
        entry = await api<Entry>("/patient/entries/text", {
          method: "POST",
          body: json({ text, request_id: requestId.current }),
        });
      }
      requestId.current = crypto.randomUUID();
      setView({ k: "review", id: entry.id, levels: what.levels, seconds: what.seconds });
    } catch (e) {
      setSendError((e as Error).message);
      voice.reset();
      setView({ k: "compose" });
    }
  }
  function keepWords() {
    if (!askConsent()) return;
    if (!text.trim()) {
      setNeedWords(true);
      note.current?.focus();
      return;
    }
    setNeedWords(false);
    void send({ levels: null, seconds: 0 });
  }
  function switchMode(toWriting: boolean) {
    setSendError("");
    voice.setError("");
    focusAfter.current = toWriting ? "note" : "mic";
    setWrite(toWriting);
  }
  function toCompose(focus: "mic" | "note" = "mic") {
    voice.reset();
    focusAfter.current = focus;
    setView({ k: "compose" });
  }

  const recording = voice.status === "recording";
  const error = sendError || voice.error;

  let body: ReactNode;
  if (view.k === "review") {
    body = (
      <ReviewWindow
        key={view.id ?? "sending"}
        id={view.id}
        levels={view.levels}
        seconds={view.seconds}
        focus={opened.current}
        onPlanted={() => {
          setText("");
          setWrite(false);
          voice.reset();
          focusAfter.current = "planted";
          setView({ k: "planted" });
        }}
        onDiscarded={() => toCompose(write ? "note" : "mic")}
      />
    );
  } else if (view.k === "planted") {
    const today = todayState(entries);
    body = (
      <div className="pt-planted">
        <p className="pt-planted-status" role="status" tabIndex={-1} ref={planted}>
          <Check size={20} aria-hidden="true" /> Today’s entry is planted.
        </p>
        <div className="pt-planted-links">
          {today.kind !== "pending" && (
            <FlowLink className="pt-primary" to={"/patient/entries/" + today.entry.id}>
              See today’s entry
            </FlowLink>
          )}
          <button type="button" className="pt-link" onClick={() => toCompose("mic")}>
            Add another entry
          </button>
        </div>
      </div>
    );
  } else if (write) {
    body = (
      <div className="pt-write">
        <label htmlFor="pt-note">Your note</label>
        <GrowingTextarea
          id="pt-note"
          ref={note}
          className="pt-note"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (e.target.value.trim()) setNeedWords(false);
          }}
          maxLength={16000}
          placeholder="Today, I noticed…"
          aria-describedby={needWords ? "pt-need-words" : undefined}
        />
        {needWords && (
          <p id="pt-need-words" className="pt-hint" role="alert">
            Write a few words first.
          </p>
        )}
        <div className="pt-write-actions">
          <button type="button" className="pt-primary" onClick={keepWords}>
            Keep these words
          </button>
          <button type="button" className="pt-link" onClick={() => switchMode(false)}>
            I’d rather leave a voice note
          </button>
        </div>
      </div>
    );
  } else {
    body = (
      <div className="pt-voice">
        <LiveLine levels={voice.levels} elapsed={voice.elapsed} status={voice.status} />
        {recording ? (
          <button
            ref={micButton}
            type="button"
            className="pt-mic is-recording"
            onClick={voice.stop}
            aria-label="Stop recording"
          >
            <Square size={26} fill="currentColor" aria-hidden="true" />
          </button>
        ) : (
          <button
            ref={micButton}
            type="button"
            className="pt-mic"
            onClick={() => {
              if (!askConsent()) return;
              setSendError("");
              void voice.start();
            }}
            aria-label="Record a voice note"
          >
            <Mic size={32} aria-hidden="true" />
          </button>
        )}
        {recording ? (
          <p className="pt-clock" aria-hidden="true">
            <span>{clock(voice.elapsed)}</span> of 2:00
          </p>
        ) : (
          <p className="pt-hint">Tap to talk. Up to 2 minutes.</p>
        )}
        <p className="visually-hidden" role="status">
          {recording ? "Recording." : ""}
        </p>
        {!recording && (
          <button type="button" className="pt-link pt-switch" onClick={() => switchMode(true)}>
            I’d rather write today
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <MailboxShell open={view.k === "review"} label="Your mailbox">
        <div className="pt-mailbox-view" key={view.k + (write ? ":w" : "")}>
          {body}
        </div>
        {error && view.k === "compose" && (
          <p className="pt-error" role="alert">
            <CircleAlert size={18} aria-hidden="true" />
            <span>
              {error}
              {!write && (
                <>
                  {" "}
                  <button type="button" className="pt-link" onClick={() => switchMode(true)}>
                    Write a note instead
                  </button>
                </>
              )}
            </span>
          </p>
        )}
      </MailboxShell>
      {view.k === "compose" && !recording && (
        <div className="pt-consent">
          {consentAtLoad ? (
            <details className="pt-terms is-quiet">
              <summary>How audio is handled</summary>
              <Terms local={local} />
            </details>
          ) : (
            <>
              <label className="pt-check">
                <input
                  ref={consentBox}
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => {
                    setConsent(e.target.checked);
                    writeConsent(e.target.checked);
                    if (e.target.checked) setNeedConsent(false);
                  }}
                  aria-describedby={"pt-audio-terms" + (needConsent ? " pt-need-consent" : "")}
                />
                <span>
                  {local
                    ? "This is a fictional experience, and I understand how this preview handles audio."
                    : "This is a fictional experience, and I understand how Numa handles my audio."}
                </span>
              </label>
              {needConsent && (
                <p id="pt-need-consent" className="pt-need" role="alert">
                  Tick the box to continue.
                </p>
              )}
              <details className="pt-terms">
                <summary>How audio is handled</summary>
                <Terms local={local} />
              </details>
            </>
          )}
        </div>
      )}
    </>
  );
}

function Terms({ local }: { local: boolean }) {
  return (
    <p id="pt-audio-terms">
      {local
        ? "I understand this preview uses temporary server memory. Audio is processed for acoustic measurements; emotional ML is not active. If Gemini is unavailable, I can add the words myself."
        : "I agree to temporary audio processing by Numa on Modal and transcription by Gemini. My saved words remain private to my account. Audio is not retained by Numa after processing."}{" "}
      Use fictional experiences for this demonstration.
    </p>
  );
}

/** The sample journal: read only, but today's entry can still be opened. */
function SampleMailbox({ entries }: { entries: Entry[] }) {
  const today = todayState(entries);
  return (
    <MailboxShell open={false} label="Your mailbox">
      <div className="pt-planted">
        {today.kind === "done" && (
          <p className="pt-planted-status" role="status">
            <Check size={20} aria-hidden="true" /> Today’s entry is planted.
          </p>
        )}
        <p className="pt-hint">
          This sample journal is read only. Use the fresh profile to add your own entries.
        </p>
        {today.kind !== "pending" && (
          <div className="pt-planted-links">
            <FlowLink className="pt-primary" to={"/patient/entries/" + today.entry.id}>
              See today’s entry
            </FlowLink>
          </div>
        )}
      </div>
    </MailboxShell>
  );
}

export function Home() {
  const { user } = useAuth();
  const { entries, error } = usePatientEntries();
  const state = entries ? todayState(entries) : null;
  const first = user!.name.split(" ")[0];
  return (
    <section className="pt-home pt-wrap" aria-labelledby="pt-welcome">
      <h1 id="pt-welcome">Welcome, {first}.</h1>
      <p className="pt-daily">{dailyLine(state?.kind === "done")}</p>
      {error && !entries && (
        <p className="pt-error" role="alert">
          <CircleAlert size={18} aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
      {!entries ? (
        <div className="pt-mailbox is-waiting" aria-busy="true">
          <p className="pt-hint">Opening your mailbox…</p>
        </div>
      ) : user!.source === "simulated" ? (
        <SampleMailbox entries={entries} />
      ) : (
        <Mailbox entries={entries} />
      )}
    </section>
  );
}
