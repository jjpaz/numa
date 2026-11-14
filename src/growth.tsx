import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api, json } from "./api";
import type {
  Experiment,
  Growth,
  GrowthModule,
  Insights,
  User,
} from "./types";
import { ACTION_KINDS, Loading, Problem } from "./components";
import { ObservationChart } from "./clinicCharts";

// The interface never sends simple_mode: there is no simple view any more.
type GrowthPatch = {
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

const MODULES: {
  id: GrowthModule;
  title: string;
  description: string;
  simulated?: boolean;
}[] = [
  {
    id: "sleep",
    title: "Rest & recovery",
    description:
      "Notice sleep duration alongside your days. No sleep score to chase.",
    simulated: true,
  },
  {
    id: "activity",
    title: "Movement & outdoors",
    description:
      "A little context from steps and time outside, without daily targets.",
    simulated: true,
  },
  {
    id: "music",
    title: "Music & moments",
    description: "See listening time beside the stories you choose to share.",
    simulated: true,
  },
  {
    id: "habits",
    title: "One small intention",
    description:
      "Make room for a habit that matters to you. No streak to maintain.",
  },
  {
    id: "patterns",
    title: "What seems to help",
    description:
      "Explore your optional activity feedback and the observations behind it.",
  },
  {
    id: "voice",
    title: "Your voice over time",
    description:
      "An experimental view of your own vocal patterns. Always optional.",
  },
];

const ACTION_LABELS: Record<string, string> = {
  walk: "Short walks",
  music: "Music",
  breathe: "Breathing",
  connect: "Connection",
};

/** The habit you chose, and a gentle "I made room for this" for today. */
function IntentionControls() {
  const { growth, update, busy } = useGrowth();
  const [habit, setHabit] = useState<string | null>(null);
  if (!growth) return null;
  return (
    <div className="mg-module-more">
      <h4 className="mg-h4">Something small, something yours</h4>
      <label className="mg-label" htmlFor="sp-habit">
        A habit you would like to make room for
      </label>
      <input
        id="sp-habit"
        className="mg-field"
        maxLength={80}
        value={habit ?? growth.habit_label}
        onChange={(e) => setHabit(e.target.value)}
        placeholder="A cup of tea away from my screen"
      />
      <div className="mg-actions">
        <button
          type="button"
          disabled={busy || !(habit ?? growth.habit_label).trim()}
          className="mg-pebble"
          onClick={async () => {
            if (await update({ habit_label: habit ?? growth.habit_label }))
              setHabit(null);
          }}
        >
          Keep this intention
        </button>
        <span className="mg-small">No reminders or missed-day penalties.</span>
      </div>
      {growth.habit_label && (
        <div className="mg-habit">
          <div>
            <p className="mg-habit-name">{growth.habit_label}</p>
            <p className="mg-small">
              Optional, every time. A missed day takes nothing away.
            </p>
          </div>
          <button
            type="button"
            className="mg-pebble"
            disabled={busy}
            aria-pressed={growth.habit_done_today}
            onClick={() =>
              void update({ habit_done: !growth.habit_done_today })
            }
          >
            {growth.habit_done_today
              ? "Noted for today"
              : "I made room for this"}
          </button>
        </div>
      )}
    </div>
  );
}

/** Which small activities Numa may suggest. */
function ActivityPreferences({
  user,
  insights,
}: {
  user: User;
  insights: Insights | null;
}) {
  const [preferences, setPreferences] = useState<string[] | null>(null),
    [saved, setSaved] = useState(false),
    [saveError, setSaveError] = useState("");
  if (!insights) return <Loading />;
  const current = preferences || insights.preferences;
  return (
    <div className="mg-module-more">
      <h4 className="mg-h4">Make this space yours</h4>
      <p className="mg-text">
        Which small activities would you like Numa to suggest?
      </p>
      <div className="mg-prefs">
        {ACTION_KINDS.map((key) => (
          <label className="mg-check" key={key}>
            <input
              type="checkbox"
              disabled={user.source === "simulated"}
              checked={current.includes(key)}
              onChange={(e) => {
                setPreferences(
                  e.target.checked
                    ? [...current, key]
                    : current.filter((k) => k !== key),
                );
                setSaved(false);
              }}
            />
            <span>{ACTION_LABELS[key]}</span>
          </label>
        ))}
      </div>
      {user.source !== "simulated" && (
        <div className="mg-actions">
          <button
            type="button"
            className="mg-pebble"
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
      <Problem message={saveError} />
    </div>
  );
}

/** Your own voice, compared only with your own first days. */
function VoiceOverTime({ insights }: { insights: Insights | null }) {
  if (!insights) return <Loading />;
  return (
    <div className="mg-module-more">
      <p className="mg-text">
        {insights.trend.ready
          ? "Personal baseline: compared only with your own first days."
          : "Still learning your usual range."}
      </p>
      <div className="mg-chart">
        <ObservationChart trend={insights.trend} audience="patient" />
      </div>
      <p className="mg-small">
        Measurements are sensitive to microphones, surroundings and how you
        speak. These differences are observations, not a diagnosis.
      </p>
    </div>
  );
}

/**
 * My garden → Your space: the optional modules as rows with a switch, each
 * opening its own controls underneath, then personal experiments.
 */
export function SpaceSection({
  user,
  insights,
}: {
  user: User;
  insights: Insights | null;
}) {
  const { growth, update, busy, error } = useGrowth();
  if (!growth)
    return (
      <>
        <Problem message={error} />
        {!error && <Loading />}
      </>
    );
  const invitation = growth.invitations[0];
  const toggle = (id: GrowthModule) =>
    update({
      modules: growth.modules.includes(id)
        ? growth.modules.filter((m) => m !== id)
        : [...growth.modules, id],
    });
  return (
    <>
      <Problem message={error} />
      {invitation && (
        <div className="growth-invitation mg-invitation">
          <h3 className="mg-h3">{invitation.title}</h3>
          <p className="mg-text">{invitation.text}</p>
          <div className="mg-actions">
            <button
              type="button"
              className="mg-pebble"
              disabled={busy}
              onClick={async () => {
                if (
                  await update({
                    modules: [
                      ...new Set([...growth.modules, invitation.module]),
                    ],
                    dismiss_invitation: invitation.id,
                  })
                )
                  document
                    .getElementById("module-" + invitation.module)
                    ?.scrollIntoView({ block: "start" });
              }}
            >
              Explore this pattern
            </button>
            <button
              type="button"
              className="mg-link"
              disabled={busy}
              onClick={() => void update({ dismiss_invitation: invitation.id })}
            >
              Not now
            </button>
          </div>
        </div>
      )}
      <ul className="mg-modules">
        {MODULES.map(({ id, title, description, simulated }) => {
          const enabled = growth.modules.includes(id);
          return (
            <li className="space-module" key={id}>
              <div className="mg-module-row">
                <div className="mg-module-text">
                  <h3 id={"module-" + id} className="mg-h3">
                    {title}
                  </h3>
                  <p>
                    {description}
                    {simulated && " Simulated context in this prototype."}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  className="mg-switch"
                  aria-checked={enabled}
                  aria-labelledby={"module-" + id}
                  disabled={busy}
                  onClick={() => void toggle(id)}
                >
                  <span className="mg-track" aria-hidden="true">
                    <span className="mg-knob" />
                  </span>
                  <span className="mg-state" aria-hidden="true">
                    {enabled ? "In your space" : "Not added"}
                  </span>
                </button>
              </div>
              {enabled && id === "habits" && <IntentionControls />}
              {enabled && id === "patterns" && (
                <ActivityPreferences user={user} insights={insights} />
              )}
              {enabled && id === "voice" && (
                <VoiceOverTime insights={insights} />
              )}
            </li>
          );
        })}
      </ul>
      <div className="mg-experiments">
        <h3 id="exp-title" className="mg-h3">
          A small question worth exploring?
        </h3>
        <p className="mg-text">
          Try something gentle and notice what follows. Your observations can
          start a conversation, without proving cause and effect.
        </p>
        <div className="mg-actions">
          {growth.modules.includes("experiments") ? (
            <button
              type="button"
              className="mg-link"
              disabled={busy}
              onClick={() => void toggle("experiments")}
            >
              Put experiments away
            </button>
          ) : (
            <button
              type="button"
              className="mg-pebble"
              disabled={busy}
              onClick={() => void toggle("experiments")}
            >
              Explore personal experiments
            </button>
          )}
        </div>
        {growth.modules.includes("experiments") && (
          <ExperimentsPanel user={user} />
        )}
      </div>
    </>
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
      <p className="mg-text">
        This sample journal is read only. Start an experiment with the fresh
        patient profile.
      </p>
    );
  return (
    <div className="mg-module-more">
      <Problem message={error} />
      {!items ? (
        <Loading />
      ) : (
        <>
          {!items.some((i) => i.status === "active") && (
            <form
              className="mg-form"
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
              <label className="mg-label" htmlFor="sp-question">
                Something you would like to understand
              </label>
              <input
                id="sp-question"
                className="mg-field"
                value={question}
                minLength={3}
                maxLength={200}
                required
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="What do I notice after a short walk?"
              />
              <label className="mg-label" htmlFor="sp-kind">
                A small activity to try
              </label>
              <select
                id="sp-kind"
                className="mg-field"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
              >
                <option value="walk">A short walk</option>
                <option value="music">My own music</option>
                <option value="breathe">Quiet breathing</option>
                <option value="connect">Reaching out</option>
              </select>
              <div className="mg-actions">
                <button
                  className="mg-pebble"
                  disabled={busy || question.trim().length < 3}
                >
                  Keep this question
                </button>
              </div>
            </form>
          )}
          {items.map((item) => (
            <ExperimentItem
              key={item.id}
              item={item}
              busy={busy}
              change={change}
            />
          ))}
        </>
      )}
    </div>
  );
}

function ExperimentItem({
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
    <article className="mg-exp">
      <p className="mg-exp-state">
        {item.status === "active"
          ? "An open question"
          : item.status === "paused"
            ? "Paused, at your pace"
            : "A question you explored"}
      </p>
      <h4 className="mg-h4">{item.question}</h4>
      <p className="mg-text">
        {item.responses
          ? `${item.helpful} of ${item.responses} activity responses since you started were marked helpful. These include any paused periods and do not establish cause.`
          : "No activity feedback yet. Try an optional action from a journal page whenever you want."}
      </p>
      {item.status === "completed" ? (
        item.reflection && (
          <blockquote className="mg-exp-quote">{item.reflection}</blockquote>
        )
      ) : (
        <>
          <div className="mg-actions">
            <button
              type="button"
              disabled={busy}
              className="mg-link"
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
              type="button"
              className="mg-link"
              disabled={busy}
              aria-expanded={finishing}
              onClick={() => setFinishing(!finishing)}
            >
              Finish exploring
            </button>
          </div>
          {finishing && (
            <div className="mg-form">
              <label className="mg-label" htmlFor={"sp-reflect-" + item.id}>
                What did you notice? (optional)
              </label>
              <textarea
                id={"sp-reflect-" + item.id}
                className="mg-field"
                rows={3}
                maxLength={1500}
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
              />
              <div className="mg-actions">
                <button
                  type="button"
                  className="mg-pebble"
                  disabled={busy}
                  onClick={() => void change(item, "completed", reflection)}
                >
                  Keep my reflection
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </article>
  );
}
