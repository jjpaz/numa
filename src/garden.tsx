// The patient's garden: home, journal (log), "My garden" and the leaf menu.
// The psychologist portal never imports from here.
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  Check,
  Leaf,
  LogOut,
  Plus,
  Settings2,
  Sprout,
  X,
} from "lucide-react";
import type { Entry, Insights, User } from "./types";
import { ContextCards, ErrorNotice, Loading } from "./components";
import { SimpleModeControl, useGrowth } from "./growth";
import {
  daysTended,
  isToday,
  localDayKey,
  plantsFrom,
  reflectionFor,
  rhythmPhrase,
  todayState,
  todayTarget,
  type Plant,
  type TodayState,
} from "./today";

const longDate = (value: string | Date) =>
  new Date(value).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
const shortDate = (value: string) =>
  new Date(value).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
const savedNewestFirst = (entries: Entry[]) =>
  entries
    .filter((e) => e.saved)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

/* ───────────────────────── Garden illustration ───────────────────────── */

const LEAF = ["var(--g-moss)", "var(--g-leaf)", "var(--g-sage)"];

function PlantShape({ plant }: { plant: Plant }) {
  const leaf = LEAF[plant.hue],
    leaf2 = LEAF[(plant.hue + 1) % 3];
  const stem = (
    <path
      d={
        plant.kind === "tuft"
          ? ""
          : plant.kind === "fern"
            ? "M0 0 C3 -14 -3 -30 1 -46"
            : "M0 0 C1.5 -10 -1.5 -20 0 -32"
      }
      stroke="var(--g-stem)"
      strokeWidth="1.6"
      strokeLinecap="round"
      fill="none"
    />
  );
  switch (plant.kind) {
    case "tuft":
      return (
        <g stroke={leaf} strokeWidth="2" strokeLinecap="round" fill="none">
          <path d="M0 0 Q-3 -12 -10 -20" />
          <path d="M0 0 Q-1 -15 -3 -27" />
          <path d="M0 0 Q2 -14 5 -24" />
          <path d="M0 0 Q4 -9 11 -15" />
        </g>
      );
    case "fern":
      return (
        <>
          {stem}
          {[-12, -22, -32, -41].map((y, i) => (
            <ellipse
              key={y}
              cx={i % 2 ? 6 : -6}
              cy={y}
              rx="6.5"
              ry="2.6"
              fill={i % 2 ? leaf : leaf2}
              transform={`rotate(${i % 2 ? -28 : 28} ${i % 2 ? 6 : -6} ${y})`}
            />
          ))}
        </>
      );
    case "flower":
      return (
        <>
          {stem}
          <path
            d="M0 -12 C-9 -13 -13 -20 -12 -25 C-5 -23 -1 -18 0 -12Z"
            fill={leaf}
          />
          {Array.from({ length: 5 }, (_, i) => (
            <ellipse
              key={i}
              cx="0"
              cy="-40"
              rx="3.2"
              ry="5.6"
              fill={i % 2 ? "var(--g-petal)" : "var(--g-butter)"}
              transform={`rotate(${i * 72} 0 -34)`}
            />
          ))}
          <circle cx="0" cy="-34" r="2.6" fill="var(--g-clay)" />
        </>
      );
    case "bud":
      return (
        <>
          {stem}
          <path
            d="M0 -14 C9 -15 13 -22 12 -27 C5 -25 1 -20 0 -14Z"
            fill={leaf}
          />
          <path
            d="M0 -31 C-5 -35 -4 -42 0 -46 C4 -42 5 -35 0 -31Z"
            fill="var(--g-clay)"
          />
        </>
      );
    default:
      return (
        <>
          {stem}
          <path
            d="M0 -16 C-10 -18 -15 -26 -14 -32 C-6 -30 -1 -24 0 -16Z"
            fill={leaf}
          />
          <path
            d="M0 -23 C9 -25 14 -32 13 -38 C5 -36 0 -30 0 -23Z"
            fill={leaf2}
          />
        </>
      );
  }
}

const ROW_Y = [118, 132, 148];
const ROW_SCALE = [0.85, 1.05, 1.3];

export function Garden({
  plants,
  label,
  growOnView = false,
  className = "",
}: {
  plants: Plant[];
  label: string;
  growOnView?: boolean;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const ordered = [...plants].sort((a, b) => a.row - b.row);
  return (
    <svg
      className={"garden " + className}
      viewBox="0 42 360 134"
      role="img"
      aria-label={label}
      preserveAspectRatio="xMidYMax meet"
    >
      <path
        d="M-4 112 C40 98 92 104 140 100 C196 95 250 104 300 98 C330 95 350 99 364 102 V176 H-4Z"
        fill="var(--g-hill)"
      />
      <path
        d="M-4 136 C46 126 104 134 160 128 C222 122 286 132 364 126 V176 H-4Z"
        fill="var(--g-ground)"
      />
      <path
        d="M-4 158 C60 150 130 156 190 152 C252 148 312 156 364 152 V176 H-4Z"
        fill="var(--g-soil)"
      />
      {plants.length === 0 && (
        <g transform="translate(180 150)">
          <ellipse cx="0" cy="-3" rx="7" ry="4.5" fill="var(--g-clay)" />
          <path
            d="M0 -6 C0 -11 2 -14 5 -16"
            stroke="var(--g-leaf)"
            strokeWidth="1.6"
            strokeLinecap="round"
            fill="none"
          />
        </g>
      )}
      {ordered.map((plant, i) => {
        const x = 12 + plant.x * 336;
        const s = plant.scale * ROW_SCALE[plant.row];
        const grow = {
          initial: { scaleY: 0, opacity: 0 },
          transition: {
            duration: 1.6,
            delay: 0.2 + i * 0.06,
            ease: [0.22, 1, 0.36, 1] as const,
          },
          ...(growOnView
            ? {
                whileInView: { scaleY: 1, opacity: 1 },
                viewport: { once: true, amount: 0.4 },
              }
            : { animate: { scaleY: 1, opacity: 1 } }),
        };
        return (
          <g
            key={plant.id}
            transform={`translate(${x.toFixed(1)} ${ROW_Y[plant.row]}) scale(${s.toFixed(2)})`}
            opacity={plant.row === 0 ? 0.78 : 1}
          >
            <motion.g
              style={{ transformBox: "fill-box", originY: 1, originX: 0.5 }}
              {...(reduced ? {} : grow)}
            >
              <PlantShape plant={plant} />
              {plant.fresh && (
                <circle cx="2" cy="-50" r="2.4" fill="var(--g-butter)" />
              )}
            </motion.g>
          </g>
        );
      })}
    </svg>
  );
}

/** Gentle fade-and-rise as a section scrolls into view. Off with reduced motion. */
function Reveal({
  children,
  className,
  as = "section",
  ...rest
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "article";
  "aria-labelledby"?: string;
}) {
  const reduced = useReducedMotion();
  const Tag = as === "article" ? motion.article : motion.section;
  return (
    <Tag
      className={className}
      {...rest}
      {...(reduced
        ? {}
        : {
            initial: { opacity: 0, y: 18 },
            whileInView: { opacity: 1, y: 0 },
            viewport: { once: true, amount: 0.3 },
            transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] },
          })}
    >
      {children}
    </Tag>
  );
}

function gardenLabel(count: number) {
  return count === 0
    ? "Your garden: a single seed, waiting for your first entry."
    : `Your garden: ${count} small ${count === 1 ? "plant" : "plants"}, one for each entry you have saved.`;
}

/* ───────────────────────── Leaf menu ───────────────────────── */

export function LeafMenu({ onSignOut }: { onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null),
    panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>("a")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!panel.current?.contains(target) && !button.current?.contains(target))
        setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);
  return (
    <div className="leaf-menu">
      <button
        ref={button}
        type="button"
        className="leaf-button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        {open ? <X size={20} /> : <Leaf size={20} />}
      </button>
      {open && (
        <div className="leaf-panel" id={id} ref={panel}>
          <nav aria-label="Garden menu">
            <NavLink to="/patient/journal">Journal</NavLink>
            <NavLink to="/patient/garden">My garden</NavLink>
          </nav>
          <button type="button" className="leaf-signout" onClick={onSignOut}>
            <LogOut size={15} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Today's action ───────────────────────── */

export function TodayAction({
  state,
  sample,
}: {
  state: TodayState<Entry> | null;
  sample: boolean;
}) {
  if (!state)
    return (
      <div className="today-action" aria-busy="true">
        <span className="garden-cta is-waiting">Opening your garden…</span>
      </div>
    );
  if (state.kind === "done")
    return (
      <div className="today-action">
        <p className="today-status" role="status">
          <Check size={17} aria-hidden="true" /> Today’s entry is planted.
        </p>
        <Link className="garden-cta" to={todayTarget(state)}>
          See today’s entry <ArrowRight size={18} aria-hidden="true" />
        </Link>
        {!sample && (
          <Link className="quiet-link" to="/patient/new">
            Add another entry
          </Link>
        )}
      </div>
    );
  if (state.kind === "in_progress")
    return (
      <div className="today-action">
        <p className="today-status" role="status">
          <Sprout size={17} aria-hidden="true" /> You started an entry earlier
          today.
        </p>
        <Link className="garden-cta" to={todayTarget(state)}>
          Continue today’s entry <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </div>
    );
  if (sample)
    return (
      <div className="today-action">
        <p className="today-status">
          This sample garden is read only. Use the fresh profile to add your own
          entries.
        </p>
      </div>
    );
  return (
    <div className="today-action">
      <Link className="garden-cta" to={todayTarget(state)}>
        <Plus size={18} aria-hidden="true" /> Add an entry
      </Link>
      <p className="today-hint">A voice note or a few written words.</p>
    </div>
  );
}

/** Shown on /patient/new so a direct visit never hides today's existing entry. */
export function TodayNotice({ entries }: { entries: Entry[] | null }) {
  if (!entries) return null;
  const state = todayState(entries);
  if (state.kind === "pending") return null;
  return (
    <p className="today-notice" role="status">
      {state.kind === "done"
        ? "You already planted an entry today. You can add another, or "
        : "You have an unfinished entry from today. You can start fresh, or "}
      <Link to={todayTarget(state)}>
        {state.kind === "done" ? "see today’s entry" : "continue that one"}
      </Link>
      .
    </p>
  );
}

/* ───────────────────────── Home ───────────────────────── */

export function GardenHome({
  user,
  entries,
  error,
}: {
  user: User;
  entries: Entry[] | null;
  error: string;
}) {
  const sample = user.source === "simulated";
  const state = entries ? todayState(entries) : null;
  const saved = savedNewestFirst(entries ?? []);
  const plants = plantsFrom(entries ?? []);
  const hero = plants.slice(-14);
  const older = plants.slice(0, -14);
  const tended = daysTended(entries ?? []);
  const helped = saved.filter((e) => e.action?.feedback === "helpful").length;
  const latest = saved[0];
  const first = user.name.split(" ")[0];
  const lede =
    state?.kind === "done"
      ? "Your garden has had a little water today."
      : state?.kind === "in_progress"
        ? "Your garden is keeping your place."
        : entries && !saved.length
          ? "Your garden is ready for its first seed."
          : "Your garden has been waiting.";
  // The understory keeps growing below the fold: older plants plus wild grasses for constancy.
  const understory: Plant[] = [
    ...older.map((p) => ({ ...p, row: 2 as const })),
    ...Array.from({ length: Math.max(3, tended) }, (_, i) => ({
      id: "wild-" + i,
      kind: (i % 4 === 3 ? "flower" : "tuft") as Plant["kind"],
      x: ((i * 0.381966 + 0.13) % 1) * 0.94 + 0.03,
      row: (i % 3) as Plant["row"],
      scale: 0.75 + (i % 4) * 0.08,
      hue: (i % 3) as Plant["hue"],
      fresh: false,
    })),
  ];
  return (
    <div className="garden-home">
      <section className="garden-hero" aria-labelledby="garden-greeting">
        <p className="garden-date">{longDate(new Date())}</p>
        <h1 id="garden-greeting">So good to see you, {first}.</h1>
        <p className="garden-lede">{lede}</p>
        <Garden
          plants={hero}
          label={gardenLabel(saved.length)}
          className="garden-hero-art"
        />
        <TodayAction state={state} sample={sample} />
      </section>
      <ErrorNotice message={error} />
      <div className="garden-understory">
        <Garden
          plants={understory}
          growOnView
          label="The garden continues: wild grasses that grow with how often you come back."
          className="garden-band"
        />
        {latest ? (
          <Reveal
            as="article"
            className="latest-entry"
            aria-labelledby="latest-heading"
          >
            <h2 id="latest-heading">
              {isToday(latest.created_at)
                ? "Today’s entry"
                : "Your latest entry"}
            </h2>
            <p className="soft-date">{longDate(latest.created_at)}</p>
            <p className="reflection">{reflectionFor(latest)}</p>
            <h3>{latest.title}</h3>
            {latest.summary && (
              <p className="latest-summary">{latest.summary}</p>
            )}
            <Link className="text-link" to={"/patient/entries/" + latest.id}>
              Open this entry <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </Reveal>
        ) : entries ? (
          <Reveal className="latest-entry is-empty">
            <p className="reflection">
              Your first entry will rest here, with a few words just for you.
            </p>
          </Reveal>
        ) : (
          <Loading />
        )}
        {saved.length > 0 && (
          <Reveal className="growth-note" aria-labelledby="growth-heading">
            <h2 id="growth-heading">How your garden is growing</h2>
            <p>
              {saved.length} {saved.length === 1 ? "entry" : "entries"} planted
              so far. Over the last two weeks {rhythmPhrase(tended)}
              {helped > 0
                ? `, and ${helped === 1 ? "once" : helped + " times"} something helped.`
                : "."}
            </p>
            <div className="growth-links">
              <Link className="text-link" to="/patient/journal">
                Read your journal <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link className="text-link" to="/patient/garden">
                Visit my garden <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </Reveal>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── Journal (log) ───────────────────────── */

function WeekTrace({ entries }: { entries: Entry[] }) {
  const now = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 6 + i,
    );
    const key = localDayKey(d);
    return {
      key,
      label: d.toLocaleDateString("en-GB", { weekday: "short" }),
      tended: entries.some((e) => e.saved && localDayKey(e.created_at) === key),
      today: i === 6,
    };
  });
  return (
    <ol className="week-trace" aria-label="The last seven days">
      {days.map((d) => (
        <li
          key={d.key}
          className={(d.tended ? "tended " : "") + (d.today ? "today" : "")}
        >
          <span className="week-seed" aria-hidden="true">
            {d.tended && <Leaf size={13} />}
          </span>
          <span>
            {d.label}
            <span className="visually-hidden">
              {d.today ? ", today" : ""}:{" "}
              {d.tended ? "entry planted" : "no entry"}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

export function JournalLog({
  entries,
  error,
  sample,
}: {
  entries: Entry[] | null;
  error: string;
  sample: boolean;
}) {
  const sorted = [...(entries ?? [])].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const months: { label: string; items: Entry[] }[] = [];
  for (const e of sorted) {
    const label = new Date(e.created_at).toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric",
    });
    if (months.at(-1)?.label !== label) months.push({ label, items: [] });
    months.at(-1)!.items.push(e);
  }
  return (
    <div className="journal-log">
      <header className="garden-page-heading">
        <h1>Journal</h1>
        <p>Every entry you’ve planted, newest first.</p>
      </header>
      <ErrorNotice message={error} />
      {!entries ? (
        <Loading />
      ) : (
        <>
          <WeekTrace entries={entries} />
          {sorted.length === 0 ? (
            <div className="garden-empty">
              <p>Your journal is waiting for its first entry.</p>
              {!sample && (
                <Link className="text-link" to="/patient/new">
                  Add an entry <ArrowRight size={16} aria-hidden="true" />
                </Link>
              )}
            </div>
          ) : (
            months.map((month) => (
              <section key={month.label} className="log-month">
                <h2>{month.label}</h2>
                <ol className="log-list">
                  {month.items.map((e) => {
                    const today = isToday(e.created_at);
                    const busy = ["pending", "processing"].includes(e.status);
                    return (
                      <li key={e.id}>
                        <Link
                          to={"/patient/entries/" + e.id}
                          className={"log-entry " + (today ? "is-today" : "")}
                        >
                          <span
                            className={
                              "log-seed " + (e.saved ? "" : "is-draft")
                            }
                            aria-hidden="true"
                          >
                            {e.saved ? (
                              <Leaf size={16} />
                            ) : (
                              <Sprout size={16} />
                            )}
                          </span>
                          <span className="log-body">
                            <span className="log-date">
                              {shortDate(e.created_at)}
                              {today && (
                                <span className="today-tag">Today</span>
                              )}
                            </span>
                            <strong>
                              {busy ? "Listening to your day…" : e.title}
                            </strong>
                            <span className="log-reflection">
                              {reflectionFor(e)}
                            </span>
                            {(!e.saved || e.action?.feedback === "helpful") && (
                              <span className="log-meta">
                                {!e.saved &&
                                  (busy
                                    ? "Still listening"
                                    : "Draft · not saved yet")}
                                {e.saved && "Something helped"}
                              </span>
                            )}
                          </span>
                          <ArrowRight size={17} aria-hidden="true" />
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              </section>
            ))
          )}
        </>
      )}
    </div>
  );
}

/* ───────────────────────── My garden ───────────────────────── */

function WeeksMeadow({ entries }: { entries: Entry[] }) {
  const now = new Date();
  const monday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - ((now.getDay() + 6) % 7),
  );
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const start = new Date(
      monday.getFullYear(),
      monday.getMonth(),
      monday.getDate() - (7 - i) * 7,
    );
    const end = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate() + 7,
    );
    const count = entries.filter(
      (e) =>
        e.saved &&
        new Date(e.created_at) >= start &&
        new Date(e.created_at) < end,
    ).length;
    return {
      key: localDayKey(start),
      label: start.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
      }),
      count,
      visible: i % 2 === 1,
    };
  });
  const reduced = useReducedMotion();
  return (
    <figure className="meadow">
      <svg
        viewBox="0 0 320 120"
        aria-hidden="true"
        preserveAspectRatio="xMidYMax meet"
      >
        <path
          d="M0 104 C80 98 160 106 240 100 C280 98 300 101 320 100 V120 H0Z"
          fill="var(--g-ground)"
        />
        {weeks.map((w, i) => {
          const x = 20 + i * 40;
          const h = w.count ? 18 + Math.min(w.count, 7) * 10 : 4;
          return (
            <g key={w.key} transform={`translate(${x} 102)`}>
              <motion.g
                style={{ transformBox: "fill-box", originY: 1 }}
                {...(reduced
                  ? {}
                  : {
                      initial: { scaleY: 0 },
                      whileInView: { scaleY: 1 },
                      viewport: { once: true },
                      transition: {
                        duration: 1.4,
                        delay: i * 0.08,
                        ease: [0.22, 1, 0.36, 1],
                      },
                    })}
              >
                <path
                  d={`M0 0 C2 ${-h / 3} -2 ${(-2 * h) / 3} 0 ${-h}`}
                  stroke="var(--g-stem)"
                  strokeWidth="1.8"
                  fill="none"
                  strokeLinecap="round"
                />
                {Array.from({ length: Math.min(w.count, 7) }, (_, j) => (
                  <ellipse
                    key={j}
                    cx={j % 2 ? 5 : -5}
                    cy={-12 - j * 10}
                    rx="5.5"
                    ry="2.4"
                    fill={LEAF[j % 3]}
                    transform={`rotate(${j % 2 ? -25 : 25} ${j % 2 ? 5 : -5} ${-12 - j * 10})`}
                  />
                ))}
                {w.count === 0 && (
                  <circle cx="0" cy="-2" r="2.5" fill="var(--g-clay)" />
                )}
              </motion.g>
            </g>
          );
        })}
      </svg>
      <div className="meadow-labels" aria-hidden="true">
        {weeks.map((w) => (
          <span key={w.key}>{w.visible ? w.label : ""}</span>
        ))}
      </div>
      <figcaption>
        Each stem is a week; every leaf is an entry.
        <ul className="visually-hidden">
          {weeks.map((w) => (
            <li key={w.key}>
              Week of {w.label}: {w.count} {w.count === 1 ? "entry" : "entries"}
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}

export function MyGarden({
  user,
  entries,
  insights,
  error,
}: {
  user: User;
  entries: Entry[] | null;
  insights: Insights | null;
  error: string;
}) {
  const { growth, update, busy, error: growthError } = useGrowth();
  const navigate = useNavigate();
  if (!growth || !entries)
    return (
      <>
        <ErrorNotice message={error || growthError} />
        {!(error || growthError) && <Loading />}
      </>
    );
  const simple = growth.simple_mode;
  const saved = savedNewestFirst(entries);
  const tended = daysTended(entries);
  const plants = plantsFrom(entries);
  const invitation = !simple ? growth.invitations[0] : undefined;
  const contextModules = growth.modules.filter((m) =>
    ["sleep", "activity", "music"].includes(m),
  );
  const canExplore =
    !simple &&
    (growth.modules.includes("patterns") || growth.modules.includes("voice"));
  return (
    <div className="my-garden">
      <header className="garden-page-heading">
        <h1>My garden</h1>
        <p>
          {saved.length
            ? `${saved.length} ${saved.length === 1 ? "plant" : "plants"} so far — ${rhythmPhrase(tended)} lately.`
            : "A quiet place to watch your journal grow."}
        </p>
      </header>
      <ErrorNotice message={error || growthError} />
      <section className="garden-panel" aria-label="Your whole garden">
        <Garden
          plants={plants}
          label={gardenLabel(saved.length)}
          className="garden-wide"
        />
      </section>

      <Reveal className="garden-section" aria-labelledby="over-time">
        <h2 id="over-time">Over time</h2>
        <WeeksMeadow entries={entries} />
      </Reveal>

      <Reveal className="garden-section" aria-labelledby="recent">
        <h2 id="recent">Recent entries</h2>
        {saved.length ? (
          <ul className="recent-list">
            {saved.slice(0, 3).map((e) => (
              <li key={e.id}>
                <Link to={"/patient/entries/" + e.id}>
                  <span className="soft-date">{longDate(e.created_at)}</span>
                  <span className="reflection">{reflectionFor(e)}</span>
                  <span className="recent-title">{e.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="garden-empty">Your reflections will gather here.</p>
        )}
        <Link className="text-link" to="/patient/journal">
          Read your whole journal <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </Reveal>

      {invitation && (
        <Reveal
          className="garden-section growth-invitation"
          aria-labelledby="invitation"
        >
          <h2 id="invitation">{invitation.title}</h2>
          <p>{invitation.text}</p>
          <div className="invitation-choices">
            <button
              className="text-link"
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
                  navigate("/patient/insights");
              }}
            >
              Explore this pattern <ArrowRight size={15} />
            </button>
            <button
              className="quiet-button"
              disabled={busy}
              onClick={() => void update({ dismiss_invitation: invitation.id })}
            >
              Not now
            </button>
          </div>
        </Reveal>
      )}

      {!simple && growth.modules.includes("habits") && growth.habit_label && (
        <Reveal
          className="garden-section habit-today"
          aria-labelledby="intention"
        >
          <div>
            <h2 id="intention">{growth.habit_label}</h2>
            <p>Optional, every time. A missed day takes nothing away.</p>
          </div>
          <button
            className={
              "button outline " + (growth.habit_done_today ? "habit-done" : "")
            }
            disabled={busy}
            aria-pressed={growth.habit_done_today}
            onClick={() =>
              void update({ habit_done: !growth.habit_done_today })
            }
          >
            {growth.habit_done_today ? (
              <>
                <Check size={16} /> Noted for today
              </>
            ) : (
              "I made room for this"
            )}
          </button>
        </Reveal>
      )}

      {!simple && contextModules.length > 0 && insights && (
        <Reveal className="garden-section" aria-labelledby="around">
          <h2 id="around">Around your days</h2>
          <p className="garden-note">
            Only the context you chose · simulated data.
          </p>
          <ContextCards context={insights.context} modules={contextModules} />
        </Reveal>
      )}

      <Reveal className="garden-section tend-space" aria-labelledby="tend">
        <h2 id="tend">Tend your space</h2>
        <p>Add or put away small windows, whenever you feel curious.</p>
        <div className="tend-links">
          <Link className="text-link" to="/patient/space">
            <Settings2 size={16} aria-hidden="true" /> Your space
          </Link>
          {canExplore && (
            <Link className="text-link" to="/patient/insights">
              <Sprout size={16} aria-hidden="true" /> What helps
            </Link>
          )}
        </div>
        <SimpleModeControl />
        {simple && (
          <p className="garden-note">
            Simple view is on. Your pages and choices are kept for whenever you
            want to return.
          </p>
        )}
      </Reveal>
      {user.source === "simulated" && (
        <p className="garden-note">This is a fictional sample garden.</p>
      )}
    </div>
  );
}
