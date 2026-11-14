import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  Route,
  Routes,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { GrowthProvider, YourSpace, useGrowth } from "./growth";
import {
  GardenHome,
  JournalLog,
  LeafMenu,
  MyGarden,
  TodayNotice,
} from "./garden";
import { reflectionFor } from "./today";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCheck,
  ChevronRight,
  CloudSun,
  Flower2,
  Heart,
  Leaf,
  Link2,
  LockKeyhole,
  LogOut,
  Mic,
  Plus,
  Printer,
  Search,
  Settings2,
  ShieldCheck,
  Sprout,
  Trash2,
  Users,
  Wind,
  X,
} from "lucide-react";
import { api, dateLabel, json, setToken, getToken } from "./api";
import type {
  Clinical,
  Entry,
  Health,
  Insights,
  Recommendation,
  User,
} from "./types";
import {
  Badge,
  ContextCards,
  Empty,
  ErrorNotice,
  Loading,
  PrivacyNote,
  Recorder,
  SectionTitle,
  TextLink,
  VoiceChart,
  Wordmark,
  actionIcons,
} from "./components";

const Auth = createContext<{
  user: User | null;
  health: Health | null;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
}>({
  user: null,
  health: null,
  login: async () => {
    throw Error();
  },
  logout: () => {},
});
function useResource<T>(path: string, interval = 0) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState("");
  const active = useRef(0);
  const refresh = useCallback(async () => {
    const id = ++active.current;
    try {
      const result = await api<T>(path);
      if (id === active.current) {
        setData(result);
        setError("");
      }
    } catch (e) {
      if (id === active.current) setError((e as Error).message);
    }
  }, [path]);
  useEffect(() => {
    setData(null);
    void refresh();
    const timer = interval
      ? setInterval(() => {
          if (document.visibilityState === "visible") void refresh();
        }, interval)
      : undefined;
    return () => {
      active.current++;
      clearInterval(timer);
    };
  }, [refresh, interval]);
  return { data, error, refresh };
}

export function App() {
  const reducedMotion = useReducedMotion();
  const [user, setUser] = useState<User | null>(null),
    [health, setHealth] = useState<Health | null>(null),
    [ready, setReady] = useState(false);
  const [backendError, setBackendError] = useState("");
  useEffect(() => {
    void api<Health>("/health")
      .then(setHealth)
      .catch(() =>
        setBackendError(
          "The API is offline. Start the backend to explore the journal.",
        ),
      );
    if (getToken())
      void api<User>("/auth/me")
        .then(setUser)
        .catch(() => setToken(null))
        .finally(() => setReady(true));
    else setReady(true);
    const expired = () => {
      setUser(null);
    };
    window.addEventListener("numa:expired", expired);
    return () => window.removeEventListener("numa:expired", expired);
  }, []);
  async function login(email: string, password: string) {
    const result = await api<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: json({ email, password }),
    });
    setToken(result.token);
    setUser(result.user);
    return result.user;
  }
  function logout() {
    setToken(null);
    setUser(null);
  }
  if (!ready) return <Loading />;
  return (
    <Auth.Provider value={{ user, health, login, logout }}>
      <motion.div
        initial={reducedMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
      >
        {backendError && (
          <div className="connection-banner">{backendError}</div>
        )}
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login/:role" element={<Login />} />
          <Route element={<Guard role="patient" />}>
            <Route path="/patient" element={<PatientLayout />}>
              <Route index element={<Journal />} />
              <Route path="journal" element={<JournalPage />} />
              <Route path="garden" element={<MyGardenPage />} />
              <Route path="new" element={<NewEntry />} />
              <Route path="entries/:id" element={<EntryPage />} />
              <Route path="insights" element={<InsightsPage />} />
              <Route path="connections" element={<Connections />} />
              <Route path="space" element={<SpacePage />} />
            </Route>
          </Route>
          <Route element={<Guard role="psychologist" />}>
            <Route path="/clinic" element={<ClinicLayout />}>
              <Route index element={<ClinicDashboard />} />
              <Route path="patients/:id" element={<ClinicalDetail />} />
              <Route
                path="patients/:id/report"
                element={<ClinicalDetail report />}
              />
            </Route>
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </motion.div>
    </Auth.Provider>
  );
}
function Guard({ role }: { role: User["role"] }) {
  const { user } = useContext(Auth);
  return !user ? (
    <Navigate to={"/login/" + role} replace />
  ) : user.role !== role ? (
    <Navigate to={user.role === "patient" ? "/patient" : "/clinic"} replace />
  ) : (
    <Outlet />
  );
}

function Botanical({ small = false }: { small?: boolean }) {
  return (
    <div className={"botanical " + (small ? "small" : "")} aria-hidden="true">
      <svg viewBox="0 0 400 400">
        <circle cx="200" cy="200" r="172" fill="#e9eddf" />
        <circle
          cx="200"
          cy="200"
          r="144"
          fill="none"
          stroke="#d0dac6"
          strokeDasharray="2 9"
        />
        {Array.from({ length: 8 }, (_, i) => (
          <ellipse
            key={i}
            cx="200"
            cy="144"
            rx="38"
            ry="70"
            fill={i % 2 ? "#b5c7a6" : "#92af8b"}
            opacity=".78"
            transform={`rotate(${i * 45} 200 200)`}
          />
        ))}
        <circle cx="200" cy="200" r="33" fill="#f1e7c8" />
        <circle cx="200" cy="200" r="19" fill="#f7f3e7" />
      </svg>
      <span className="orbit-note note-one">
        <span />a little more understood
      </span>
      <span className="orbit-note note-two">
        <Leaf size={15} />
        one day at a time
      </span>
    </div>
  );
}
function Landing() {
  return (
    <div className="landing">
      <header className="landing-header">
        <Wordmark />
        <span className="landing-tag">A little space for you</span>
        <Link to="/login/psychologist" className="quiet-button">
          For psychologists <ArrowUpRight size={16} />
        </Link>
      </header>
      <main className="landing-main">
        <div className="landing-copy">
          <Badge tone="green">
            <Sprout size={13} /> A journal that grows with you
          </Badge>
          <h1>
            Some days,
            <br />
            the words
            <br />
            come <em>later.</em>
          </h1>
          <p>
            Start with a voice note. Numa brings together what you share and the
            patterns in your voice, learning the little things that help you
            along the way.
          </p>
          <div className="button-row">
            <Link to="/login/patient" className="button primary">
              Make a little space <ArrowRight size={18} />
            </Link>
            <Link to="/login/patient?sample=1" className="button outline">
              Explore a sample journal
            </Link>
          </div>
          <div className="landing-trust">
            <LockKeyhole size={15} />
            Your journal is yours. Share trends, keep your words.
          </div>
        </div>
        <Botanical />
      </main>
      <div className="landing-features">
        <div>
          <Mic />
          <h3>Talk, just as you are</h3>
          <p>No scores to fill in. No right way to start.</p>
        </div>
        <div>
          <Leaf />
          <h3>Notice your own patterns</h3>
          <p>A gentle picture, built one day at a time.</p>
        </div>
        <div>
          <Heart />
          <h3>Find your small next step</h3>
          <p>Discover what you personally find helpful.</p>
        </div>
      </div>
      <footer className="landing-footer">
        <span>Made with care, for the days between appointments.</span>
        <span>Junction prototype · Illustrative examples</span>
      </footer>
    </div>
  );
}

function Login() {
  const { role } = useParams(),
    [params] = useSearchParams();
  const sample = params.has("sample");
  const clinic = role === "psychologist";
  const { login, user, health } = useContext(Auth);
  const navigate = useNavigate();
  const [email, setEmail] = useState(
    clinic
      ? "psychologist@numa.demo"
      : sample
        ? "sample@numa.demo"
        : "patient@numa.demo",
  );
  const [password, setPassword] = useState("");
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  if (user)
    return (
      <Navigate to={user.role === "patient" ? "/patient" : "/clinic"} replace />
    );
  return (
    <div className="login-page">
      <Link to="/" className="back-link">
        <ArrowLeft size={16} /> Back
      </Link>
      <div className="login-card">
        <Wordmark />
        <span className="eyebrow">
          {clinic ? "A clearer view, with privacy" : "Your words. Your space."}
        </span>
        <h1>
          {clinic
            ? "Welcome to your practice."
            : sample
              ? "A journal, already growing."
              : "A quiet place to begin."}
        </h1>
        <p>
          {clinic
            ? "Follow the patterns that matter, while personal journal entries remain private."
            : sample
              ? "Explore Robin’s fictional journal and discover how personal patterns take shape."
              : "Leave a voice note about your day. There is no questionnaire to complete."}
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const u = await login(email, password);
              navigate(u.role === "patient" ? "/patient" : "/clinic");
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Demo email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
          {health?.mode === "local_preview" && (
            <div className="demo-credentials">
              Local preview password:{" "}
              <button
                type="button"
                onClick={() =>
                  setPassword(
                    clinic
                      ? "care-demo"
                      : sample
                        ? "sample-demo"
                        : "journal-demo",
                  )
                }
              >
                {clinic ? "care-demo" : sample ? "sample-demo" : "journal-demo"}{" "}
                <ArrowUpRight size={12} />
              </button>
            </div>
          )}
          <ErrorNotice message={error} />
          <button disabled={busy} className="button primary full">
            {busy
              ? "Opening your space…"
              : clinic
                ? "Open practice dashboard"
                : sample
                  ? "Explore the sample"
                  : "Open my journal"}
            <ArrowRight size={17} />
          </button>
        </form>
        <small>
          Demonstration accounts only. Please use fictional experiences.
        </small>
        <Link
          to={clinic ? "/login/patient" : "/login/psychologist"}
          className="text-link"
        >
          {clinic ? "Looking for your journal?" : "Are you a psychologist?"}
          <ArrowUpRight size={15} />
        </Link>
      </div>
    </div>
  );
}
function ModeBanner() {
  const { health, user } = useContext(Auth);
  return (
    <div className="mode-note">
      <span className="status-dot" />
      {health?.mode === "local_preview"
        ? "Local preview · ephemeral data · acoustic measurements only"
        : "Connected prototype · experimental voice analysis"}
      {user?.source === "simulated" && " · Fictional profile"}
    </div>
  );
}
function PatientLayout() {
  const { user } = useContext(Auth);
  return (
    <GrowthProvider key={user!.id}>
      <PatientFrame />
    </GrowthProvider>
  );
}
function PatientFrame() {
  const { logout } = useContext(Auth);
  const { growth } = useGrowth();
  return (
    <div
      className={
        "patient-app garden-app " + (growth?.simple_mode ? "is-simple" : "")
      }
    >
      <header className="garden-header">
        <Link to="/patient" className="wordmark" aria-label="Your garden home">
          <svg viewBox="0 0 40 40" aria-hidden="true">
            <path d="M7 29V16c0-9 13-9 13 0v13-9c0-9 13-9 13 0v9" />
          </svg>
          numa<span className="wordmark-dot">.</span>
        </Link>
        <LeafMenu onSignOut={logout} />
      </header>
      <main className="garden-main">
        <Outlet />
      </main>
      <footer className="garden-footer">
        <ModeBanner />
        <span>Research prototype · No clinical diagnosis</span>
      </footer>
    </div>
  );
}

function Journal() {
  const { user } = useContext(Auth);
  const entries = useResource<Entry[]>("/patient/entries", 5000);
  return (
    <GardenHome user={user!} entries={entries.data} error={entries.error} />
  );
}
function JournalPage() {
  const { user } = useContext(Auth);
  const entries = useResource<Entry[]>("/patient/entries", 5000);
  return (
    <JournalLog
      entries={entries.data}
      error={entries.error}
      sample={user!.source === "simulated"}
    />
  );
}
function MyGardenPage() {
  const { user } = useContext(Auth);
  const entries = useResource<Entry[]>("/patient/entries", 5000);
  const insights = useResource<Insights>("/patient/insights", 5000);
  return (
    <MyGarden
      user={user!}
      entries={entries.data}
      insights={insights.data}
      error={entries.error || insights.error}
    />
  );
}
function SpacePage() {
  const { user } = useContext(Auth);
  return (
    <>
      <Link to="/patient/garden" className="back-link">
        <ArrowLeft size={15} /> My garden
      </Link>
      <YourSpace user={user!} />
    </>
  );
}

function NewEntry() {
  const { user, health } = useContext(Auth);
  const navigate = useNavigate();
  const [blob, setBlob] = useState<Blob | null>(null),
    [text, setText] = useState(""),
    [write, setWrite] = useState(false),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const requestId = useRef(crypto.randomUUID());
  const existing = useResource<Entry[]>("/patient/entries");
  async function submit() {
    setBusy(true);
    setError("");
    try {
      let entry: Entry;
      if (write) {
        entry = await api<Entry>("/patient/entries/text", {
          method: "POST",
          body: json({ text, request_id: requestId.current }),
        });
      } else {
        const form = new FormData();
        form.append("audio", blob!, "journal.webm");
        form.append("request_id", requestId.current);
        entry = await api<Entry>("/patient/entries/audio", {
          method: "POST",
          body: form,
        });
      }
      navigate("/patient/entries/" + entry.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (user?.source === "simulated")
    return (
      <Empty title="This journal is a fictional sample">
        Use the fresh patient profile to create your own demonstration entries.
      </Empty>
    );
  return (
    <div className="narrow-page">
      <Link to="/patient" className="back-link">
        <ArrowLeft size={15} /> Your garden
      </Link>
      <TodayNotice entries={existing.data} />
      <div className="centred-heading">
        <h1>What happened in your world?</h1>
        <p>
          Tell me about something from your day.
          <br />A passing thought is a perfectly good place to start.
        </p>
      </div>
      <section className="recording-card">
        {!write ? (
          <Recorder onReady={setBlob} onClear={() => setBlob(null)} />
        ) : (
          <label className="written-label">
            Your note
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={16000}
              placeholder="Today, I noticed…"
              rows={7}
            />
          </label>
        )}
        <button
          className="text-link recording-toggle"
          onClick={() => setWrite(!write)}
        >
          {write ? (
            <>
              <Mic size={15} />
              I’d rather leave a voice note
            </>
          ) : (
            <>
              <BookOpen size={15} />
              I’d rather write today
            </>
          )}
        </button>
      </section>
      <label className="consent">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        <span>
          {health?.mode === "local_preview"
            ? "I understand this preview uses temporary server memory. Audio is processed for acoustic measurements; emotional ML is not active. If Gemini is unavailable, I can add the words myself."
            : "I agree to temporary audio processing by Numa on Modal and transcription by Gemini. My saved words remain private to my account. Audio is not retained by Numa after processing."}{" "}
          Use fictional experiences for this demonstration.
        </span>
      </label>
      <ErrorNotice message={error} />
      <button
        className="button primary full"
        disabled={busy || !consent || (write ? !text.trim() : !blob)}
        onClick={() => void submit()}
      >
        {busy ? "Opening your page…" : "Make a little sense of today"}
        <ArrowRight size={17} />
      </button>
      <PrivacyNote />
    </div>
  );
}

function EntryPage() {
  const { growth } = useGrowth();
  const { id } = useParams();
  const resource = useResource<Entry>("/patient/entries/" + id, 1800);
  const { data: entry } = resource;
  const navigate = useNavigate();
  const [text, setText] = useState(""),
    [summary, setSummary] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [edited, setEdited] = useState(false),
    [confirmDelete, setConfirmDelete] = useState(false);
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
      await resource.refresh();
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
      navigate("/patient");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  if (!entry)
    return (
      <>
        <ErrorNotice message={resource.error} />
        {!resource.error && <Loading />}
      </>
    );
  const processing = ["pending", "processing"].includes(entry.status),
    sample = entry.source === "simulated";
  return (
    <div className="entry-page">
      <div className="back-row">
        <Link to="/patient" className="back-link">
          <ArrowLeft size={15} /> Your garden
        </Link>
        <Link to="/patient/journal" className="back-link">
          Journal
        </Link>
      </div>
      <div className="page-heading">
        <div>
          <p className="soft-date">{dateLabel(entry.created_at)}</p>
          <h1>{processing ? "Listening to your day…" : entry.title}</h1>
          {!processing && (
            <p className="reflection entry-reflection">
              {reflectionFor(entry)}
            </p>
          )}
        </div>
        <Badge>
          <LockKeyhole size={12} /> Private entry
        </Badge>
      </div>
      {processing ? (
        <div className="analysis-card">
          <div className="thinking-flower">✳</div>
          <h2>Finding the threads.</h2>
          <p>
            Listening to your voice and understanding your words separately.
          </p>
          <span className="small-text muted">
            You can leave this page and come back.
          </span>
        </div>
      ) : (
        <>
          <div className="entry-detail-grid">
            <section className="paper-card private-writing">
              <div className="card-topline">
                <h2>Your words</h2>
                <Badge>
                  {sample
                    ? "Fictional entry"
                    : entry.saved
                      ? "Saved in your journal"
                      : "Draft"}
                </Badge>
              </div>
              <label>
                Transcript
                <textarea
                  readOnly={sample}
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    setEdited(true);
                  }}
                  rows={6}
                  maxLength={16000}
                  placeholder="Transcription unavailable? Add the words you want to keep."
                />
              </label>
              <label>
                A little summary
                <textarea
                  readOnly={sample}
                  value={summary}
                  onChange={(e) => {
                    setSummary(e.target.value);
                    setEdited(true);
                  }}
                  rows={3}
                  maxLength={1500}
                />
              </label>
              {!sample && (
                <p className="field-help">
                  Make these words your own. Corrections update the text
                  analysis, while voice measurements stay unchanged.
                </p>
              )}
              <div className="tag-row">
                {entry.tags.map((t) => (
                  <span className="tag" key={t}>
                    {t}
                  </span>
                ))}
              </div>
            </section>
            <details
              className="optional-signals"
              open={
                (!growth?.simple_mode && growth?.modules.includes("voice")) ||
                undefined
              }
            >
              <summary>
                What Numa noticed{" "}
                <span>Optional · voice and words, kept separate</span>
              </summary>
              <aside className="signal-stack">
                <div className="signal-card">
                  <span className="eyebrow">
                    <Mic size={13} /> From your voice
                  </span>
                  <p>
                    {entry.voice?.observation ||
                      "Voice analysis is unavailable for this entry. Your words can still be saved."}
                  </p>
                  <span className="source-label">
                    {entry.voice?.source === "simulated"
                      ? "Illustrative measurements"
                      : entry.voice?.model
                        ? "Experimental ML + acoustic measurements"
                        : entry.voice
                          ? "Measured acoustics · ML not active"
                          : "No vocal signal"}
                  </span>
                  {entry.voice?.features && (
                    <div className="voice-facts">
                      <span>{entry.voice.features.duration_sec}s recorded</span>
                      {entry.voice.quality === "valid" && (
                        <span>
                          {Math.round(
                            (entry.voice.features.pause_ratio || 0) * 100,
                          )}
                          % pauses
                        </span>
                      )}
                    </div>
                  )}
                  {entry.voice?.probabilities &&
                    Object.keys(entry.voice.probabilities).length > 0 && (
                      <details className="model-details">
                        <summary>
                          {entry.source === "simulated"
                            ? "Illustrative model output"
                            : "Experimental model output"}
                        </summary>
                        <p>
                          Vocal-expression categories describe the model’s
                          estimate, not your actual feelings.
                        </p>
                        {Object.entries(entry.voice.probabilities).map(
                          ([label, probability]) => (
                            <div className="model-probability" key={label}>
                              <span>
                                {(
                                  {
                                    neu: "Neutral",
                                    hap: "Happy",
                                    sad: "Sad",
                                    ang: "Angry",
                                  } as Record<string, string>
                                )[label] || label}
                              </span>
                              <span>{Math.round(probability * 100)}%</span>
                            </div>
                          ),
                        )}
                      </details>
                    )}
                </div>
                <div className="signal-card">
                  <span className="eyebrow">
                    <BookOpen size={13} /> In your own words
                  </span>
                  {entry.explicit.length ? (
                    entry.explicit.map((signal, i) => (
                      <div className="explicit-signal" key={i}>
                        <strong>{signal.feeling}</strong>
                        <q>{signal.evidence}</q>
                      </div>
                    ))
                  ) : (
                    <p>
                      No explicit feeling was recorded. You don’t need to name
                      one.
                    </p>
                  )}
                  <span className="source-label">
                    {entry.semantic_source === "gemini"
                      ? "Explicit mentions · Gemini"
                      : entry.semantic_source === "simulated"
                        ? "Illustrative self-report"
                        : "No inferred self-report"}
                  </span>
                </div>
                <div className="quiet-info">
                  These are separate perspectives. A voice estimate never
                  overrides your experience.
                </div>
              </aside>
            </details>
          </div>
          {entry.analysis?.errors.map((e, i) => (
            <ErrorNotice key={i} message={e} />
          ))}
          <ErrorNotice message={error} />
          <div className="entry-save-row">
            {!sample && (
              <>
                <button
                  className="button primary"
                  onClick={() => void save()}
                  disabled={busy || (entry.saved && !edited)}
                >
                  {busy
                    ? "Saving…"
                    : entry.saved
                      ? edited
                        ? "Save changes"
                        : "Saved"
                      : "Save this page"}
                  <Check size={16} />
                </button>
                {!confirmDelete ? (
                  <button
                    className="quiet-button danger"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 size={15} />
                    {entry.saved ? "Delete entry" : "Discard draft"}
                  </button>
                ) : (
                  <div className="button-row">
                    <span>Delete this page?</span>
                    <button
                      className="button danger"
                      disabled={busy}
                      onClick={() => void remove()}
                    >
                      Delete
                    </button>
                    <button
                      className="quiet-button"
                      onClick={() => setConfirmDelete(false)}
                    >
                      Keep it
                    </button>
                  </div>
                )}
              </>
            )}
            <PrivacyNote />
          </div>
          {entry.saved && !sample && (
            <ActionPanel entry={entry} refresh={resource.refresh} />
          )}
          {!growth?.simple_mode &&
            growth?.modules.some((m) =>
              ["sleep", "activity", "music"].includes(m),
            ) && (
              <div className="context-section">
                <SectionTitle title="The context around this day">
                  <Badge>Simulated data</Badge>
                </SectionTitle>
                <ContextCards
                  context={entry.context}
                  modules={growth.modules}
                />
              </div>
            )}
        </>
      )}
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
  const Icon = actionIcons[kind || "walk"] || Leaf;
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
  return (
    <section className="action-panel">
      <div className="action-icon">
        <Icon size={25} />
      </div>
      <div className="action-content">
        <span className="eyebrow">A small next step · always optional</span>
        <h2>
          {entry.action?.completed_at
            ? "You made a little space."
            : rec.data?.title || "Finding a small next step…"}
        </h2>
        <p>
          {entry.action?.completed_at
            ? "Keep what works for you. There is no right answer here."
            : rec.data?.description}
        </p>
        {!entry.action?.completed_at && (
          <>
            <p className="evidence-reason">
              {rec.data?.explanation || rec.data?.reason}
            </p>
            <div className="button-row">
              <button
                className="button primary"
                disabled={busy || !rec.data}
                onClick={() => void update()}
              >
                <Check size={16} /> I tried this
              </button>
              {kind === "breathe" && (
                <button
                  className="button outline"
                  onClick={() => setBreathing(!breathing)}
                >
                  <Wind size={16} />
                  {breathing ? "Close breathing guide" : "Open breathing guide"}
                </button>
              )}
              <span className="muted small-text">
                {rec.data?.minutes} gentle minutes
              </span>
            </div>
          </>
        )}
        {breathing && (
          <div className="breathing-guide">
            <div className="breathing-circle" />
            <span>Breathe in and out comfortably. Follow your own pace.</span>
          </div>
        )}
        {entry.action?.completed_at && (
          <>
            <h4>Was this useful for you?</h4>
            <div className="feedback-row">
              {[
                { value: "helpful", text: "Helpful", Icon: Leaf },
                { value: "not_helpful", text: "Not helpful", Icon: X },
                { value: "skip", text: "Skip", Icon: ArrowRight },
              ].map((f) => (
                <button
                  key={f.value}
                  disabled={busy}
                  className={
                    "feedback-button " +
                    (entry.action?.feedback === f.value ? "selected" : "")
                  }
                  onClick={() => void update(f.value)}
                >
                  <f.Icon size={15} />
                  {f.text}
                </button>
              ))}
            </div>
            <button
              className="text-link"
              onClick={() => setFollowing(!following)}
            >
              <Mic size={14} />
              {following
                ? "Close comparison"
                : "Optionally add a short voice comparison"}
            </button>
            {following && (
              <div className="follow-up">
                <p>
                  Say anything you like. A difference in voice does not prove
                  that an activity helped.
                </p>
                <Recorder
                  onReady={setBlob}
                  onClear={() => setBlob(null)}
                  label="Record a voice comparison"
                />
                <button
                  className="button primary"
                  disabled={busy || !blob}
                  onClick={() => void sendFollow()}
                >
                  Save comparison <ArrowRight size={16} />
                </button>
              </div>
            )}
            {entry.follow_up && (
              <div className="follow-result">
                {["pending", "processing"].includes(entry.follow_up.status) ? (
                  "Listening to your comparison…"
                ) : entry.follow_up.voice ? (
                  <>
                    <CheckCheck size={16} /> Comparison recorded.{" "}
                    {entry.follow_up.interpretation}
                  </>
                ) : (
                  "Comparison could not be analysed. You can try recording again."
                )}
              </div>
            )}
          </>
        )}
        <ErrorNotice message={error || rec.error} />
      </div>
    </section>
  );
}

function InsightsPage() {
  const { data, error } = useResource<Insights>("/patient/insights", 5000);
  const { user } = useContext(Auth);
  const { growth } = useGrowth();
  const [preferences, setPreferences] = useState<string[] | null>(null),
    [saved, setSaved] = useState(false),
    [saveError, setSaveError] = useState("");
  if (!growth) return <Loading />;
  if (
    growth.simple_mode ||
    !growth.modules.some((m) => m === "voice" || m === "patterns")
  )
    return (
      <Empty title="Your journal is already enough">
        <Link className="text-link" to="/patient/space">
          Choose what you would like to explore <ArrowRight size={15} />
        </Link>
      </Empty>
    );
  return (
    <>
      <Link to="/patient/garden" className="back-link">
        <ArrowLeft size={15} /> My garden
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">One day at a time</span>
          <h1>Getting to know you.</h1>
          <p>A little understanding, built from your own experience.</p>
        </div>
        <Flower2 className="heading-flower" size={45} />
      </div>
      <ErrorNotice message={error} />
      {!data ? (
        <Loading />
      ) : (
        <>
          {growth.modules.includes("voice") && (
            <section className="paper-card">
              <SectionTitle
                eyebrow="Your own reference"
                title="The rhythm of your voice"
              >
                <Badge tone={data.trend.ready ? "green" : "quiet"}>
                  {data.trend.ready ? "Personal baseline" : "Still learning"}
                </Badge>
              </SectionTitle>
              <VoiceChart trend={data.trend} />
              <p className="field-help">
                Measurements are sensitive to microphones, surroundings and how
                you speak. These differences are observations, not a diagnosis.
              </p>
            </section>
          )}
          {growth.modules.includes("patterns") && (
            <section className="context-section">
              <SectionTitle title="What you’ve found helpful">
                <Badge>Based on your feedback</Badge>
              </SectionTitle>
              {data.patterns.length ? (
                <div className="pattern-grid">
                  {data.patterns.map((p) => {
                    const Icon = actionIcons[p.kind];
                    return (
                      <article className="pattern-card" key={p.kind}>
                        <Icon size={23} />
                        <h3>{p.label}</h3>
                        <strong className="pattern-number">
                          {p.helpful}
                          <span> / {p.observations}</span>
                        </strong>
                        <p>{p.text}</p>
                        <small>{p.observations} personal observations</small>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <Empty title="Your own little discoveries">
                  Try an optional activity and leave feedback when you want.
                  Patterns will appear here as your journal grows.
                </Empty>
              )}
            </section>
          )}
          <section className="paper-card preference-card">
            <SectionTitle title="Make this space yours">
              <Settings2 size={20} />
            </SectionTitle>
            <p>Which small activities would you like Numa to suggest?</p>
            <div className="preference-options">
              {Object.entries(actionIcons).map(([key, Icon]) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    disabled={user?.source === "simulated"}
                    checked={(preferences || data.preferences).includes(key)}
                    onChange={(e) => {
                      const current = preferences || data.preferences;
                      setPreferences(
                        e.target.checked
                          ? [...current, key]
                          : current.filter((k) => k !== key),
                      );
                      setSaved(false);
                    }}
                  />
                  <Icon size={18} />
                  {
                    (
                      {
                        walk: "Short walks",
                        music: "Music",
                        breathe: "Breathing",
                        connect: "Connection",
                      } as Record<string, string>
                    )[key]
                  }
                </label>
              ))}
            </div>
            {user?.source !== "simulated" && (
              <button
                className="button outline"
                disabled={!preferences?.length || saved}
                onClick={async () => {
                  try {
                    await api("/patient/preferences", {
                      method: "PATCH",
                      body: json({ actions: preferences }),
                    });
                    setSaved(true);
                    setSaveError("");
                  } catch (e) {
                    setSaveError((e as Error).message);
                  }
                }}
              >
                {saved ? "Preferences saved" : "Save preferences"}
                <Check size={15} />
              </button>
            )}
            <ErrorNotice message={saveError} />
          </section>
        </>
      )}
      <PrivacyNote />
    </>
  );
}

function Connections() {
  return (
    <>
      <Link to="/patient/space" className="back-link">
        <ArrowLeft size={15} /> Your space
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            A fuller picture, with your permission
          </span>
          <h1>The context of your days.</h1>
          <p>
            Future connections could help you notice how everyday habits go
            together.
          </p>
        </div>
      </div>
      <div className="connection-info">
        <CloudSun size={22} />
        <div>
          <strong>Today’s context is illustrative.</strong>
          <p>
            Sleep, activity, weather and listening history use simulated data in
            this prototype. No external accounts are connected.
          </p>
        </div>
      </div>
      <div className="connections-grid">
        {[
          {
            icon: "♥",
            title: "Apple Health",
            text: "Sleep, steps and activity, with your permission.",
          },
          {
            icon: "♫",
            title: "Last.fm",
            text: "Listening habits alongside your own journal observations.",
          },
          {
            icon: "◷",
            title: "Calendar",
            text: "The shape of your day, with the details you choose.",
          },
          {
            icon: "◌",
            title: "Wearables",
            text: "Possible future links to Oura or Garmin.",
          },
        ].map((c) => (
          <article className="connection-card" key={c.title}>
            <span className="service-icon">{c.icon}</span>
            <h3>{c.title}</h3>
            <p>{c.text}</p>
            <Badge>Not connected · future integration</Badge>
          </article>
        ))}
      </div>
      <PrivacyNote />
    </>
  );
}

function ClinicLayout() {
  const { user, logout } = useContext(Auth);
  return (
    <div className="clinic-app">
      <aside className="clinic-sidebar no-print">
        <Wordmark />
        <div className="practice-label">PRACTICE SPACE</div>
        <NavLink to="/clinic" end>
          <Users size={18} />
          Overview
        </NavLink>
        <div className="sidebar-note">
          <ShieldCheck size={24} />
          <strong>A view with boundaries.</strong>
          <p>
            Patterns and shared activity feedback. Personal journal entries stay
            private.
          </p>
        </div>
        <div className="clinician-profile">
          <span className="avatar">ER</span>
          <div>
            <strong>{user?.name}</strong>
            <small>Psychologist</small>
          </div>
          <button
            className="icon-button"
            onClick={logout}
            aria-label="Sign out"
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <div className="clinic-content">
        <header className="clinic-topbar no-print">
          <span>
            YOUR PRACTICE / <strong>Patient wellbeing</strong>
          </span>
          <span>
            {new Date().toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
        </header>
        <main>
          <ModeBanner />
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>Numa · Professional space</span>
          <span>Research prototype · No clinical diagnosis</span>
        </footer>
      </div>
    </div>
  );
}
function ClinicDashboard() {
  const { data: patients, error } = useResource<Clinical[]>(
    "/clinic/patients",
    5000,
  );
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all");
  const review = patients?.filter((p) => p.status === "review") || [];
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            A little perspective between appointments
          </span>
          <h1>Your patients, thoughtfully.</h1>
          <p>See the patterns. Keep the person at the centre.</p>
        </div>
        <Badge tone="green">
          <span className="status-dot" />
          Updates every 5 seconds
        </Badge>
      </div>
      <ErrorNotice message={error} />
      {!patients ? (
        <Loading />
      ) : (
        <>
          <div className="clinic-stats">
            <article>
              <span>People in your care</span>
              <strong>
                {patients.length}
                <Users size={24} />
              </strong>
              <small>Assigned demonstration profiles</small>
            </article>
            <article>
              <span>Patterns to review</span>
              <strong>
                {review.length}
                <Leaf size={24} />
              </strong>
              <small>Persistent changes from personal baseline</small>
            </article>
            <article>
              <span>Journal pages</span>
              <strong>
                {patients.reduce((a, p) => a + p.entry_count, 0)}
                <BookOpen size={24} />
              </strong>
              <small>Content remains private to each patient</small>
            </article>
          </div>
          {review.map((p) => (
            <Link
              key={p.id}
              to={"/clinic/patients/" + p.id}
              className="review-banner"
            >
              <span className="review-icon">
                <Leaf size={22} />
              </span>
              <div>
                <strong>A pattern worth a closer look · {p.name}</strong>
                <p>
                  Three consecutive observations outside this person’s typical
                  vocal range. A conversation may add context.
                </p>
              </div>
              <ArrowRight size={20} />
            </Link>
          ))}
          <SectionTitle
            eyebrow="Your overview"
            title="People, beyond the patterns"
          >
            <span className="small-text muted">
              Trends only · private journals excluded
            </span>
          </SectionTitle>
          <div className="list-controls">
            <div className="filter-tabs">
              {[
                { k: "all", t: "All patients" },
                { k: "review", t: "To review" },
                { k: "learning", t: "Learning baseline" },
              ].map((f) => (
                <button
                  key={f.k}
                  onClick={() => setFilter(f.k)}
                  className={filter === f.k ? "active" : ""}
                >
                  {f.t}
                </button>
              ))}
            </div>
            <label className="search-field">
              <Search size={16} />
              <input
                aria-label="Search patients"
                placeholder="Find a person…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          </div>
          <div className="patient-table">
            <div className="table-heading">
              <span>Person</span>
              <span>Personal pattern</span>
              <span>Last journal entry</span>
              <span>Activity feedback</span>
              <span />
            </div>
            {patients
              .filter(
                (p) =>
                  p.name.toLowerCase().includes(search.toLowerCase()) &&
                  (filter === "all" || p.status === filter),
              )
              .map((p) => (
                <Link
                  to={"/clinic/patients/" + p.id}
                  key={p.id}
                  className="patient-row"
                >
                  <div className="table-person">
                    <span className={"avatar " + p.status}>{p.initials}</span>
                    <div>
                      <strong>{p.name}</strong>
                      <small>
                        {p.source === "simulated"
                          ? "Fictional history"
                          : "Fresh demonstration profile"}
                      </small>
                    </div>
                  </div>
                  <div>
                    <Badge
                      tone={
                        p.status === "review"
                          ? "amber"
                          : p.status === "steady"
                            ? "green"
                            : "quiet"
                      }
                    >
                      {p.status === "review"
                        ? "Review pattern"
                        : p.status === "steady"
                          ? "Within typical range"
                          : "Learning baseline"}
                    </Badge>
                  </div>
                  <div>
                    <strong>
                      {p.last_entry_at
                        ? dateLabel(p.last_entry_at)
                        : "No entries yet"}
                    </strong>
                    <small>{p.entry_count} saved pages</small>
                  </div>
                  <div>
                    <strong>{p.actions_completed} activities</strong>
                    <small>
                      {p.patterns.reduce((a, x) => a + x.observations, 0)}{" "}
                      feedback responses
                    </small>
                  </div>
                  <ChevronRight size={18} />
                </Link>
              ))}
          </div>
          <div className="clinical-privacy">
            <LockKeyhole size={19} />
            <p>
              Journal text, audio and summaries are excluded from this portal
              and its API responses.
            </p>
          </div>
        </>
      )}
    </>
  );
}

function ClinicalDetail({ report = false }: { report?: boolean }) {
  const { id } = useParams();
  const { data: p, error } = useResource<Clinical>(
    "/clinic/patients/" + id,
    5000,
  );
  const [note, setNote] = useState(""),
    [status, setStatus] = useState(""),
    [noteError, setNoteError] = useState("");
  const loaded = useRef("");
  useEffect(() => {
    if (p && loaded.current !== p.id) {
      setNote(p.notes.text);
      loaded.current = p.id;
    }
  }, [p]);
  if (!p)
    return (
      <>
        <ErrorNotice message={error} />
        {!error && <Loading />}
      </>
    );
  return (
    <div className={report ? "report-page" : ""}>
      <div className="no-print">
        <Link to="/clinic" className="back-link">
          <ArrowLeft size={15} /> All patients
        </Link>
      </div>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {report
              ? "Numa · One-page observation report"
              : "A person’s own patterns"}
          </span>
          <h1>{p.name}</h1>
          <p>
            {p.source === "simulated"
              ? "Fictional demonstration history"
              : "Fresh demonstration profile"}{" "}
            · {p.entry_count} private journal entries
          </p>
        </div>
        <div className="button-row no-print">
          {report ? (
            <button className="button outline" onClick={() => window.print()}>
              <Printer size={16} />
              Print / save PDF
            </button>
          ) : (
            <Link
              className="button outline"
              to={"/clinic/patients/" + id + "/report"}
            >
              <BookOpen size={16} />
              Observation report
            </Link>
          )}
        </div>
      </div>
      <ErrorNotice message={error} />
      <div className="detail-topline">
        <Badge
          tone={
            p.status === "review"
              ? "amber"
              : p.status === "steady"
                ? "green"
                : "quiet"
          }
        >
          {p.status === "review"
            ? "Pattern review suggested"
            : p.status === "steady"
              ? "Within typical range"
              : "Learning personal baseline"}
        </Badge>
        <span>
          <LockKeyhole size={13} /> Journal content is private
        </span>
      </div>
      <section className="paper-card">
        <SectionTitle
          eyebrow="Compared only with this person’s history"
          title="Voice observations"
        >
          <span className="small-text muted">
            {p.trend.days} distinct observation days
          </span>
        </SectionTitle>
        <VoiceChart trend={p.trend} />
        {p.trend.persistent_change && (
          <div className="pattern-review-note">
            Three consecutive observations differ from the first five baseline
            days. This heuristic is a prompt for professional review, not an
            assessment of depression.
          </div>
        )}
        <p className="field-help">
          Range uses median and median absolute deviation of energy and pauses.
          Microphone, recording conditions and speaking style may affect
          measurements.
        </p>
      </section>
      <section className="context-section">
        <SectionTitle title="Everyday context">
          <Badge>Simulated data</Badge>
        </SectionTitle>
        <ContextCards context={p.context} />
      </section>
      <section className="context-section">
        <SectionTitle title="Actions and patient feedback">
          <Badge>{p.actions_completed} activities completed</Badge>
        </SectionTitle>
        {p.patterns.length ? (
          <div className="clinical-patterns">
            {p.patterns.map((pattern) => {
              const Icon = actionIcons[pattern.kind];
              return (
                <div className="clinical-pattern" key={pattern.kind}>
                  <Icon size={18} />
                  <div>
                    <strong>{pattern.label}</strong>
                    <p>
                      {pattern.helpful} helpful / {pattern.observations}{" "}
                      responses
                    </p>
                  </div>
                  <div className="helpfulness-bar">
                    <span
                      style={{
                        width: `${(pattern.helpful / pattern.observations) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="muted">No shared activity feedback yet.</p>
        )}
        <p className="field-help">
          {p.follow_up_count} optional voice comparisons. Reported helpfulness
          and vocal changes are separate observations; neither establishes
          causality.
        </p>
      </section>
      {!report && (
        <section className="paper-card notes-card">
          <SectionTitle title="Your professional notes">
            <Badge>Psychologist only</Badge>
          </SectionTitle>
          <label>
            Notes
            <textarea
              maxLength={4000}
              rows={4}
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                setStatus("");
              }}
              placeholder="Add context for your next conversation…"
            />
          </label>
          <div className="button-row">
            <button
              className="button primary"
              onClick={async () => {
                try {
                  await api("/clinic/patients/" + id + "/notes", {
                    method: "PATCH",
                    body: json({ text: note }),
                  });
                  setStatus("Notes saved");
                  setNoteError("");
                } catch (e) {
                  setNoteError((e as Error).message);
                }
              }}
            >
              Save notes <Check size={15} />
            </button>
            <span role="status" className="small-text muted">
              {status}
            </span>
          </div>
          <ErrorNotice message={noteError} />
        </section>
      )}
      <div className="clinical-privacy">
        <ShieldCheck size={19} />
        <p>
          Observation coverage: {p.entry_count} entries, {p.trend.days} valid
          distinct days.{" "}
          {p.source === "simulated"
            ? "All history and measurements in this profile are illustrative."
            : "No fictional baseline is used for this profile."}{" "}
          No journal content is included.
        </p>
      </div>
    </div>
  );
}
function NotFound() {
  return (
    <div className="login-page">
      <div className="login-card">
        <Wordmark />
        <h1>This page wandered off.</h1>
        <Link to="/" className="button primary">
          Back to Numa <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}
