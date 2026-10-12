import { createHash } from "node:crypto";

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—",
  rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", hellip: "…", rupee: "₹",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x10ffff ? String.fromCodePoint(n) : "";
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
}

/**
 * Converts untrusted HTML to plain text. We never render retrieved HTML; this
 * output is displayed as text and sent to Gemini as data.
 */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return "";
  let s = String(html);
  s = s.replace(/<(script|style|noscript|iframe|svg)[\s\S]*?<\/\1>/gi, " ");
  s = s.replace(/<!--[\s\S]*?-->/g, " ");
  s = s.replace(/<(br|\/p|\/div|\/li|\/h\d)[^>]*>/gi, "\n");
  s = s.replace(/<[^>]+>/g, " ");
  s = decodeEntities(s);
  s = s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f​-‍﻿]/g, "");
  s = s.replace(/[ \t\f\v]+/g, " ").replace(/\s*\n\s*/g, "\n").replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

/** Removes WordPress boilerplate such as "The post X appeared first on Y." */
export function stripFeedBoilerplate(text: string): string {
  return text.replace(/The post .{0,400}? appeared first on .{0,120}?\.\s*$/s, "").trim();
}

export function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + "…";
}

const TRACKING_PARAMS = /^(utm_|fbclid|gclid|mc_|ref$|ref_src|cmpid|from$|source$|ito$|amp$)/i;

/** Canonical form of a URL used for exact-duplicate detection. */
export function canonicalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.protocol = "https:";
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "");
    u.hash = "";
    const keep = [...u.searchParams.entries()].filter(([k]) => !TRACKING_PARAMS.test(k));
    keep.sort(([a], [b]) => a.localeCompare(b));
    u.search = keep.length ? "?" + new URLSearchParams(keep).toString() : "";
    let path = u.pathname.replace(/\/amp\/?$/, "/").replace(/\/+$/, "");
    if (!path) path = "";
    return `${u.protocol}//${u.hostname}${u.port ? ":" + u.port : ""}${path}${u.search}`;
  } catch {
    return null;
  }
}

const STOPWORDS = new Set(
  "a an the and or of for to in on at by with from as is are was were be its it this that new launches launch announces announce announced unveils unveil csr india indian ltd limited".split(
    " ",
  ),
);

export function normalizeHeadline(h: string): string {
  return decodeEntities(h)
    .toLowerCase()
    .replace(/[’'`]/g, "")
    .replace(/[^a-z0-9₹ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function headlineTokens(h: string): Set<string> {
  return new Set(
    normalizeHeadline(h)
      .split(" ")
      .filter((t) => t.length > 1 && !STOPWORDS.has(t)),
  );
}

/** Jaccard similarity of significant headline tokens, 0..1. */
export function headlineSimilarity(a: string, b: string): number {
  const A = headlineTokens(a);
  const B = headlineTokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

const COMPANY_SUFFIX =
  /\b(ltd|limited|pvt|private|inc|incorporated|llp|plc|corp|corporation|co|company|group|india|foundation|trust|the)\b/g;

export function normalizeCompany(name: string): string {
  return decodeEntities(name)
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(COMPANY_SUFFIX, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/** Whitespace/quote/case-insensitive containment check used to verify AI excerpts. */
export function containsExcerpt(haystack: string, excerpt: string): boolean {
  const norm = (s: string) =>
    decodeEntities(s)
      .toLowerCase()
      .replace(/[‘’`´]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[–—]/g, "-")
      .replace(/…/g, "...")
      .replace(/\s+/g, " ")
      .trim();
  const e = norm(excerpt).replace(/^["'.…\s]+|["'.…\s]+$/g, "");
  if (e.length < 12) return false;
  return norm(haystack).includes(e);
}
