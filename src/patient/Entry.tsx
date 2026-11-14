// The entry page: one page of the journal (DESIGN.md → "Entry page").
// Its words, what Numa noticed (voice and words, always apart), a small next
// step and its feedback, an optional voice comparison, and delete.
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Check } from "lucide-react";
import { useAuth, useResource } from "../auth";
import { api, json } from "../api";
import { useGrowth } from "../growth";
import { GrowingTextarea, Loading, Problem, Recorder } from "../components";
import { FlowLink, useFlowNavigate } from "../design/flow";
import { PlantFigure, plantTransitionName } from "../design/Meadow";
import {
  catmullRom,
  gaussianEnvelope,
  mulberry32,
  r1,
  voiceWave,
} from "../design/voiceLine";
import { reflectionFor } from "../today";
import type { Entry, Recommendation } from "../types";
import { usePatientEntries } from "./Layout";

/** While an entry is being read: a still voice line, then a breathing dot. */
function ListeningLine() {
  const wave = voiceWave({
    to: 176,
    axis: 120,
    amp: 14,
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
  return (
    <svg className="ep-listening" viewBox="0 0 200 200" aria-hidden="true">
      <path className="pt-line-voice" d={d} />
      <circle className="ep-listening-dot" cx="188" cy="120" r="5" />
    </svg>
  );
}

const entryDate = (value: string) =>
  new Date(value).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

const PROBABILITY_LABELS: Record<string, string> = {
  neu: "Neutral",
  hap: "Happy",
  sad: "Sad",
  ang: "Angry",
};

/** What Numa noticed: voice and words, always as separate perspectives. */
function EntrySignals({
  entry,
  modules,
  simple,
}: {
  entry: Entry;
  modules: string[];
  simple: boolean;
}) {
  const features = entry.voice?.features;
  const context = entry.context;
  const contextModules = simple
    ? []
    : modules.filter((m) => ["sleep", "activity", "music"].includes(m));
  return (
    <>
      <h3>From your voice</h3>
      {features && (
        <p className="voice-facts">
          {Math.round(features.duration_sec)} seconds recorded
          {entry.voice?.quality === "valid"
            ? `, ${Math.round((features.pause_ratio || 0) * 100)}% pauses.`
            : "."}
        </p>
      )}
      {/* One source line only: the most descriptive one available. */}
      {!entry.voice ? (
        <p className="ep-source">
          No vocal signal. Your words can still be saved.
        </p>
      ) : entry.voice.quality !== "valid" ? (
        <>
          {/* Here the observation is the reason the audio could not be measured. */}
          {entry.voice.observation && <p>{entry.voice.observation}</p>}
          <p className="ep-source">Measured acoustics. ML not active.</p>
        </>
      ) : (
        <p className="ep-source">
          {entry.voice.observation ||
            (entry.voice.source === "simulated"
              ? "Illustrative voice measurements from a fictional journal."
              : entry.voice.model
                ? "Experimental ML and acoustic measurements."
                : "Measured acoustics. ML not active.")}
        </p>
      )}
      {entry.voice?.probabilities &&
        Object.keys(entry.voice.probabilities).length > 0 && (
          <details className="ep-model">
            <summary>
              {entry.source === "simulated"
                ? "Illustrative model output"
                : "Experimental model output"}
            </summary>
            <p>
              Vocal-expression categories describe the model’s estimate, not
              your actual feelings.
            </p>
            <dl>
              {Object.entries(entry.voice.probabilities).map(
                ([label, probability]) => (
                  <div key={label}>
                    <dt>
                      {PROBABILITY_LABELS[label] ||
                        label.charAt(0).toUpperCase() +
                          label.slice(1).toLowerCase()}
                    </dt>
                    <dd>{Math.round(probability * 100)}%</dd>
                  </div>
                ),
              )}
            </dl>
          </details>
        )}
      <h3>In your own words</h3>
      {entry.explicit.length ? (
        entry.explicit.map((signal, i) => (
          <blockquote className="ep-quote" key={i}>
            <span>{signal.feeling}</span> “{signal.evidence}”
          </blockquote>
        ))
      ) : (
        <p>No explicit feeling was recorded. You don’t need to name one.</p>
      )}
      <p className="ep-source">
        {entry.semantic_source === "gemini"
          ? "Explicit mentions, found by Gemini."
          : entry.semantic_source === "simulated"
            ? "Illustrative self-report."
            : "No inferred self-report."}
      </p>
      <p className="ep-perspectives">
        Two separate perspectives. A voice estimate never overrides your
        experience.
      </p>
      {contextModules.length > 0 && (
        <div className="ep-context">
          <h3>
            Around this day <span>Simulated</span>
          </h3>
          <ul>
            {contextModules.includes("sleep") && (
              <li>{context.sleep_hours} hours of sleep</li>
            )}
            {contextModules.includes("activity") && (
              <li>
                {context.steps.toLocaleString("en-GB")} steps and{" "}
                {context.outdoor_minutes} minutes outdoors
              </li>
            )}
            {contextModules.includes("music") && (
              <li>{context.music_minutes} minutes of music</li>
            )}
          </ul>
        </div>
      )}
    </>
  );
}

const ACTION_TITLES: Record<string, string> = {
  walk: "A short walk",
  music: "Your own music",
  breathe: "Quiet breathing",
  connect: "Reaching out",
};

/** The sample's next step, read only: what was tried and what they said. */
function ActionSummary({
  action,
  name,
}: {
  action: NonNullable<Entry["action"]>;
  name: string;
}) {
  const said =
    action.feedback === "helpful"
      ? " They said it helped."
      : action.feedback === "not_helpful"
        ? " They said it didn’t help."
        : action.feedback === "skip"
          ? " They skipped the question."
          : "";
  return (
    <section className="ep-step" aria-labelledby="ep-step-title">
      <div className="ep-wrap ep-step-inner">
        <p className="ep-step-kicker">A small next step, always optional</p>
        <h2 id="ep-step-title">
          {ACTION_TITLES[action.kind] ?? "A small next step"}
        </h2>
        {action.completed_at && (
          <p className="ep-step-desc">
            {name} tried this.{said}
          </p>
        )}
      </div>
    </section>
  );
}

export function EntryPage() {
  const { user } = useAuth();
  const { growth } = useGrowth();
  const { id } = useParams();
  const resource = useResource<Entry>("/patient/entries/" + id, 1800);
  const { data: entry } = resource;
  const patient = usePatientEntries();
  const go = useFlowNavigate();
  // The page and the rest of the journal (Home, My journal, the grass) stay in step.
  const refreshAll = async () => {
    await resource.refresh();
    void patient.refresh();
  };
  const [text, setText] = useState(""),
    [summary, setSummary] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [edited, setEdited] = useState(false),
    [editing, setEditing] = useState(false),
    [confirmAt, setConfirmAt] = useState<"sheet" | "foot" | null>(null);
  const initialized = useRef("");
  useEffect(() => {
    if (
      entry &&
      !["pending", "processing"].includes(entry.status) &&
      initialized.current !== entry.id
    ) {
      setText(entry.transcript);
      setSummary(entry.summary);
      initialized.current = entry.id;
    }
  }, [entry]);
  async function save() {
    if (!entry) return;
    setBusy(true);
    setError("");
    try {
      await api("/patient/entries/" + id, {
        method: "PATCH",
        body: json({ transcript: text, summary, saved: true }),
      });
      setEdited(false);
      setEditing(false);
      await refreshAll();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    try {
      await api("/patient/entries/" + id, { method: "DELETE" });
      await patient.refresh();
      go("/patient");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  function cancelEdit() {
    if (!entry) return;
    setText(entry.transcript);
    setSummary(entry.summary);
    setEdited(false);
    setEditing(false);
  }
  if (!entry)
    return (
      <div className="ep-wrap ep-loading">
        <Problem message={resource.error} />
        {!resource.error && <Loading />}
      </div>
    );
  const processing = ["pending", "processing"].includes(entry.status),
    sample = entry.source === "simulated",
    simple = !!growth?.simple_mode;
  const writing = !sample && !processing && (!entry.saved || editing);
  const longWords = (writing ? text : entry.transcript).length > 600;
  const confirm = (
    <div className="ep-confirm" role="group" aria-label="Confirm deletion">
      <span>Delete this entry? This can’t be undone.</span>
      <button
        type="button"
        className="ep-danger"
        disabled={busy}
        onClick={() => void remove()}
      >
        Delete
      </button>
      <button
        type="button"
        className="ep-link"
        onClick={() => setConfirmAt(null)}
      >
        Keep it
      </button>
    </div>
  );
  const signals = (
    <EntrySignals
      entry={entry}
      modules={growth?.modules ?? []}
      simple={simple}
    />
  );
  return (
    <div className="entry-page-v2">
      <nav className="ep-wrap ep-back" aria-label="Back to">
        <FlowLink to="/patient">Home</FlowLink>
        <FlowLink to="/patient/journal">My journal</FlowLink>
      </nav>
      <header className="ep-wrap ep-head">
        <div className="ep-head-text">
          <p className="ep-date">{entryDate(entry.created_at)}</p>
          <h1>{processing ? "Listening to your day…" : entry.title}</h1>
          <p className="ep-reflection entry-reflection">
            {processing
              ? "Finding the threads. Your voice and your words are read separately."
              : reflectionFor(entry)}
          </p>
          {processing && (
            <p className="ep-processing-note">
              You can leave this page and come back.
            </p>
          )}
        </div>
        <div className="ep-plant">
          {processing ? (
            <ListeningLine />
          ) : (
            <PlantFigure
              entry={entry}
              style={{ viewTransitionName: plantTransitionName(entry.id) }}
            />
          )}
        </div>
      </header>
      <div className="ep-wrap">
        <hr className="ep-rule" />
      </div>
      {!processing && (
        <>
          <div className="ep-wrap ep-body">
            <section className="ep-sheet" aria-labelledby="ep-words">
              <div className="ep-sheet-top">
                <h2 id="ep-words" className="ep-label">
                  Your words
                </h2>
                {entry.saved && !sample && !editing && (
                  <button
                    type="button"
                    className="ep-link"
                    onClick={() => setEditing(true)}
                  >
                    Edit words
                  </button>
                )}
              </div>
              {writing ? (
                <>
                  <GrowingTextarea
                    aria-label="Transcript"
                    className={
                      "ep-transcript ep-field" + (longWords ? " is-long" : "")
                    }
                    value={text}
                    onChange={(e) => {
                      setText(e.target.value);
                      setEdited(true);
                    }}
                    maxLength={16000}
                    placeholder="Transcription unavailable? Add the words you want to keep."
                  />
                  <label className="ep-label ep-short-label" htmlFor="ep-short">
                    In short
                  </label>
                  <GrowingTextarea
                    id="ep-short"
                    className="ep-summary ep-field"
                    value={summary}
                    onChange={(e) => {
                      setSummary(e.target.value);
                      setEdited(true);
                    }}
                    maxLength={1500}
                  />
                  <p className="ep-help">
                    Corrections update the text analysis. Voice measurements
                    stay the same.
                  </p>
                </>
              ) : (
                <>
                  <p
                    className={"ep-transcript" + (longWords ? " is-long" : "")}
                  >
                    {entry.transcript || "No words were kept for this entry."}
                  </p>
                  {summaryAddsSomething(entry.transcript, entry.summary) && (
                    <>
                      <h3 className="ep-label ep-short-label">In short</h3>
                      <p className="ep-summary">{entry.summary}</p>
                    </>
                  )}
                </>
              )}
              {entry.tags.length > 0 && (
                <p className="ep-tags">
                  <span className="visually-hidden">Themes: </span>
                  {entry.tags.join(" ")}
                </p>
              )}
              {entry.analysis?.errors.map((e, i) => (
                <Problem key={i} message={e} />
              ))}
              <Problem message={error} />
              <div className="ep-save">
                {sample ? (
                  <p className="ep-saved">A fictional entry, read only.</p>
                ) : !entry.saved ? (
                  <>
                    <button
                      type="button"
                      className="ep-primary"
                      disabled={busy}
                      onClick={() => void save()}
                    >
                      {busy ? "Saving…" : "Save this page"}
                    </button>
                    <button
                      type="button"
                      className="ep-link"
                      onClick={() => setConfirmAt("sheet")}
                    >
                      Discard draft
                    </button>
                  </>
                ) : editing ? (
                  <>
                    {/* Only offered once something changed: never a dead button. */}
                    {edited && (
                      <button
                        type="button"
                        className="ep-primary"
                        disabled={busy}
                        onClick={() => void save()}
                      >
                        {busy ? "Saving…" : "Save changes"}
                      </button>
                    )}
                    <button
                      type="button"
                      className="ep-link"
                      onClick={cancelEdit}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <p className="ep-saved" role="status">
                    <Check size={16} aria-hidden="true" /> Saved in your journal
                  </p>
                )}
              </div>
              {confirmAt === "sheet" && confirm}
            </section>
            <aside className="ep-noticed" aria-labelledby="ep-noticed">
              {simple ? (
                <details className="ep-noticed-fold">
                  <summary id="ep-noticed">What Numa noticed</summary>
                  {signals}
                </details>
              ) : (
                <>
                  <h2 id="ep-noticed">What Numa noticed</h2>
                  {signals}
                </>
              )}
            </aside>
          </div>
          {entry.saved && !sample && (
            <ActionPanel entry={entry} refresh={refreshAll} />
          )}
          {sample && entry.action && (
            <ActionSummary
              action={entry.action}
              name={user?.name.split(" ")[0] ?? "They"}
            />
          )}
        </>
      )}
      <footer className="ep-wrap ep-foot">
        <p>
          Your words stay in your journal. Your psychologist sees trends only.
        </p>
        {!sample && !processing && (
          <div className="ep-foot-delete">
            {confirmAt === "foot" ? (
              confirm
            ) : (
              <button
                type="button"
                className="ep-link"
                onClick={() => setConfirmAt("foot")}
              >
                {entry.saved ? "Delete entry" : "Discard draft"}
              </button>
            )}
          </div>
        )}
      </footer>
    </div>
  );
}

function ActionPanel({
  entry,
  refresh,
}: {
  entry: Entry;
  refresh: () => Promise<void>;
}) {
  const rec = useResource<Recommendation>("/patient/recommendation");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [following, setFollowing] = useState(false),
    [blob, setBlob] = useState<Blob | null>(null),
    [breathing, setBreathing] = useState(false);
  const kind = entry.action?.kind || rec.data?.kind;
  async function update(feedback?: string) {
    setBusy(true);
    try {
      await api("/patient/entries/" + entry.id + "/action", {
        method: "POST",
        body: json({
          kind,
          completed: true,
          ...(feedback ? { feedback } : {}),
        }),
      });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function sendFollow() {
    setBusy(true);
    try {
      const form = new FormData();
      form.append("audio", blob!, "comparison.webm");
      await api("/patient/entries/" + entry.id + "/follow-up", {
        method: "POST",
        body: form,
      });
      setFollowing(false);
      setBlob(null);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const done = !!entry.action?.completed_at;
  return (
    <section className="ep-step" aria-labelledby="ep-step-title">
      <div className="ep-wrap ep-step-inner">
        <p className="ep-step-kicker">A small next step, always optional</p>
        <h2 id="ep-step-title">
          {done
            ? "You made a little space."
            : rec.data?.title || "Finding a small next step…"}
        </h2>
        {!done && (
          <>
            {rec.data?.description && (
              <p className="ep-step-desc">{rec.data.description}</p>
            )}
            {(rec.data?.explanation || rec.data?.reason) && (
              <p className="ep-step-reason">
                {rec.data?.explanation || rec.data?.reason}
              </p>
            )}
            <div className="ep-step-actions">
              <button
                type="button"
                className="ep-primary"
                disabled={busy || !rec.data}
                onClick={() => void update()}
              >
                I tried this
              </button>
              {kind === "breathe" && (
                <button
                  type="button"
                  className="ep-pebble"
                  aria-expanded={breathing}
                  onClick={() => setBreathing(!breathing)}
                >
                  {breathing ? "Close breathing guide" : "Open breathing guide"}
                </button>
              )}
              {rec.data && <span>{rec.data.minutes} gentle minutes</span>}
            </div>
          </>
        )}
        {breathing && (
          <div className="ep-breath">
            <span className="ep-breath-circle" aria-hidden="true" />
            <p>Breathe in and out comfortably. Follow your own pace.</p>
          </div>
        )}
        {done && (
          <>
            <h3 className="ep-step-question">Was this useful for you?</h3>
            <div
              className="ep-feedback"
              role="group"
              aria-label="Was this useful for you?"
            >
              {[
                { value: "helpful", text: "Helpful" },
                { value: "not_helpful", text: "Not helpful" },
                { value: "skip", text: "Skip" },
              ].map((f) => {
                const chosen = entry.action?.feedback === f.value;
                return (
                  <button
                    type="button"
                    key={f.value}
                    disabled={busy}
                    aria-pressed={chosen}
                    className={"ep-pebble" + (chosen ? " selected" : "")}
                    onClick={() => void update(f.value)}
                  >
                    {chosen && <Check size={16} aria-hidden="true" />}
                    {f.text}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              className="ep-step-link"
              aria-expanded={following}
              onClick={() => setFollowing(!following)}
            >
              {following
                ? "Close comparison"
                : "Optionally add a short voice comparison"}
            </button>
            {following && (
              <div className="ep-follow">
                <p>
                  Say anything you like. A difference in voice does not prove
                  that an activity helped.
                </p>
                <Recorder
                  onReady={setBlob}
                  onClear={() => setBlob(null)}
                />
                <button
                  type="button"
                  className="ep-primary"
                  disabled={busy || !blob}
                  onClick={() => void sendFollow()}
                >
                  Save comparison
                </button>
              </div>
            )}
            {entry.follow_up && (
              <p className="ep-follow-result" role="status">
                {["pending", "processing"].includes(entry.follow_up.status)
                  ? "Listening to your comparison…"
                  : entry.follow_up.voice
                    ? `Comparison recorded. ${entry.follow_up.interpretation ?? ""}`
                    : "Comparison could not be analysed. You can try recording again."}
              </p>
            )}
          </>
        )}
        {(error || rec.error) && (
          <p className="ep-step-error" role="alert">
            {error || rec.error}
          </p>
        )}
      </div>
    </section>
  );
}

/* "In short" earns its place only when it says something the words don't.
   Compare ignoring case, runs of whitespace and trailing punctuation. */
function normaliseForCompare(text: string) {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[\s.!?…,;:"'”’)\]]+$/u, "");
}
function summaryAddsSomething(
  transcript: string | null | undefined,
  summary: string | null | undefined,
) {
  const s = normaliseForCompare(summary ?? "");
  return s !== "" && s !== normaliseForCompare(transcript ?? "");
}

