// The patient's frame: header with the three places, the leaf menu, the
// footnote and the low strip of grass that runs under Home and My journal.
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Leaf, LogOut, X } from "lucide-react";
import { useAuth, useResource } from "../auth";
import { GrowthProvider } from "../growth";
import { FlowLink } from "../design/flow";
import { Meadow } from "../design/Meadow";
import { localDayKey } from "../today";
import type { Entry } from "../types";

/* ───────────── The person's entries, shared by the three places ───────────── */

const EntriesContext = createContext<{
  entries: Entry[] | null;
  error: string;
  refresh: () => Promise<void>;
  /** The plant that has just been planted: it grows once in the grass. */
  grow: string | null;
  setGrow: (id: string | null) => void;
} | null>(null);
export function usePatientEntries() {
  const value = useContext(EntriesContext);
  if (!value) throw Error("PatientLayout is required");
  return value;
}

export function PatientLayout() {
  const { user } = useAuth();
  return (
    <GrowthProvider key={user!.id}>
      <EntriesProvider>
        <PatientFrame />
      </EntriesProvider>
    </GrowthProvider>
  );
}

function EntriesProvider({ children }: { children: React.ReactNode }) {
  const { data, error, refresh } = useResource<Entry[]>(
    "/patient/entries",
    5000,
  );
  const [grow, setGrow] = useState<string | null>(null);
  return (
    <EntriesContext.Provider
      value={{ entries: data, error, refresh, grow, setGrow }}
    >
      {children}
    </EntriesContext.Provider>
  );
}

/* ───────────── Footnote ───────────── */

/** Which preview this is, and that it is a prototype: one sentence. */
export function PatientFootnote() {
  const { health, user } = useAuth();
  const mode =
    health?.mode === "local_preview"
      ? "Local preview: temporary data, acoustic measurements only"
      : "Connected prototype with experimental voice analysis";
  return (
    <p className="pt-footnote">
      {mode}
      {user?.source === "simulated" ? ", on a fictional profile." : "."}{" "}
      Research prototype, no clinical diagnosis.
    </p>
  );
}

/* ───────────── The low strip of grass (Home, My journal) ───────────── */

const STRIP_DAYS = 21;

/** The grass at the foot of the page, with the last weeks' plants peeking out. */
export function GroundStrip() {
  const { entries, grow } = usePatientEntries();
  const now = new Date();
  const since = localDayKey(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() - STRIP_DAYS),
  );
  const recent = (entries ?? []).filter(
    (e) => e.saved && localDayKey(e.created_at) > since,
  );
  return (
    <div className="pt-strip">
      <Meadow entries={recent} height={76} compact grow={grow} decorative />
    </div>
  );
}

/* ───────────── Leaf menu: only "Sign out" ───────────── */

function LeafMenu({ onSignOut }: { onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null),
    panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>("button")?.focus();
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
    <div className="pt-leaf">
      <button
        ref={button}
        type="button"
        className="pt-leaf-button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        {open ? (
          <X size={20} aria-hidden="true" />
        ) : (
          <Leaf size={20} aria-hidden="true" />
        )}
      </button>
      {open && (
        <div className="pt-leaf-panel" id={id} ref={panel}>
          <button type="button" className="pt-signout" onClick={onSignOut}>
            <LogOut size={16} aria-hidden="true" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

/* ───────────── The frame ───────────── */

function placeOf(pathname: string) {
  if (pathname === "/patient" || pathname === "/patient/") return "home";
  if (pathname.startsWith("/patient/journal")) return "journal";
  if (pathname.startsWith("/patient/garden")) return "garden";
  return "page";
}

function PatientFrame() {
  const { logout } = useAuth();
  const { pathname, hash } = useLocation();
  const place = placeOf(pathname);
  // A new page starts at its top (anchors in My garden scroll themselves).
  useLayoutEffect(() => {
    if (!hash) window.scrollTo(0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
  return (
    <div className={"pt-app is-" + place}>
      <a className="pt-skip" href="#pt-main">
        Skip to content
      </a>
      <header className="pt-header">
        <FlowLink to="/patient" className="pt-wordmark" aria-label="Home">
          numa
        </FlowLink>
        <nav className="pt-nav" aria-label="Your journal">
          <FlowLink to="/patient" nav end>
            Home
          </FlowLink>
          <FlowLink to="/patient/journal" nav>
            My journal
          </FlowLink>
          <FlowLink to="/patient/garden" nav>
            My garden
          </FlowLink>
        </nav>
        <LeafMenu onSignOut={logout} />
      </header>
      <main className="pt-main" id="pt-main" tabIndex={-1}>
        <Outlet />
      </main>
      {place !== "garden" && (
        <footer className="pt-footer">
          <PatientFootnote />
        </footer>
      )}
      {(place === "home" || place === "journal") && <GroundStrip />}
    </div>
  );
}
