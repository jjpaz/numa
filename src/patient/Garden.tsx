// My garden: what the journal is teaching you (DESIGN.md → "My garden").
// The sky (cream) with the title and a sentence of real numbers, the whole
// meadow, then the ground (green) to the end of the page: What helps,
// Connections and Your space, all visible without a click.
import { useEffect, type MouseEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CircleAlert } from "lucide-react";
import { useAuth, useResource } from "../auth";
import { ContextCards, Loading } from "../components";
import { SpaceSection } from "../growth";
import { useBoxWidth } from "../design/Grass";
import { Meadow } from "../design/Meadow";
import { FlowLink, prefersReducedMotion } from "../design/flow";
import { daysTended, rhythmPhrase } from "../today";
import type { Insights } from "../types";
import { PatientFootnote, usePatientEntries } from "./Layout";

const SECTIONS = [
  { id: "what-helps", label: "What helps" },
  { id: "connections", label: "Connections" },
  { id: "your-space", label: "Your space" },
];

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

/** Scroll to a section: smooth, or instant when motion is reduced. */
function goTo(id: string, smooth: boolean) {
  const target = document.getElementById(id);
  if (!target) return;
  target.scrollIntoView({
    behavior: smooth && !prefersReducedMotion() ? "smooth" : "auto",
    block: "start",
  });
  target.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
}

function WhatHelps({ insights, sample }: { insights: Insights | null; sample: boolean }) {
  if (!insights) return <Loading />;
  const patterns = insights.patterns
    .filter((p) => p.observations > 0)
    .sort(
      (a, b) =>
        b.helpful / b.observations - a.helpful / a.observations ||
        b.helpful - a.helpful,
    );
  if (!patterns.length)
    return (
      <div className="mg-empty">
        <p>
          After an entry, try the small next step and tell Numa if it helped.
          Your answers will grow here.
        </p>
        {!sample && (
          <FlowLink className="mg-link" to="/patient">
            Add an entry
          </FlowLink>
        )}
      </div>
    );
  return (
    <ul className="mg-helps">
      {patterns.map((p) => (
        <li key={p.kind}>
          <span className="mg-helps-name">{p.label}</span>
          <span className="mg-helps-count">
            helpful {p.helpful} of {p.observations}{" "}
            {p.observations === 1 ? "time" : "times"}
          </span>
          <span className="mg-bar" aria-hidden="true">
            <span style={{ width: `${(p.helpful / p.observations) * 100}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}

export function MyGardenPage() {
  const { user } = useAuth();
  const { entries, error } = usePatientEntries();
  const insights = useResource<Insights>("/patient/insights", 5000);
  const { hash } = useLocation();
  const navigate = useNavigate();
  const [land, W] = useBoxWidth<HTMLDivElement>();
  const sample = user!.source === "simulated";
  const saved = (entries ?? []).filter((e) => e.saved).length;
  const ready = !!entries && !!insights.data;
  // Arriving at an anchor (an old route, a link): go there once it is drawn.
  useEffect(() => {
    if (ready && hash) goTo(hash.slice(1), false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
  const jump = (id: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    navigate({ hash: id }, { replace: true });
    goTo(id, true);
  };
  return (
    <div className="mg-page">
      <section className="mg-sky pt-wrap" aria-labelledby="mg-title">
        <h1 id="mg-title">My garden</h1>
        <p className="mg-tagline">The journal that grows with you.</p>
        <p className="mg-facts">
          {!entries
            ? " "
            : saved
              ? `${saved} ${saved === 1 ? "entry" : "entries"} planted. Over the last two weeks ${rhythmPhrase(daysTended(entries))}.`
              : "Nothing planted yet. Your first entry starts the garden."}
        </p>
        <nav className="mg-anchors" aria-label="On this page">
          {SECTIONS.map((s) => (
            <a key={s.id} href={"#" + s.id} onClick={jump(s.id)}>
              {s.label}
            </a>
          ))}
        </nav>
        {error && (
          <p className="pt-error" role="alert">
            <CircleAlert size={18} aria-hidden="true" />
            <span>{error}</span>
          </p>
        )}
      </section>
      <div className="mg-land" ref={land}>
        <Meadow
          entries={entries ?? []}
          height={W < 720 ? 230 : 300}
          className="mg-meadow"
        />
        <div className="mg-ground">
          <div className="pt-wrap">
            <section id="what-helps" className="mg-section" aria-labelledby="mg-helps">
              <h2 id="mg-helps" tabIndex={-1}>
                What helps
              </h2>
              <p className="mg-intro">
                What you’ve told Numa helped, in your own words. A personal
                pattern, not proof of cause.
              </p>
              <WhatHelps insights={insights.data} sample={sample} />
            </section>
            <section id="connections" className="mg-section" aria-labelledby="mg-connections">
              <h2 id="mg-connections" tabIndex={-1}>
                Connections
              </h2>
              <p className="mg-intro">
                The context of your days. <span className="mg-note">Simulated data</span>
              </p>
              {insights.data ? (
                <ContextCards context={insights.data.context} />
              ) : (
                <Loading />
              )}
              <h3 className="mg-h3 mg-future-title">Possible future connections</h3>
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
              <p className="mg-small">
                Sleep, activity, weather and listening history use simulated
                data in this prototype. No external accounts are connected.
              </p>
            </section>
            <section id="your-space" className="mg-section" aria-labelledby="mg-space">
              <h2 id="mg-space" tabIndex={-1}>
                Your space
              </h2>
              <p className="mg-intro">A little more, only when you want it.</p>
              <SpaceSection user={user!} insights={insights.data} />
            </section>
            <footer className="mg-foot">
              <p>
                Your words stay in your journal. Your psychologist sees trends
                only.
              </p>
              <PatientFootnote />
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}
