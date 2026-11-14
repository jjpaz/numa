import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  FlaskConical,
  Leaf,
  Moon,
  Music,
  Plus,
  Settings2,
  Sprout,
  Sun,
  X,
  Footprints,
  Mic,
} from "lucide-react";
import { api, json } from "./api";
import type { Experiment, Growth, GrowthModule, User } from "./types";
import {
  Badge,
  ErrorNotice,
  Loading,
  PrivacyNote,
  SectionTitle,
} from "./components";

type GrowthPatch = {
  simple_mode?: boolean;
  modules?: GrowthModule[];
  dismiss_invitation?: string;
  habit_label?: string;
  habit_done?: boolean;
};
const GrowthContext = createContext<{
  growth: Growth | null;
  busy: boolean;
  error: string;
  update: (patch: GrowthPatch) => Promise<boolean>;
  refresh: () => Promise<void>;
} | null>(null);
export function useGrowth() {
  const value = useContext(GrowthContext);
  if (!value) throw Error("GrowthProvider is required");
  return value;
}

export function GrowthProvider({ children }: { children: ReactNode }) {
  const [growth, setGrowth] = useState<Growth | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const requestVersion = useRef(0);
  const changing = useRef(false);
  const refresh = useCallback(async () => {
    if (changing.current) return;
    const version = ++requestVersion.current;
    try {
      const result = await api<Growth>("/patient/growth");
      if (version === requestVersion.current) {
        setGrowth(result);
        setError("");
      }
    } catch (e) {
      if (version === requestVersion.current) setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 5000);
    return () => {
      clearInterval(timer);
      requestVersion.current++;
    };
  }, [refresh]);
  async function update(patch: GrowthPatch) {
    if (changing.current) return false;
    changing.current = true;
    requestVersion.current++;
    setBusy(true);
    try {
      setGrowth(
        await api<Growth>("/patient/growth", {
          method: "PATCH",
          body: json(patch),
        }),
      );
      setError("");
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      changing.current = false;
      setBusy(false);
    }
  }
  return (
    <GrowthContext.Provider value={{ growth, busy, error, update, refresh }}>
      {children}
    </GrowthContext.Provider>
  );
}

export function GrowingPlant({
  stage = "sprout",
}: {
  stage?: Growth["art_stage"];
}) {
  // Persistent visual memory; it never uses vocal estimates, mood or a missed-day counter.
  return (
    <svg
      className={"growing-plant " + stage}
      viewBox="0 0 260 280"
      role="img"
      aria-label="A plant that remembers the pages you share, without measuring wellbeing"
    >
      <circle cx="132" cy="133" r="110" fill="var(--plant-halo)" />
      <circle
        cx="132"
        cy="133"
        r="91"
        fill="none"
        stroke="var(--natural)"
        strokeOpacity=".2"
        strokeDasharray="2 8"
      />
      <path
        d="M69 239 Q130 229 194 239"
        stroke="var(--natural)"
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d={
          stage === "sprout"
            ? "M132 237 Q138 203 130 166"
            : "M132 237 Q143 168 128 94"
        }
        stroke="var(--organic)"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M135 212 C108 210 92 196 94 178 C117 176 137 192 135 212Z"
        fill="var(--organic)"
      />
      <path
        d="M134 191 C158 190 177 173 174 154 C150 153 134 170 134 191Z"
        fill="var(--natural)"
      />
      {stage !== "sprout" && (
        <>
          <path
            d="M135 168 C104 164 90 147 94 128 C120 127 136 147 135 168Z"
            fill="var(--natural)"
          />
          <path
            d="M132 139 C157 136 173 119 170 101 C146 103 130 118 132 139Z"
            fill="var(--organic)"
          />
          <path
            d="M129 112 C111 105 102 92 105 80 C122 85 131 97 129 112Z"
            fill="var(--organic)"
          />
        </>
      )}
      {stage === "bloom" && (
        <g className="plant-bloom">
          {Array.from({ length: 6 }, (_, i) => (
            <ellipse
              key={i}
              cx="128"
              cy="66"
              rx="11"
              ry="19"
              transform={`rotate(${i * 60} 128 84)`}
              fill="var(--apricot)"
            />
          ))}
          <circle cx="128" cy="84" r="10" fill="var(--ivory)" />
        </g>
      )}
      {stage === "leaves" && (
        <path
          d="M128 96 C112 73 118 59 127 51 C140 66 142 81 128 96Z"
          fill="var(--apricot)"
        />
      )}
      {stage === "sprout" && (
        <path
          d="M130 173 C116 151 120 138 129 131 C143 148 143 160 130 173Z"
          fill="var(--apricot)"
        />
      )}
      <circle cx="70" cy="100" r="3" fill="var(--apricot)" />
      <path d="M197 194h8m-4-4v8" stroke="var(--natural)" strokeWidth="1.5" />
    </svg>
  );
}

export function SimpleModeControl() {
  const { growth, update, busy } = useGrowth();
  const navigate = useNavigate();
  return (
    <button
      className={
        "simple-mode-control " + (growth?.simple_mode ? "is-simple" : "")
      }
      disabled={!growth || busy}
      aria-pressed={growth?.simple_mode || false}
      onClick={async () => {
        if (await update({ simple_mode: !growth!.simple_mode }))
          navigate("/patient");
      }}
    >
      <Sun size={15} />
      <span>
        {growth?.simple_mode ? "Back to my space" : "Today, something simple"}
      </span>
    </button>
  );
}

const MODULE_CARDS: {
  id: GrowthModule;
  title: string;
  description: string;
  Icon: typeof Moon;
}[] = [
  {
    id: "sleep",
    title: "Rest & recovery",
    description:
      "Notice sleep duration alongside your days. No sleep score to chase.",
    Icon: Moon,
  },
  {
    id: "activity",
    title: "Movement & outdoors",
    description:
      "A little context from steps and time outside, without daily targets.",
    Icon: Footprints,
  },
  {
    id: "music",
    title: "Music & moments",
    description: "See listening time beside the stories you choose to share.",
    Icon: Music,
  },
  {
    id: "habits",
    title: "One small intention",
    description:
      "Make room for a habit that matters to you. No streak to maintain.",
    Icon: Leaf,
  },
  {
    id: "patterns",
    title: "What seems to help",
    description:
      "Explore your optional activity feedback and the observations behind it.",
    Icon: Sprout,
  },
  {
    id: "voice",
    title: "Your voice over time",
    description:
      "An experimental view of your own vocal patterns. Always optional.",
    Icon: Mic,
  },
];

export function YourSpace({ user }: { user: User }) {
  const { growth, update, busy, error } = useGrowth();
  const [habit, setHabit] = useState<string | null>(null);
  if (!growth)
    return (
      <>
        <ErrorNotice message={error} />
        {!error && <Loading />}
      </>
    );
  const toggle = (id: GrowthModule) =>
    update({
      modules: growth.modules.includes(id)
        ? growth.modules.filter((m) => m !== id)
        : [...growth.modules, id],
    });
  return (
    <div className="your-space">
      <div className="page-heading">
        <div>
          <span className="eyebrow">You choose the shape of this space</span>
          <h1>
            A little more,
            <br />
            <em>only when you want it.</em>
          </h1>
          <p>
            Your journal is already enough. These are little windows you can
            open or close.
          </p>
        </div>
        <GrowingPlant stage={growth.art_stage} />
      </div>
      {growth.simple_mode && (
        <div className="simple-space-note">
          <Sun size={18} />
          <p>
            Simple view is on. Your choices below are kept for whenever you want
            to return.
          </p>
        </div>
      )}
      <ErrorNotice message={error} />
      <div className="space-module-grid">
        {MODULE_CARDS.map(({ id, title, description, Icon }) => {
          const enabled = growth.modules.includes(id);
          return (
            <article
              className={"space-module " + (enabled ? "module-chosen" : "")}
              key={id}
            >
              <div className="module-symbol">
                <Icon size={22} />
                {enabled && (
                  <span>
                    <Check size={12} />
                  </span>
                )}
              </div>
              <h2>{title}</h2>
              <p>{description}</p>
              {["sleep", "activity", "music"].includes(id) && (
                <span className="source-label">
                  Simulated context in this prototype
                </span>
              )}
              <button
                className="module-toggle"
                aria-pressed={enabled}
                disabled={busy}
                onClick={() => void toggle(id)}
              >
                {enabled ? (
                  <>
                    <Check size={14} />
                    Added to your space<span>Remove</span>
                  </>
                ) : (
                  <>
                    <Plus size={14} />
                    Add to my space
                  </>
                )}
              </button>
            </article>
          );
        })}
      </div>
      {growth.modules.includes("habits") && (
        <section className="paper-card habit-settings">
          <SectionTitle title="Something small, something yours" />
          <label>
            A habit you would like to make room for
            <input
              maxLength={80}
              value={habit ?? growth.habit_label}
              onChange={(e) => setHabit(e.target.value)}
              placeholder="A cup of tea away from my screen"
            />
          </label>
          <div className="button-row">
            <button
              disabled={busy || !(habit ?? growth.habit_label).trim()}
              className="button primary"
              onClick={async () => {
                if (await update({ habit_label: habit ?? growth.habit_label }))
                  setHabit(null);
              }}
            >
              Keep this intention
              <Check size={15} />
            </button>
            <span className="small-text muted">
              No reminders or missed-day penalties.
            </span>
          </div>
        </section>
      )}
      <section className="experiment-intro">
        <div>
          <FlaskConical size={24} />
          <span className="eyebrow">When curiosity comes along</span>
          <h2>
            A small question
            <br />
            worth exploring?
          </h2>
          <p>
            Try something gentle and notice what follows. Your observations can
            start a conversation, without proving cause and effect.
          </p>
        </div>
        <div>
          {growth.modules.includes("experiments") ? (
            <button
              className="text-link"
              disabled={busy}
              onClick={() => void toggle("experiments")}
            >
              Put experiments away
              <X size={14} />
            </button>
          ) : (
            <button
              className="button outline"
              disabled={busy}
              onClick={() => void toggle("experiments")}
            >
              Explore personal experiments
              <ArrowUpRight size={15} />
            </button>
          )}
        </div>
      </section>
      {growth.modules.includes("experiments") && (
        <ExperimentsPanel user={user} />
      )}
      <Link className="future-context-link" to="/patient/connections">
        <span>
          <Settings2 size={17} />
          Possible future connections
        </span>
        <span>
          Apple Health, Last.fm & more
          <ArrowUpRight size={15} />
        </span>
      </Link>
      <PrivacyNote />
    </div>
  );
}

function ExperimentsPanel({ user }: { user: User }) {
  const [items, setItems] = useState<Experiment[] | null>(null),
    [question, setQuestion] = useState(""),
    [kind, setKind] = useState("walk"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    try {
      setItems(await api<Experiment[]>("/patient/experiments"));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  async function change(
    item: Experiment,
    status: Experiment["status"],
    reflection?: string,
  ) {
    setBusy(true);
    try {
      await api("/patient/experiments/" + item.id, {
        method: "PATCH",
        body: json({
          status,
          ...(reflection !== undefined ? { reflection } : {}),
        }),
      });
      await refresh();
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (user.source === "simulated")
    return (
      <div className="paper-card">
        <p>
          This sample journal is read only. Start an experiment with the fresh
          patient profile.
        </p>
      </div>
    );
  return (
    <section className="experiments-panel">
      <ErrorNotice message={error} />
      {!items ? (
        <Loading />
      ) : (
        <>
          {!items.some((i) => i.status === "active") && (
            <form
              className="paper-card experiment-form"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  await api("/patient/experiments", {
                    method: "POST",
                    body: json({ question, kind }),
                  });
                  setQuestion("");
                  await refresh();
                  setError("");
                } catch (err) {
                  setError((err as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                Something you would like to understand
                <input
                  value={question}
                  minLength={3}
                  maxLength={200}
                  required
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="What do I notice after a short walk?"
                />
              </label>
              <label>
                A small activity to try
                <select value={kind} onChange={(e) => setKind(e.target.value)}>
                  <option value="walk">A short walk</option>
                  <option value="music">My own music</option>
                  <option value="breathe">Quiet breathing</option>
                  <option value="connect">Reaching out</option>
                </select>
              </label>
              <button
                className="button primary"
                disabled={busy || question.trim().length < 3}
              >
                Keep this question
                <ArrowRight size={15} />
              </button>
            </form>
          )}
          {items.map((item) => (
            <ExperimentCard
              key={item.id}
              item={item}
              busy={busy}
              change={change}
            />
          ))}
        </>
      )}
    </section>
  );
}

function ExperimentCard({
  item,
  busy,
  change,
}: {
  item: Experiment;
  busy: boolean;
  change: (
    item: Experiment,
    status: Experiment["status"],
    reflection?: string,
  ) => Promise<void>;
}) {
  const [reflection, setReflection] = useState(item.reflection),
    [finishing, setFinishing] = useState(false);
  return (
    <article className="paper-card experiment-card">
      <div className="card-topline">
        <Badge>
          {item.status === "active"
            ? "An open question"
            : item.status === "paused"
              ? "Paused, at your pace"
              : "A question you explored"}
        </Badge>
        <FlaskConical size={20} />
      </div>
      <h3>{item.question}</h3>
      <p>
        {item.responses
          ? `${item.helpful} of ${item.responses} activity responses since you started were marked helpful. These include any paused periods and do not establish cause.`
          : "No activity feedback yet. Try an optional action from a journal page whenever you want."}
      </p>
      {item.status === "completed" ? (
        <>{item.reflection && <blockquote>{item.reflection}</blockquote>}</>
      ) : (
        <>
          <div className="button-row">
            <button
              disabled={busy}
              className="text-link"
              onClick={() =>
                void change(
                  item,
                  item.status === "paused" ? "active" : "paused",
                )
              }
            >
              {item.status === "paused"
                ? "Return to this question"
                : "Pause for now"}
            </button>
            <button
              className="quiet-button"
              disabled={busy}
              onClick={() => setFinishing(!finishing)}
            >
              Finish exploring
            </button>
          </div>
          {finishing && (
            <div className="experiment-reflection">
              <label>
                What did you notice? (optional)
                <textarea
                  rows={3}
                  maxLength={1500}
                  value={reflection}
                  onChange={(e) => setReflection(e.target.value)}
                />
              </label>
              <button
                className="button primary"
                disabled={busy}
                onClick={() => void change(item, "completed", reflection)}
              >
                Keep my reflection
                <Check size={15} />
              </button>
            </div>
          )}
        </>
      )}
    </article>
  );
}
