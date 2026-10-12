"""Swimlane Components Map (actor rows x Trigger/Input/Context/Processing/AI/Output).

Writes docs/components-map-swimlane.svg. Run: python3 scripts/build-components-swimlane.py
Every box corresponds to implemented code; see docs/COMPONENTS_MAP.md for file paths.
"""
import html
import os

W, H = 2000, 1340
X0 = 24
ACTOR_W = 270
COLS = ["Trigger", "Input", "Context", "Processing", "AI", "Output"]
COL_W = (W - 2 * X0 - ACTOR_W) / len(COLS)
HEAD_Y, HEAD_H = 104, 84

# Actor rows: (title, subtitle, height)
ROWS = [
    ("Ananya", "Head of Partnerships", 128),
    ("Vercel Cron", "weekly scheduler", 128),
    ("Public sources", "18 live feeds", 128),
    ("Radar memory", "Context", 128),
    ("Rules engine", "scoring in code", 232),
    ("Gemini Flash", "read & summarise", 178),
    ("Digest & dashboard", "+ email via Resend", 140),
]
ROW_Y = []
y = HEAD_Y + HEAD_H
for _, _, h in ROWS:
    ROW_Y.append(y)
    y += h
GRID_BOTTOM = y

STYLE = {
    "trigger": ("#fff4e0", "#d97706"),
    "input": ("#e8f1ff", "#2563eb"),
    "context": ("#e6f6ee", "#059669"),
    "process": ("#fff7d1", "#ca8a04"),
    "ai": ("#fdecef", "#e11d48"),
    "output": ("#f1ebff", "#7c3aed"),
    "human": ("#dcfce7", "#15803d"),
    "muted": ("#f1f3f6", "#94a3b8"),
}

out = []


def esc(s):
    return html.escape(s, quote=True)


def col_x(i):
    return X0 + ACTOR_W + i * COL_W


def wrap(text, max_chars):
    words, lines, cur = text.split(), [], ""
    for w in words:
        if len(cur) + len(w) + (1 if cur else 0) > max_chars:
            lines.append(cur)
            cur = w
        else:
            cur = f"{cur} {w}" if cur else w
    if cur:
        lines.append(cur)
    return lines


def box(col, row, title, sub, kind, offset_y=0, height=None, width_cols=1):
    """Box centred in a cell; returns its rect (x, y, w, h)."""
    fill, stroke = STYLE[kind]
    w = COL_W * width_cols - 34
    x = col_x(col) + 17
    t_lines = wrap(title, 27)
    s_lines = wrap(sub, 36) if sub else []
    h = height or (22 + len(t_lines) * 21 + len(s_lines) * 17 + 14)
    row_h = ROWS[row][2]
    yy = ROW_Y[row] + (row_h - h) / 2 + offset_y
    sw = 3.2 if kind == "human" else 2
    out.append(f'<rect x="{x:.1f}" y="{yy:.1f}" width="{w:.1f}" height="{h:.1f}" rx="10" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>')
    ty = yy + 26
    for ln in t_lines:
        weight = 700 if kind == "human" else 600
        out.append(f'<text x="{x + w / 2:.1f}" y="{ty:.1f}" font-size="16" font-weight="{weight}" fill="#152036" text-anchor="middle">{esc(ln)}</text>')
        ty += 21
    ty += 2
    for ln in s_lines:
        out.append(f'<text x="{x + w / 2:.1f}" y="{ty:.1f}" font-size="12.5" fill="#46536b" text-anchor="middle">{esc(ln)}</text>')
        ty += 17
    return (x, yy, w, h)


def arrow(points, label=None, lx=None, ly=None, colour="#4b5578", anchor="start"):
    d = "M " + " L ".join(f"{px:.1f} {py:.1f}" for px, py in points)
    out.append(f'<path d="{d}" fill="none" stroke="{colour}" stroke-width="1.8" stroke-dasharray="6 5" marker-end="url(#arr-{colour[1:]})"/>')
    if label:
        out.append(f'<text x="{lx:.1f}" y="{ly:.1f}" font-size="12.5" font-style="italic" fill="{colour}" text-anchor="{anchor}">{esc(label)}</text>')


# ---------------------------------------------------------------- canvas
out.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" font-family="Inter, Helvetica, Arial, sans-serif">')
markers = "".join(
    f'<marker id="arr-{c[1:]}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="{c}"/></marker>'
    for c in ["#4b5578", "#15803d", "#e11d48", "#7c3aed"]
)
out.append(f"<defs>{markers}"
           '<linearGradient id="actor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0f5f73"/><stop offset="1" stop-color="#0b4a5c"/></linearGradient>'
           "</defs>")
out.append(f'<rect width="{W}" height="{H}" fill="#f7f8fb"/>')
out.append(f'<text x="{W / 2}" y="62" font-size="38" font-weight="800" fill="#13294b" text-anchor="middle">Ananya / CSR Partnership Radar — Components Map</text>')

# grid frame
out.append(f'<rect x="{X0}" y="{HEAD_Y}" width="{W - 2 * X0}" height="{GRID_BOTTOM - HEAD_Y}" rx="14" fill="#ffffff" stroke="#dfe4ee"/>')
out.append(f'<path d="M {X0} {HEAD_Y + 14} a 14 14 0 0 1 14 -14 H {W - X0 - 14} a 14 14 0 0 1 14 14 V {HEAD_Y + HEAD_H} H {X0} Z" fill="#13294b"/>')
out.append(f'<text x="{X0 + ACTOR_W / 2}" y="{HEAD_Y + 54}" font-size="26" font-weight="700" fill="#ffffff" text-anchor="middle">Actor</text>')
for i, c in enumerate(COLS):
    cx = col_x(i) + COL_W / 2
    out.append(f'<text x="{cx:.1f}" y="{HEAD_Y + 54}" font-size="26" font-weight="700" fill="#ffffff" text-anchor="middle">{c}</text>')
    out.append(f'<line x1="{col_x(i):.1f}" y1="{HEAD_Y}" x2="{col_x(i):.1f}" y2="{GRID_BOTTOM}" stroke="#e3e7ef" stroke-dasharray="4 4"/>')

# actor column + row lines
out.append(f'<path d="M {X0} {ROW_Y[0]} H {X0 + ACTOR_W} V {GRID_BOTTOM} H {X0 + 14} a 14 14 0 0 1 -14 -14 Z" fill="url(#actor)"/>')
for j, (title, sub, h) in enumerate(ROWS):
    yy = ROW_Y[j]
    if j > 0:
        out.append(f'<line x1="{X0}" y1="{yy}" x2="{W - X0}" y2="{yy}" stroke="#e3e7ef"/>')
        out.append(f'<line x1="{X0}" y1="{yy}" x2="{X0 + ACTOR_W}" y2="{yy}" stroke="#ffffff" stroke-opacity="0.25"/>')
    out.append(f'<text x="{X0 + 24}" y="{yy + h / 2 - 2}" font-size="25" font-weight="700" fill="#ffffff">{esc(title)}</text>')
    out.append(f'<text x="{X0 + 24}" y="{yy + h / 2 + 24}" font-size="16" fill="#cdeef3">({esc(sub)})</text>')

# ---------------------------------------------------------------- boxes
T1 = box(0, 0, "Clicks “Refresh intelligence”", "any time, from the dashboard", "trigger")
T2 = box(0, 1, "Every Monday, 06:00 IST", "scan + digest · a repeat run the same day is skipped", "trigger")
I1 = box(1, 2, "Pulls 18 public feeds", "CSR news · NGO partner calls · MCA rule updates → headline, text, date, link", "input")
C1 = box(2, 3, "Focus sectors · Pune + target regions · scoring weights", "+ past items & decisions in Neon", "context")
P1 = box(3, 4, "Keyword filter · duplicate merge · 7-day IST window", "only new, relevant items go on", "process", offset_y=-52)
P2 = box(3, 4, "Checks every quote against the source · 100-pt score", "→ Call this week / Watchlist / Policy / Context only", "process", offset_y=58)
A1 = box(4, 5, "Reads each article → strict JSON", "sector · company · type · NGO-partner signal + exact quotes · never the score · writes the weekly brief", "ai")
O3 = box(5, 4, "Low relevance / expired calls", "kept as context, never padded into the shortlist", "muted", offset_y=58)
O1 = box(5, 6, "Ranked dashboard + Monday digest", "emailed via Resend · printable", "output")
O2 = box(5, 0, "Reviews & decides", "call · monitor · won — AI recommends, Ananya decides", "human")

def mid_left(b): return (b[0], b[1] + b[3] / 2)
def mid_right(b): return (b[0] + b[2], b[1] + b[3] / 2)
def mid_top(b): return (b[0] + b[2] / 2, b[1])
def mid_bot(b): return (b[0] + b[2] / 2, b[1] + b[3])

# triggers → input (shared bus in the Trigger/Input gap)
bus_x = col_x(1) - 8
iy = mid_left(I1)[1]
arrow([mid_bot(T2), (mid_bot(T2)[0], iy), (I1[0] - 2, iy)], "weekly run", mid_bot(T2)[0] + 8, iy - 8)
arrow([mid_right(T1), (bus_x, mid_right(T1)[1]), (bus_x, iy - 14), (I1[0] - 2, iy - 14)], "on demand", bus_x + 6, mid_right(T1)[1] - 8)

# input → rules engine (filter)
p1x = mid_top(P1)[0] - 40
arrow([mid_right(I1), (p1x, mid_right(I1)[1]), (p1x, P1[1] - 2)], "raw items", mid_right(I1)[0] + 14, mid_right(I1)[1] - 8)
# context → filter (rules)
arrow([mid_right(C1), (col_x(3) + 40, mid_right(C1)[1]), (col_x(3) + 40, P1[1] - 2)], "sectors · regions · weights", mid_right(C1)[0] + 12, mid_right(C1)[1] - 8)
# context → AI (sector list for the prompt)
a_in_y = A1[1] + A1[3] * 0.72
arrow([mid_bot(C1), (mid_bot(C1)[0], a_in_y), (A1[0] - 2, a_in_y)], "sector list for the prompt", mid_bot(C1)[0] + 10, a_in_y - 8)
# filter → AI
ax = mid_top(A1)[0]
arrow([mid_right(P1), (ax, mid_right(P1)[1]), (ax, A1[1] - 2)], "new items only", mid_right(P1)[0] + 14, mid_right(P1)[1] - 8)
# AI → score
arrow([(A1[0] + 30, A1[1]), (A1[0] + 30, mid_right(P2)[1] - 14), (P2[0] + P2[2] + 2, mid_right(P2)[1] - 14)], "facts + quotes", A1[0] + 38, A1[1] - 10, colour="#e11d48")
# score → low / context
arrow([(mid_right(P2)[0], mid_right(P2)[1] + 22), (O3[0] - 2, mid_right(P2)[1] + 22)], "low / expired", O3[0] - 12, mid_right(P2)[1] + 16, anchor="end")
# score → dashboard (ranked)
o1y = mid_left(O1)[1] + 10
arrow([mid_bot(P2), (mid_bot(P2)[0], o1y), (O1[0] - 2, o1y)], "ranked shortlist", mid_bot(P2)[0] + 10, o1y - 8)
# AI → dashboard (weekly brief)
arrow([mid_right(A1), (O1[0] + O1[2] / 2, mid_right(A1)[1]), (O1[0] + O1[2] / 2, O1[1] - 2)], "weekly brief", mid_right(A1)[0] + 12, mid_right(A1)[1] - 8, colour="#e11d48")
# dashboard → Ananya (Monday email)
rx = W - X0 - 8
arrow([mid_right(O1), (rx, mid_right(O1)[1]), (rx, mid_right(O2)[1]), (O2[0] + O2[2] + 2, mid_right(O2)[1])], "Monday 06:00 email", rx - 8, ROW_Y[1] + 60, colour="#7c3aed", anchor="end")
# Ananya's decision → memory (saved, never overwritten)
cx3 = mid_top(C1)[0]
arrow([mid_left(O2), (cx3, mid_left(O2)[1]), (cx3, C1[1] - 2)], "decision saved — never overwritten by the next scan", cx3 + 10, mid_left(O2)[1] - 10, colour="#15803d")

# ---------------------------------------------------------------- legend + footer
ly = GRID_BOTTOM + 34
items = [("trigger", "Trigger"), ("input", "Live data"), ("context", "Context"), ("process", "Rules in code"), ("ai", "Gemini Flash (only AI)"), ("output", "Output"), ("human", "Human decision"), ("muted", "Held back")]
x = X0 + 6
for kind, label in items:
    fill, stroke = STYLE[kind]
    out.append(f'<rect x="{x}" y="{ly - 13}" width="22" height="16" rx="4" fill="{fill}" stroke="{stroke}" stroke-width="2"/>')
    out.append(f'<text x="{x + 30}" y="{ly}" font-size="14" fill="#33405a">{esc(label)}</text>')
    x += 30 + len(label) * 7.6 + 30
out.append(f'<text x="{W / 2}" y="{ly + 40}" font-size="15" fill="#5b6780" text-anchor="middle">'
           "Monday cron or Refresh → 18 public feeds → rules in code (filter, dedupe, 7-day window) → Gemini Flash (facts &amp; quotes only) → score in code → digest + email → Ananya decides"
           "</text>")
out.append("</svg>")

path = os.path.join(os.path.dirname(__file__), "..", "docs", "components-map-swimlane.svg")
with open(path, "w") as f:
    f.write("\n".join(out))
print("wrote", os.path.normpath(path))
