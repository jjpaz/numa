// Page-to-page movement for the patient's portal (DESIGN.md → "Transitions").
// BrowserRouter has no view transitions of its own, so navigation goes through
// document.startViewTransition when the browser has it and motion is welcome.
// Otherwise it is plain, instant navigation: nothing depends on the animation.
import {
  createElement,
  forwardRef,
  type AnchorHTMLAttributes,
  type MouseEvent,
} from "react";
import { flushSync } from "react-dom";
import {
  Link,
  useLocation,
  useNavigate,
  useResolvedPath,
  type NavigateOptions,
  type To,
} from "react-router-dom";

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => unknown;
};

export const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Run a DOM-changing update inside a view transition when one can play. */
export function withViewTransition(update: () => void) {
  const doc = document as ViewTransitionDocument;
  if (typeof doc.startViewTransition === "function" && !prefersReducedMotion())
    doc.startViewTransition(() => flushSync(update));
  else update();
}

const hashOf = (to: To) =>
  typeof to === "string" ? (to.split("#")[1] ?? "") : (to.hash ?? "").slice(1);

/** navigate(), wrapped in a view transition. A new page starts at its top. */
export function useFlowNavigate() {
  const navigate = useNavigate();
  return (to: To, options?: NavigateOptions) =>
    withViewTransition(() => {
      navigate(to, options);
      if (!hashOf(to)) window.scrollTo(0, 0);
    });
}

type FlowLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  to: To;
  replace?: boolean;
  /** Mark the link as the current page (aria-current="page") when it matches. */
  nav?: boolean;
  /** With nav: match the path exactly, not its sub-pages. */
  end?: boolean;
};

/** A Link that moves with a view transition; modified clicks stay native. */
export const FlowLink = forwardRef<HTMLAnchorElement, FlowLinkProps>(
  function FlowLink({ to, replace, nav, end, onClick, ...rest }, ref) {
    const go = useFlowNavigate();
    const { pathname } = useLocation();
    const target = useResolvedPath(to).pathname;
    const current =
      nav &&
      (pathname === target || (!end && pathname.startsWith(target + "/")));
    return createElement(Link, {
      ...rest,
      ref,
      to,
      replace,
      "aria-current": current ? "page" : undefined,
      onClick(e: MouseEvent<HTMLAnchorElement>) {
        onClick?.(e);
        if (
          e.defaultPrevented ||
          e.button !== 0 ||
          e.metaKey ||
          e.ctrlKey ||
          e.shiftKey ||
          e.altKey
        )
          return;
        e.preventDefault();
        go(to, { replace });
      },
    });
  },
);
