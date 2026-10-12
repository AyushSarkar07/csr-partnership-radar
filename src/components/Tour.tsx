"use client";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Guided tour of the dashboard on demo data. Steps point at elements marked
 * with data-tour="…"; a step whose element is missing is skipped.
 */
interface Step {
  target?: string;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    title: "Welcome to CSR Partnership Radar",
    body: "Every week the radar reads CSR news, company announcements and calls for NGO partners, scores each one for your organisation, and tells you which companies are worth a call. This tour uses demo data, so feel free to click around. 8 short steps.",
  },
  {
    target: "status",
    title: "1. Always up to date",
    body: "See when the radar last checked its sources and when the next weekly digest arrives (every Monday, 06:00 IST). Use “Refresh intelligence” to check the sources right now.",
  },
  {
    target: "tiles",
    title: "2. Your week at a glance",
    body: "The headline numbers: companies worth a call this week, open calls for NGOs closing soon, policy changes and your watchlist. Urgent tiles turn green or red when there is something to act on.",
  },
  {
    target: "sectors",
    title: "3. Where opportunities come from",
    body: "How this week's relevant announcements split across your focus sectors. Click a sector to show only its opportunities. You can change the sectors in Settings.",
  },
  {
    target: "filters",
    title: "4. Find what you need",
    body: "Search by company, programme or place, filter by sector and choose the order. “More filters” adds period, priority, evidence strength, your decisions and more.",
  },
  {
    target: "legend",
    title: "5. What the colours mean",
    body: "Each opportunity gets one colour: green = call this week, amber = watchlist, purple = policy, blue-grey = context only, light grey = low relevance. Hover over any label for its meaning.",
  },
  {
    target: "card",
    title: "6. Read an opportunity in seconds",
    body: "Each card shows the score out of 100, a clear verdict with the reason, key details and the suggested next step. Open it to see the evidence quoted from the source, the score breakdown and where it was reported.",
  },
  {
    target: "card",
    title: "7. Record your decision",
    body: "Inside an opportunity, mark it as “Worth contacting this week”, “Monitor”, “Already contacted”, “Won” and more, with a note. Your decisions are kept with full history and shape the weekly digest.",
  },
  {
    target: "header",
    title: "8. Digest, sources and settings",
    body: "The Weekly digest is your Monday briefing (also emailed). Sources shows what the radar checks. Settings — top right — is where you change sectors, locations, scoring and email. You can restart this tour any time from “Take the tour”.",
  },
];

const DONE_KEY = "csr-radar-tour-done";

function readDone(): boolean {
  try {
    return window.localStorage.getItem(DONE_KEY) === "1";
  } catch {
    return false;
  }
}
function writeDone() {
  try {
    window.localStorage.setItem(DONE_KEY, "1");
  } catch {
    /* storage unavailable: the offer may reappear, which is harmless */
  }
}

function startUrl() {
  return "/?mode=demo&tour=1";
}

const START_EVENT = "csr-radar-tour-start";

/** Opens the demo dashboard and starts the tour (works when already on the dashboard). */
function startTour(router: ReturnType<typeof useRouter>) {
  router.push(startUrl());
  window.dispatchEvent(new Event(START_EVENT));
}

export function TourButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => startTour(router)}
      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink"
    >
      <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="m10 8 6 4-6 4Z" />
      </svg>
      Take the tour
    </button>
  );
}

type Rect = { top: number; left: number; width: number; height: number };

export function Tour() {
  const pathname = usePathname();
  const router = useRouter();
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [offer, setOffer] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Start when the URL asks for it (?tour=1); otherwise offer once to first-time visitors.
  useEffect(() => {
    if (pathname !== "/") return;
    // Deferred one tick so the check runs after the page has mounted.
    const id = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      if (params.get("tour") === "1") {
        setIndex(0);
        setActive(true);
        setOffer(false);
      } else if (!readDone()) {
        setOffer(true);
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, [pathname]);

  useEffect(() => {
    const onStart = () => {
      setOffer(false);
      setIndex(0);
      setActive(true);
    };
    window.addEventListener(START_EVENT, onStart);
    return () => window.removeEventListener(START_EVENT, onStart);
  }, []);

  const finish = useCallback(() => {
    setActive(false);
    setRect(null);
    writeDone();
    const url = new URL(window.location.href);
    if (url.searchParams.has("tour")) {
      url.searchParams.delete("tour");
      window.history.replaceState(null, "", url.pathname + (url.search ? url.search : ""));
    }
  }, []);

  const step = STEPS[index];

  // Locate the target (wait for the page to render), scroll it into view and track its position.
  useLayoutEffect(() => {
    if (!active || !step.target) return;
    let cancelled = false;
    let tries = 0;
    const measure = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top, left: r.left, width: r.width, height: r.height };
    };
    const locate = () => {
      if (cancelled) return;
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      if (!el) {
        if (tries++ < 20) return void setTimeout(locate, 150); // page may still be loading
        setIndex((i) => Math.min(i + 1, STEPS.length - 1)); // element absent: skip step
        return;
      }
      el.scrollIntoView({ block: "center", behavior: "auto" });
      requestAnimationFrame(() => !cancelled && setRect(measure()));
    };
    locate();
    const update = () => setRect(measure());
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      cancelled = true;
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update);
    };
  }, [active, step]);

  // Keyboard controls and focus.
  useEffect(() => {
    if (!active) return;
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight") setIndex((i) => (i < STEPS.length - 1 ? i + 1 : i));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, index, finish]);

  if (!active) {
    if (!offer || pathname !== "/") return null;
    return (
      <div className="fixed bottom-4 right-4 z-40 max-w-xs rounded-xl border border-accent/40 bg-surface p-4 shadow-lg">
        <p className="text-sm font-medium">New here?</p>
        <p className="mt-1 text-sm text-ink-2">Take a 2-minute guided tour of how the radar works.</p>
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={() => { setOffer(false); startTour(router); }} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white">
            Start the tour
          </button>
          <button type="button" onClick={() => { setOffer(false); writeDone(); }} className="rounded-lg px-3 py-1.5 text-sm text-ink-2 hover:bg-surface-2">
            Not now
          </button>
        </div>
      </div>
    );
  }

  const target = step.target ? rect : null; // steps without a target are centred
  const pad = 8;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const vh = typeof window !== "undefined" ? window.innerHeight : 768;
  const width = Math.min(380, vw - 32);
  let popStyle: React.CSSProperties;
  if (target) {
    const below = target.top + target.height + pad + 12;
    const placeBelow = below + 220 < vh || target.top < 240;
    const top = Math.max(16, placeBelow ? Math.min(below, vh - 230) : target.top - pad - 12 - 210);
    const left = Math.min(Math.max(16, target.left), vw - width - 16);
    popStyle = { top, left, width };
  } else {
    popStyle = { top: Math.max(16, vh / 2 - 140), left: (vw - width) / 2, width };
  }
  const last = index === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50" aria-live="polite">
      {/* Dim the page; the highlighted element shows through the cut-out. */}
      {target ? (
        <div
          aria-hidden
          className="pointer-events-none fixed rounded-xl ring-2 ring-accent transition-all duration-300"
          style={{
            top: target.top - pad,
            left: target.left - pad,
            width: target.width + pad * 2,
            height: target.height + pad * 2,
            boxShadow: "0 0 0 9999px rgba(5, 10, 20, 0.62)",
          }}
        />
      ) : (
        <div aria-hidden className="fixed inset-0 bg-[rgba(5,10,20,0.62)]" />
      )}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        tabIndex={-1}
        className="fixed rounded-xl border border-line bg-surface p-4 shadow-2xl outline-none"
        style={popStyle}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-accent">{index === 0 ? "Guided tour" : `Step ${index} of ${STEPS.length - 1}`}</span>
          <button type="button" onClick={finish} className="text-xs text-ink-3 hover:text-ink">Skip tour</button>
        </div>
        <h2 id="tour-title" className="mt-1 font-serif text-lg font-semibold">{step.title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-2">{step.body}</p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex gap-1" aria-hidden>
            {STEPS.map((_, i) => (
              <span key={i} className={`h-1.5 w-4 rounded-full ${i === index ? "bg-accent" : i < index ? "bg-accent/40" : "bg-line"}`} />
            ))}
          </div>
          <div className="flex gap-2">
            {index > 0 && (
              <button type="button" onClick={() => setIndex(index - 1)} className="rounded-lg px-3 py-1.5 text-sm text-ink-2 hover:bg-surface-2">Back</button>
            )}
            <button
              type="button"
              onClick={() => (last ? finish() : setIndex(index + 1))}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white"
            >
              {last ? "Finish" : index === 0 ? "Start" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
