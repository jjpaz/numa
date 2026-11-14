import {
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type TextareaHTMLAttributes,
} from "react";
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { YourSpace, useGrowth } from "./growth";
import { Auth, useResource } from "./auth";
import { PatientLayout } from "./patient/Layout";
import { Home } from "./patient/Home";
import { EntryPage } from "./patient/Entry";
import { JournalPage } from "./patient/Journal";
import {
  EntryPlant,
  GardenHome,
  JournalLog,
  LoginMotif,
  ListeningLine,
  MyGarden,
  TodayNotice,
} from "./garden";
import { reflectionFor } from "./today";
import { Landing } from "./landing";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CircleAlert,
  CloudSun,
  Flower2,
  Leaf,
  Link2,
  LockKeyhole,
  LogOut,
  Mic,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Users,
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
  ContextCards,
  ErrorNotice,
  GrowingTextarea,
  Loading,
  Recorder,
  Wordmark,
  ACTION_KINDS,
} from "./components";
import { ObservationChart, Sparkline } from "./clinicCharts";

export function App() {
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
  async function demoLogin(
    name: string,
    role: "patient" | "psychologist",
    sample: boolean,
  ) {
    const result = await api<{ token: string; user: User }>("/auth/demo", {
      method: "POST",
      body: json({ name, role, sample }),
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
    <Auth.Provider value={{ user, health, login, demoLogin, logout }}>
      {/* No page-level fade: text is visible from the first frame on every page. */}
      <div>
        {backendError && (
          <div className="connection-banner">{backendError}</div>
        )}
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login/:role" element={<LoginRoute />} />
          <Route element={<Guard role="patient" />}>
            <Route path="/patient" element={<PatientLayout />}>
              <Route index element={<Home />} />
              <Route path="journal" element={<JournalPage />} />
              <Route path="garden" element={<MyGardenPage />} />
              <Route path="new" element={<Navigate to="/patient" replace />} />
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
      </div>
    </Auth.Provider>
  );
}
const SAMPLE_EMAIL = "sample@numa.demo";
const portalOf = (user: User) =>
  user.role === "patient" ? "/patient" : "/clinic";

function Guard({ role }: { role: User["role"] }) {
  const { user } = useContext(Auth);
  const location = useLocation();
  return !user ? (
    <Navigate to={"/login/" + role} replace />
  ) : user.role !== role ? (
    // Signed in with the other role: offer this portal's sign-in, remember where we were going.
    <Navigate
      to={"/login/" + role}
      replace
      state={{ from: location.pathname + location.search }}
    />
  ) : (
    // A different account remounts the whole portal, so no cached data carries over.
    <Outlet key={user.id} />
  );
}

/** Remount the form per account page so ?sample=1 never keeps the other email. */
function LoginRoute() {
  const { role } = useParams(),
    [params] = useSearchParams();
  return <Login key={role + (params.has("sample") ? ":sample" : "")} />;
}

function Login() {
  const { role } = useParams(),
    [params] = useSearchParams();
  const sample = params.has("sample");
  const clinic = role === "psychologist";
  const { login, demoLogin, user, health } = useContext(Auth);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const signingIn = useRef(false);
  // Does the current session belong to the account this page signs in?
  const sameAccount =
    !!user &&
    (clinic
      ? user.role === "psychologist"
      : user.role === "patient" && (user.email === SAMPLE_EMAIL) === sample);
  const [email, setEmail] = useState(
    clinic
      ? "psychologist@numa.demo"
      : sample
        ? "sample@numa.demo"
        : "patient@numa.demo",
  );
  const [password, setPassword] = useState("");
  const [name, setName] = useState(
    clinic ? "Dr. Emma" : sample ? "Robin" : "Alex",
  );
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  // One way in, two kinds of demo access: a name only (the public demo, when
  // the backend enables it) or the published demo email and password.
  const nameOnly = !!health?.demo_name_login;
  const previewPassword = clinic
    ? "care-demo"
    : sample
      ? "sample-demo"
      : "journal-demo";
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (nameOnly && !name.trim()) {
      setError("Please write a name. Any name will do.");
      return;
    }
    setBusy(true);
    setError("");
    signingIn.current = true;
    try {
      const u = nameOnly
        ? await demoLogin(
            name.trim(),
            clinic ? "psychologist" : "patient",
            sample,
          )
        : await login(email, password);
      const portal = portalOf(u);
      // Land where the person was going, if it belongs to this portal.
      navigate(
        from && (from === portal || from.startsWith(portal + "/"))
          ? from
          : portal,
        { replace: true },
      );
    } catch (err) {
      signingIn.current = false;
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (user && sameAccount && !signingIn.current)
    return <Navigate to={portalOf(user)} replace />;
  return (
    <div className={"lg-page" + (clinic ? " is-clinic" : "")}>
      <div className="lg-main">
        <Wordmark />
        <nav className="lg-back" aria-label="Back">
          <Link to="/">Back</Link>
        </nav>
        {user && !sameAccount && (
          <p className="login-switch lg-switch" role="status">
            You’re signed in as {user.name}. Signing in here will end that
            session.{" "}
            <Link to={portalOf(user)}>
              Back to{" "}
              {user.role === "patient" ? "My journal" : "Practice dashboard"}
            </Link>
          </p>
        )}
        <h1>
          {clinic
            ? "Welcome to your practice."
            : sample
              ? "A journal, already growing."
              : "A quiet place to begin."}
        </h1>
        <p className="lg-lede">
          {clinic
            ? "Follow the patterns that matter, while personal journal entries remain private."
            : sample
              ? "Explore Robin’s fictional journal and discover how personal patterns take shape."
              : "Leave a voice note about your day. There is no questionnaire to complete."}
        </p>
        {!health ? (
          <p className="lg-status" role="status" aria-live="polite">
            Connecting to your space…
          </p>
        ) : (
          <form className="lg-form" onSubmit={(e) => void submit(e)}>
            {nameOnly ? (
              <>
                <label className="sc-label" htmlFor="lg-name">
                  Your name
                </label>
                <input
                  id="lg-name"
                  className="sc-field"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={80}
                  autoComplete="name"
                />
                <p className="lg-help">
                  Any name will do. It is only used to greet you in this demo.
                </p>
              </>
            ) : (
              <>
                <label className="sc-label" htmlFor="lg-email">
                  Demo email
                </label>
                <input
                  id="lg-email"
                  className="sc-field"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="username"
                />
                <label className="sc-label" htmlFor="lg-password">
                  Password
                </label>
                <input
                  id="lg-password"
                  className="sc-field"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                {health.mode === "local_preview" && (
                  <p className="lg-help">
                    Local preview password:{" "}
                    <button
                      type="button"
                      className="sc-link"
                      onClick={() => setPassword(previewPassword)}
                    >
                      {previewPassword}
                    </button>
                  </p>
                )}
              </>
            )}
            {error && (
              <p className="lg-error" role="alert">
                <CircleAlert size={18} aria-hidden="true" />
                <span>{error}</span>
              </p>
            )}
            <button disabled={busy} className="lg-primary">
              {busy
                ? "Opening your space…"
                : clinic
                  ? "Open practice dashboard"
                  : sample
                    ? "Explore the sample"
                    : "Open my journal"}
            </button>
          </form>
        )}
        <p className="lg-small">
          Demonstration accounts only. Please use fictional experiences.
        </p>
        <p className="lg-other">
          <Link
            to={clinic ? "/login/patient" : "/login/psychologist"}
            className="sc-link"
          >
            {clinic ? "Looking for your journal?" : "Are you a psychologist?"}
          </Link>
        </p>
      </div>
      <div className="lg-art">
        {clinic ? (
          <p className="lg-quote">Trends only. Journal entries stay private.</p>
        ) : (
          <LoginMotif flower={sample} />
        )}
      </div>
    </div>
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
    <div className="sc-page">
      <div className="sc-wrap">
        <nav className="sc-back" aria-label="Back">
          <Link to="/patient/garden">My garden</Link>
        </nav>
        <YourSpace user={user!} />
      </div>
    </div>
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
  const back = (
    <nav className="sc-back" aria-label="Back">
      <Link to="/patient/garden">My garden</Link>
    </nav>
  );
  if (
    growth.simple_mode ||
    !growth.modules.some((m) => m === "voice" || m === "patterns")
  )
    return (
      <div className="sc-page">
        <div className="sc-wrap">
          {back}
          <section className="insights-empty">
            <h1>What helps</h1>
            <p>
              Your journal is already enough. When you’re curious, you can add
              this view from your space.
            </p>
            <Link className="quiet-link" to="/patient/space">
              Choose what to explore
            </Link>
          </section>
        </div>
      </div>
    );
  const labels: Record<string, string> = {
    walk: "Short walks",
    music: "Music",
    breathe: "Breathing",
    connect: "Connection",
  };
  return (
    <div className="sc-page">
      <div className="sc-wrap">
        {back}
        <header className="sc-head">
          <h1>What helps</h1>
          <p>A little understanding, built from your own experience.</p>
        </header>
        <ErrorNotice message={error} />
        {!data ? (
          <Loading />
        ) : (
          <>
            {growth.modules.includes("patterns") && (
              <section className="sc-section" aria-labelledby="in-helpful">
                <div className="sc-section-head">
                  <h2 id="in-helpful">What you’ve found helpful</h2>
                  <p>Based on your feedback</p>
                </div>
                {data.patterns.length ? (
                  <ul className="in-patterns">
                    {data.patterns.map((p) => (
                      <li key={p.kind}>
                        <span className="in-name">{p.label}</span>
                        <span className="in-count">
                          {p.helpful} helpful of{" "}
                          {plural(p.observations, "response", "responses")}
                        </span>
                        <span className="cl-bar" aria-hidden="true">
                          <span
                            style={{
                              width: `${p.observations ? (p.helpful / p.observations) * 100 : 0}%`,
                            }}
                          />
                        </span>
                        <span className="in-text">{p.text}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="sc-quiet">
                    Try an optional activity and leave feedback when you want.
                    Patterns will appear here as your journal grows.
                  </p>
                )}
              </section>
            )}
            {growth.modules.includes("voice") && (
              <section className="sc-section" aria-labelledby="in-voice">
                <div className="sc-section-head">
                  <h2 id="in-voice">Your voice over time</h2>
                  <p>
                    {data.trend.ready
                      ? "Personal baseline: compared only with your own first days."
                      : "Still learning your usual range."}
                  </p>
                </div>
                <ObservationChart trend={data.trend} audience="patient" />
                <p className="sc-small">
                  Measurements are sensitive to microphones, surroundings and
                  how you speak. These differences are observations, not a
                  diagnosis.
                </p>
              </section>
            )}
            <section className="sc-section" aria-labelledby="in-prefs">
              <h2 id="in-prefs">Make this space yours</h2>
              <p className="sc-text">
                Which small activities would you like Numa to suggest?
              </p>
              <div className="in-prefs">
                {ACTION_KINDS.map((key) => (
                  <label className="sc-check" key={key}>
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
                    <span>{labels[key]}</span>
                  </label>
                ))}
              </div>
              {user?.source !== "simulated" && (
                <div className="sc-actions">
                  <button
                    type="button"
                    className="sc-pebble"
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
                  </button>
                </div>
              )}
              <ErrorNotice message={saveError} />
            </section>
          </>
        )}
        <p className="sc-small sc-section">
          Your words stay in your journal. Your psychologist sees trends only.
        </p>
      </div>
    </div>
  );
}

const FUTURE_CONNECTIONS = [
  {
    title: "Apple Health",
    text: "Sleep, steps and activity, with your permission.",
  },
  {
    title: "Last.fm",
    text: "Listening habits alongside your own journal observations.",
  },
  {
    title: "Calendar",
    text: "The shape of your day, with the details you choose.",
  },
  { title: "Wearables", text: "Possible future links to Oura or Garmin." },
];

function Connections() {
  const { data } = useResource<Insights>("/patient/insights");
  return (
    <div className="sc-page">
      <div className="sc-wrap">
        <nav className="sc-back" aria-label="Back">
          <Link to="/patient/space">Your space</Link>
        </nav>
        <header className="sc-head">
          <h1>The context of your days.</h1>
          <p>
            Future connections could help you notice how everyday habits go
            together.
          </p>
        </header>
        <section className="sc-section" aria-labelledby="cx-today">
          <div className="sc-section-head">
            <h2 id="cx-today">Today’s context</h2>
            <p>Simulated data</p>
          </div>
          {data ? <ContextCards context={data.context} /> : <Loading />}
          <p className="sc-small">
            Sleep, activity, weather and listening history use simulated data in
            this prototype. No external accounts are connected.
          </p>
        </section>
        <section className="sc-section" aria-labelledby="cx-future">
          <h2 id="cx-future">Possible future connections</h2>
          <ul className="cx-list">
            {FUTURE_CONNECTIONS.map((c) => (
              <li key={c.title}>
                <span className="cx-name">{c.title}</span>
                <span className="cx-text">{c.text}</span>
                <span className="cx-state">
                  Not connected, a future integration
                </span>
              </li>
            ))}
          </ul>
        </section>
        <p className="sc-small sc-section">
          Your words stay in your journal. Your psychologist sees trends only.
        </p>
      </div>
    </div>
  );
}

/* ───────────── Clinic: the psychologist's portal ─────────────
   See DESIGN.md → "Clinic". A professional tool: same tokens and type as the
   patient's space, but no garden, plants or decorative voice line. It only
   ever shows the restricted projection: never journal text, audio or summaries. */

const CLINIC_STATUS: Record<string, { mark: string; text: string }> = {
  review: { mark: "●", text: "Review suggested" },
  learning: { mark: "○", text: "Learning baseline" },
  steady: { mark: "—", text: "Within typical range" },
};
/** State as words with a symbol, never a coloured pill. */
function ClinicStatus({ status }: { status: string }) {
  const s = CLINIC_STATUS[status] ?? CLINIC_STATUS.steady;
  return (
    <span className={"cl-status is-" + status}>
      <span aria-hidden="true">{s.mark}</span> {s.text}
    </span>
  );
}
const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

function ClinicLayout() {
  const { user, health, logout } = useContext(Auth);
  const report = useLocation().pathname.endsWith("/report");
  const foot = (
    <footer className="cl-foot">
      <p>
        {health?.mode === "local_preview"
          ? "Local preview: temporary data, acoustic measurements only."
          : "Connected prototype with experimental voice analysis."}{" "}
        Numa, professional space. Research prototype, no clinical diagnosis.
      </p>
    </footer>
  );
  if (report)
    return (
      <div className="cl-app is-report">
        <div className="cl-content">
          <main className="cl-main">
            <Outlet />
          </main>
          {foot}
        </div>
      </div>
    );
  const initials = (user?.name ?? "")
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w) && !w.endsWith("."))
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="cl-app">
      <aside className="cl-side no-print">
        <Wordmark />
        <nav className="cl-nav" aria-label="Practice">
          <NavLink to="/clinic">Overview</NavLink>
        </nav>
        <div className="cl-side-foot">
          <p className="cl-side-note">
            <strong>A view with boundaries.</strong> Patterns and shared
            activity feedback. Personal journal entries stay private.
          </p>
          <div className="cl-user">
            {initials && (
              <span className="cl-user-initials" aria-hidden="true">
                {initials}
              </span>
            )}
            <span className="cl-user-text">
              <span className="cl-user-name">{user?.name}</span>
              <span className="cl-user-role">Psychologist</span>
            </span>
            <button
              type="button"
              className="cl-signout"
              onClick={logout}
              aria-label="Sign out"
            >
              <LogOut size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      </aside>
      <div className="cl-content">
        <header className="cl-top no-print">
          <p>
            Your practice / <span>Patient wellbeing</span>
          </p>
          <p className="cl-top-right">
            <time>
              {new Date().toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </time>
            <span className="cl-live">
              <span className="cl-live-dot" aria-hidden="true" />
              Live, updates every 5 seconds
            </span>
          </p>
        </header>
        <main className="cl-main">
          <Outlet />
        </main>
        {foot}
      </div>
    </div>
  );
}

function ClinicDashboard() {
  const { data: patients, error } = useResource<Clinical[]>(
    "/clinic/patients",
    5000,
  );
  const navigate = useNavigate();
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all");
  const review = patients?.filter((p) => p.status === "review") || [];
  const shown = (patients ?? []).filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) &&
      (filter === "all" || p.status === filter),
  );
  const pages = (patients ?? []).reduce((a, p) => a + p.entry_count, 0);
  return (
    <div className="cl-dash">
      <header className="cl-head">
        <h1>Your patients</h1>
        <p>See the patterns. Keep the person at the centre.</p>
      </header>
      <ErrorNotice message={error} />
      {!patients ? (
        <Loading />
      ) : (
        <>
          <p className="cl-summary">
            <b>{patients.length}</b>{" "}
            {patients.length === 1 ? "person" : "people"} in your care.{" "}
            <b>{review.length}</b>{" "}
            {review.length === 1 ? "pattern" : "patterns"} to review.{" "}
            <b>{pages}</b> private journal {pages === 1 ? "page" : "pages"},
            never shown here.
          </p>
          {review.map((p) => (
            <Link
              key={p.id}
              to={"/clinic/patients/" + p.id}
              className="cl-review"
            >
              <span className="cl-review-title">
                <span className="cl-review-name">{p.name}</span>{" "}
                <span className="cl-review-what">
                  A pattern worth a closer look
                </span>
              </span>
              <span className="cl-review-text">
                Three consecutive observations outside this person’s typical
                vocal range. A conversation may add context.
              </span>
              <span className="cl-review-open">Open {p.name}</span>
            </Link>
          ))}
          <div className="cl-controls">
            <div className="cl-filters" role="group" aria-label="Show">
              {[
                { k: "all", t: "All patients" },
                { k: "review", t: "To review" },
                { k: "learning", t: "Learning baseline" },
              ].map((f) => (
                <button
                  type="button"
                  key={f.k}
                  aria-pressed={filter === f.k}
                  onClick={() => setFilter(f.k)}
                >
                  {f.t}
                </button>
              ))}
            </div>
            <label className="cl-search">
              <Search size={18} aria-hidden="true" />
              <input
                type="search"
                aria-label="Search patients"
                placeholder="Find a person"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          </div>
          <table className="cl-table">
            <caption className="visually-hidden">
              People in your care. Trends only; private journals are excluded.
            </caption>
            <thead>
              <tr>
                <th scope="col">Person</th>
                <th scope="col">Pattern</th>
                <th scope="col">Voice, recent days</th>
                <th scope="col">Last entry</th>
                <th scope="col">Activity feedback</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => {
                const responses = p.patterns.reduce(
                  (a, x) => a + x.observations,
                  0,
                );
                return (
                  <tr
                    key={p.id}
                    className="patient-row"
                    onClick={(e) => {
                      if (!(e.target as HTMLElement).closest("a"))
                        navigate("/clinic/patients/" + p.id);
                    }}
                  >
                    <th scope="row" className="cl-person">
                      <span className="cl-initials" aria-hidden="true">
                        {p.initials}
                      </span>
                      <span className="cl-person-text">
                        <Link to={"/clinic/patients/" + p.id}>
                          {p.name}
                          <span className="visually-hidden">
                            ,{" "}
                            {(
                              CLINIC_STATUS[p.status] ?? CLINIC_STATUS.steady
                            ).text.toLowerCase()}
                            , {p.actions_completed} activities
                          </span>
                        </Link>
                        <span className="cl-sub">
                          {p.source === "simulated"
                            ? "Fictional history"
                            : "Fresh demonstration profile"}
                        </span>
                      </span>
                    </th>
                    <td className="cl-cell-status">
                      <ClinicStatus status={p.status} />
                    </td>
                    <td className="cl-cell-voice">
                      <Sparkline trend={p.trend} />
                    </td>
                    <td className="cl-cell-last">
                      <span className="cl-num">
                        {p.last_entry_at
                          ? dateLabel(p.last_entry_at)
                          : "No entries yet"}
                      </span>
                      <span className="cl-sub">
                        {plural(p.entry_count, "saved page", "saved pages")}
                      </span>
                    </td>
                    <td className="cl-cell-activity">
                      <span className="cl-num">
                        {p.actions_completed} activities
                      </span>
                      <span className="cl-sub">
                        {plural(
                          responses,
                          "feedback response",
                          "feedback responses",
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {shown.length === 0 && (
            <p className="cl-none" role="status">
              No one matches this view.
            </p>
          )}
          <p className="cl-privacy">
            <LockKeyhole size={18} aria-hidden="true" />
            Journal text, audio and summaries are excluded from this portal and
            its API responses.
          </p>
        </>
      )}
    </div>
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
  const c = p.context;
  return (
    <article className={"cl-detail" + (report ? " is-report" : "")}>
      <nav className="cl-back no-print" aria-label="Back">
        {report ? (
          <Link to={"/clinic/patients/" + id}>Back to this person’s page</Link>
        ) : (
          <Link to="/clinic">All patients</Link>
        )}
      </nav>
      {report && (
        <p className="cl-report-kicker">
          Numa, one-page observation report. Generated{" "}
          {new Date().toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
          .
        </p>
      )}
      <header className="cl-detail-head">
        <div>
          <h1>{p.name}</h1>
          <p className="cl-lede">
            {p.source === "simulated"
              ? "Fictional demonstration history."
              : "Fresh demonstration profile."}{" "}
            {plural(
              p.entry_count,
              "private journal entry",
              "private journal entries",
            )}
            .
          </p>
          <p className="cl-detail-state">
            <ClinicStatus status={p.status} />
            <span className="cl-private">
              <LockKeyhole size={14} aria-hidden="true" />
              Journal content is private
            </span>
          </p>
        </div>
        <div className="no-print">
          {report ? (
            <button
              type="button"
              className="cl-pebble"
              onClick={() => window.print()}
            >
              Print / save PDF
            </button>
          ) : (
            <Link
              className="cl-pebble"
              to={"/clinic/patients/" + id + "/report"}
            >
              Observation report
            </Link>
          )}
        </div>
      </header>
      <ErrorNotice message={error} />

      <section className="cl-section" aria-labelledby="cl-voice">
        <div className="cl-section-head">
          <h2 id="cl-voice">Voice observations</h2>
          <p>
            Compared only with this person’s history.{" "}
            <span className="cl-num">
              {plural(
                p.trend.days,
                "distinct observation day",
                "distinct observation days",
              )}
              .
            </span>
          </p>
        </div>
        <ObservationChart trend={p.trend} />
        {p.trend.persistent_change && (
          <p className="cl-flag">
            Three consecutive observations differ from the first five baseline
            days. This heuristic is a prompt for professional review, not an
            assessment of depression.
          </p>
        )}
        <p className="cl-small">
          Range uses median and median absolute deviation of energy and pauses.
          Microphone, recording conditions and speaking style may affect
          measurements.
        </p>
      </section>

      <section className="cl-section" aria-labelledby="cl-context">
        <div className="cl-section-head">
          <h2 id="cl-context">Everyday context</h2>
          <p>Simulated data</p>
        </div>
        <dl className="cl-context">
          {[
            ["Sleep", `${c.sleep_hours} h`],
            ["Steps", c.steps.toLocaleString("en-GB")],
            ["Outdoors", `${c.outdoor_minutes} min`],
            ["Weather", `${c.weather} ${c.temperature_c}°`],
            ["Music", `${c.music_minutes} min`],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="cl-section" aria-labelledby="cl-actions">
        <div className="cl-section-head">
          <h2 id="cl-actions">Actions and patient feedback</h2>
          <p className="cl-num">{p.actions_completed} activities completed</p>
        </div>
        {p.patterns.length ? (
          <ul className="cl-actions">
            {p.patterns.map((pattern) => (
              <li key={pattern.kind}>
                <span className="cl-action-name">{pattern.label}</span>
                <span className="cl-action-count cl-num">
                  {pattern.helpful} helpful of{" "}
                  {plural(pattern.observations, "response", "responses")}
                </span>
                <span className="cl-bar" aria-hidden="true">
                  <span
                    style={{
                      width: `${pattern.observations ? (pattern.helpful / pattern.observations) * 100 : 0}%`,
                    }}
                  />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="cl-empty">No shared activity feedback yet.</p>
        )}
        <p className="cl-small">
          {plural(
            p.follow_up_count,
            "optional voice comparison",
            "optional voice comparisons",
          )}
          . Reported helpfulness and vocal changes are separate observations;
          neither establishes causality.
        </p>
      </section>

      {!report && (
        <section className="cl-section cl-notes" aria-labelledby="cl-notes">
          <div className="cl-section-head">
            <h2 id="cl-notes">Your professional notes</h2>
            <p>Psychologist only</p>
          </div>
          <label htmlFor="cl-note">Notes</label>
          <GrowingTextarea
            id="cl-note"
            maxLength={4000}
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              setStatus("");
            }}
            placeholder="Add context for your next conversation"
          />
          <div className="cl-notes-row">
            <button
              type="button"
              className="cl-primary"
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
              Save notes
            </button>
            <span role="status" aria-live="polite" className="cl-saved">
              {status && (
                <>
                  <Check size={16} aria-hidden="true" /> {status}
                </>
              )}
            </span>
          </div>
          <ErrorNotice message={noteError} />
        </section>
      )}

      <p className="cl-privacy cl-coverage">
        <ShieldCheck size={18} aria-hidden="true" />
        <span>
          Observation coverage: {plural(p.entry_count, "entry", "entries")},{" "}
          {plural(p.trend.days, "valid distinct day", "valid distinct days")}.{" "}
          {p.source === "simulated"
            ? "All history and measurements in this profile are illustrative."
            : "No fictional baseline is used for this profile."}{" "}
          No journal content is included.
        </span>
      </p>
    </article>
  );
}
function NotFound() {
  const { user } = useContext(Auth);
  return (
    <div className="nf-page">
      <div className="nf-wrap">
        <Wordmark />
        <h1>This page wandered off.</h1>
        <p>The page you were looking for isn’t here.</p>
        <p>
          <Link className="sc-link" to={user ? portalOf(user) : "/"}>
            {!user
              ? "Back to Numa"
              : user.role === "patient"
                ? "Back to your garden"
                : "Back to your practice"}
          </Link>
        </p>
      </div>
    </div>
  );
}
