/**
 * Central runtime configuration. Server-side only values are read lazily from
 * process.env so they are never bundled into client code.
 */

/** Gemini Flash model id — verified against the live models.list endpoint on 2026-10-12. */
export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";

export function geminiModel(): string {
  const m = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  // Guardrail: the assignment requires Gemini *Flash* for every AI task.
  if (!/^gemini-[\w.-]*flash[\w.-]*$/i.test(m)) {
    throw new Error(`GEMINI_MODEL must be a Gemini Flash model, got "${m}"`);
  }
  return m;
}

export const DEFAULT_TIMEZONE = "Asia/Kolkata";

export const LIMITS = {
  fetchTimeoutMs: 12_000,
  fetchMaxBytes: 3_000_000,
  geminiTimeoutMs: 45_000,
  geminiMaxAttempts: 3,
  /** Max Gemini classifications per pipeline run (Vercel function duration + cost guard). */
  maxAiPerRun: Number(process.env.MAX_AI_PER_RUN ?? 16),
  aiConcurrency: 3,
  /** Retrieved items older than this are not stored at all. */
  ingestLookbackDays: 30,
  /** Characters of article text sent to Gemini. */
  aiInputChars: 6_000,
  storedTextChars: 12_000,
  refreshCooldownSeconds: 120,
  digestCooldownSeconds: 20,
};

export const USER_AGENT =
  "CSRPartnershipRadar/1.0 (NGO research tool; RSS reader; +https://github.com/AyushSarkar07/csr-partnership-radar)";

export function appUrl(): string {
  return process.env.APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
}
