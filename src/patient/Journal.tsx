// My journal: every entry, newest first, in months (DESIGN.md → "My journal").
import { CircleAlert } from "lucide-react";
import { useAuth } from "../auth";
import { Loading } from "../components";
import { FlowLink } from "../design/flow";
import { PlantFigure, plantTransitionName } from "../design/Meadow";
import { isToday, reflectionFor } from "../today";
import type { Entry } from "../types";
import { usePatientEntries } from "./Layout";

const shortDate = (value: string) =>
  new Date(value).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

/** The first line of the person's own words, if there are any. */
const firstLine = (text: string | null | undefined) =>
  (text ?? "").trim().split(/\n+/)[0]?.trim() ?? "";

/** One entry as a row: date, its plant, then title, reflection, words, meta. */
function JournalRow({ e }: { e: Entry }) {
  const today = isToday(e.created_at);
  const busy = ["pending", "processing"].includes(e.status);
  const words = firstLine(e.transcript);
  const meta = busy
    ? "Still listening"
    : !e.saved
      ? "Draft, not saved yet"
      : e.action?.feedback === "helpful"
        ? "Something helped"
        : "";
  return (
    <li>
      <FlowLink
        to={"/patient/entries/" + e.id}
        className={
          "log-entry jl-row" +
          (today ? " is-today" : "") +
          (e.saved ? "" : " is-draft")
        }
      >
        <span className="jl-date">
          <time dateTime={e.created_at}>
            {today ? "Today" : shortDate(e.created_at)}
          </time>
        </span>
        <span className="jl-plant">
          <PlantFigure
            entry={e}
            decorative
            style={{ viewTransitionName: plantTransitionName(e.id) }}
          />
        </span>
        <span className="jl-body">
          <span className="jl-title">
            {busy ? "Listening to your day…" : e.title}
          </span>
          {!busy && <span className="jl-reflection">{reflectionFor(e)}</span>}
          {words && <span className="jl-quote">{words}</span>}
          {meta && <span className="jl-meta">{meta}</span>}
        </span>
      </FlowLink>
    </li>
  );
}

export function JournalPage() {
  const { user } = useAuth();
  const { entries, error } = usePatientEntries();
  const sample = user!.source === "simulated";
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
    <div className="jl-page pt-wrap">
      <header className="jl-head">
        <h1>My journal</h1>
        <p>Every entry you’ve planted, newest first.</p>
      </header>
      {error && (
        <p className="pt-error" role="alert">
          <CircleAlert size={18} aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
      {!entries ? (
        !error && <Loading />
      ) : sorted.length === 0 ? (
        <div className="jl-empty">
          <p>Your journal is waiting for its first entry.</p>
          {!sample && (
            <FlowLink className="pt-primary" to="/patient">
              Add an entry
            </FlowLink>
          )}
        </div>
      ) : (
        months.map((month) => (
          <section
            key={month.label}
            className="jl-month"
            aria-label={month.label}
          >
            <h2>{month.label}</h2>
            <ol className="jl-list">
              {month.items.map((e) => (
                <JournalRow key={e.id} e={e} />
              ))}
            </ol>
          </section>
        ))
      )}
    </div>
  );
}
