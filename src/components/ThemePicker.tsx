"use client";
import { useEffect, useRef, useState } from "react";

const THEMES = [
  { id: "system", label: "System", swatch: ["#f4f6fa", "#0a101d"] },
  { id: "light", label: "Light", swatch: ["#f4f6fa", "#2f5bea"] },
  { id: "dark", label: "Dark", swatch: ["#111a2b", "#7c9dff"] },
  { id: "midnight", label: "Midnight", swatch: ["#15132e", "#a78bfa"] },
  { id: "sand", label: "Sand", swatch: ["#fffaf2", "#b4531a"] },
] as const;
type ThemeId = (typeof THEMES)[number]["id"];
const KEY = "csr-radar-theme";

function apply(id: ThemeId) {
  const root = document.documentElement;
  if (id === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", id);
}

/** Inline script for <head>: applies the saved theme before first paint (no flash). */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem("${KEY}");if(t&&t!=="system")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

export function ThemePicker() {
  const [theme, setTheme] = useState<ThemeId>("system");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(KEY) as ThemeId | null;
        if (saved && THEMES.some((t) => t.id === saved)) setTheme(saved);
      } catch {
        /* storage unavailable: stay on system */
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const choose = (id: ThemeId) => {
    setTheme(id);
    apply(id);
    try {
      window.localStorage.setItem(KEY, id);
    } catch {
      /* ignore */
    }
    setOpen(false);
  };
  const current = THEMES.find((t) => t.id === theme)!;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink"
      >
        <span aria-hidden className="flex h-4 w-4 overflow-hidden rounded-full ring-1 ring-line">
          <span className="h-full w-1/2" style={{ background: current.swatch[0] }} />
          <span className="h-full w-1/2" style={{ background: current.swatch[1] }} />
        </span>
        Theme
      </button>
      {open && (
        <ul role="menu" className="absolute right-0 z-50 mt-1 w-44 overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-xl">
          {THEMES.map((t) => (
            <li key={t.id} role="none">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={theme === t.id}
                onClick={() => choose(t.id)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-surface-2 ${theme === t.id ? "font-semibold text-ink" : "text-ink-2"}`}
              >
                <span aria-hidden className="flex h-5 w-5 overflow-hidden rounded-full ring-1 ring-line">
                  <span className="h-full w-1/2" style={{ background: t.swatch[0] }} />
                  <span className="h-full w-1/2" style={{ background: t.swatch[1] }} />
                </span>
                {t.label}
                {theme === t.id && <span className="ml-auto text-accent" aria-hidden>✓</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
