import { z } from "zod";
import { LIMITS, geminiModel } from "../config";

/**
 * Minimal server-side Gemini client (REST). This is the ONLY LLM provider in
 * the application. The API key is read from GEMINI_API_KEY on the server and
 * sent as a header, never in URLs or to the browser.
 */

export type GeminiErrorKind =
  | "missing_key"
  | "timeout"
  | "rate_limited"
  | "unavailable"
  | "invalid_response"
  | "blocked"
  | "http_error";

export class GeminiError extends Error {
  constructor(
    public kind: GeminiErrorKind,
    message: string,
    public attempts = 0,
  ) {
    super(message);
  }
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

const RETRYABLE: GeminiErrorKind[] = ["timeout", "rate_limited", "unavailable", "invalid_response"];

export interface StructuredRequest<T> {
  system: string;
  prompt: string;
  zod: z.ZodType<T>;
  temperature?: number;
  timeoutMs?: number;
  maxAttempts?: number;
  /** Injected in tests. */
  fetchImpl?: typeof fetch;
  sleepImpl?: (ms: number) => Promise<void>;
}

export interface StructuredResult<T> {
  data: T;
  model: string;
  attempts: number;
}

/** Converts a zod schema to the JSON Schema subset accepted by responseJsonSchema. */
export function toGeminiSchema(schema: z.ZodType): Record<string, unknown> {
  const js = z.toJSONSchema(schema, { target: "draft-2020-12" }) as Record<string, unknown>;
  delete js.$schema;
  return js;
}

export async function generateStructured<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiError("missing_key", "GEMINI_API_KEY is not configured");
  const model = geminiModel();
  const doFetch = req.fetchImpl ?? fetch;
  const sleep = req.sleepImpl ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const maxAttempts = Math.max(1, Math.min(req.maxAttempts ?? LIMITS.geminiMaxAttempts, 5));

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: req.system }] },
    contents: [{ role: "user", parts: [{ text: req.prompt }] }],
    generationConfig: {
      temperature: req.temperature ?? 0.1,
      responseMimeType: "application/json",
      responseJsonSchema: toGeminiSchema(req.zod),
    },
  });

  let last: GeminiError | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const data = await callOnce(doFetch, model, key, body, req.timeoutMs ?? LIMITS.geminiTimeoutMs, req.zod);
      return { data, model, attempts: attempt };
    } catch (err) {
      last = err instanceof GeminiError ? err : new GeminiError("http_error", String(err));
      last.attempts = attempt;
      if (!RETRYABLE.includes(last.kind) || attempt === maxAttempts) break;
      // Bounded exponential backoff with jitter: ~1s, ~2s, ~4s.
      const delay = Math.min(8000, 1000 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 250);
      await sleep(delay);
    }
  }
  throw last ?? new GeminiError("http_error", "Unknown Gemini failure");
}

async function callOnce<T>(
  doFetch: typeof fetch,
  model: string,
  key: string,
  body: string,
  timeoutMs: number,
  schema: z.ZodType<T>,
): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await doFetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body,
        signal: ctrl.signal,
      },
    );
  } catch (err) {
    if ((err as Error).name === "AbortError") throw new GeminiError("timeout", `Gemini timed out after ${timeoutMs}ms`);
    throw new GeminiError("unavailable", `Network error calling Gemini: ${(err as Error).message}`);
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 429) throw new GeminiError("rate_limited", "Gemini rate limit (429)");
  if (res.status >= 500) throw new GeminiError("unavailable", `Gemini unavailable (${res.status})`);
  if (!res.ok) {
    const text = (await res.text().catch(() => "")).slice(0, 300);
    // Never echo request headers; Google error bodies don't contain the key.
    throw new GeminiError("http_error", `Gemini HTTP ${res.status}: ${text.replace(/AIza[\w-]+/g, "[redacted]")}`);
  }

  const json = (await res.json().catch(() => null)) as GeminiResponse | null;
  const cand = json?.candidates?.[0];
  if (!cand) {
    if (json?.promptFeedback?.blockReason) throw new GeminiError("blocked", `Blocked: ${json.promptFeedback.blockReason}`);
    throw new GeminiError("invalid_response", "Gemini returned no candidates");
  }
  if (cand.finishReason === "SAFETY" || cand.finishReason === "PROHIBITED_CONTENT") {
    throw new GeminiError("blocked", `Response blocked (${cand.finishReason})`);
  }
  const text = (cand.content?.parts ?? [])
    .filter((p) => !p.thought && typeof p.text === "string")
    .map((p) => p.text)
    .join("");
  if (!text.trim()) throw new GeminiError("invalid_response", "Gemini returned empty text");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new GeminiError("invalid_response", "Gemini returned malformed JSON");
  }
  const valid = schema.safeParse(parsed);
  if (!valid.success) {
    const issue = valid.error.issues[0];
    throw new GeminiError("invalid_response", `Schema validation failed at ${issue?.path.join(".")}: ${issue?.message}`);
  }
  return valid.data;
}

interface GeminiResponse {
  candidates?: Array<{
    finishReason?: string;
    content?: { parts?: Array<{ text?: string; thought?: boolean }> };
  }>;
  promptFeedback?: { blockReason?: string };
}
