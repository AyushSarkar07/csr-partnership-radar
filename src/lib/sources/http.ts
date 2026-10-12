import { LIMITS, USER_AGENT } from "../config";
import type { FetchLike } from "./types";

export class SourceFetchError extends Error {}

/**
 * Bounded HTTP GET for registry sources only (callers pass URLs from the
 * source registry, never from user input). Enforces timeout and size limits.
 */
export async function boundedGet(
  url: string,
  fetchImpl: FetchLike = fetch,
  accept = "application/rss+xml, application/xml, text/xml, application/json;q=0.9, */*;q=0.5",
  timeoutMs: number = LIMITS.fetchTimeoutMs,
  retryDelayMs = 1_000,
): Promise<string> {
  try {
    return await getOnce(url, fetchImpl, accept, timeoutMs);
  } catch (err) {
    // One bounded retry for transient network resets (e.g. HTTP/2 stream errors). HTTP status errors are not retried here.
    if (err instanceof SourceFetchError && err.message.startsWith("Network error")) {
      await new Promise((r) => setTimeout(r, retryDelayMs));
      return getOnce(url, fetchImpl, accept, timeoutMs);
    }
    throw err;
  }
}

async function getOnce(url: string, fetchImpl: FetchLike, accept: string, timeoutMs: number): Promise<string> {
  const u = new URL(url);
  if (u.protocol !== "https:") throw new SourceFetchError("Only https sources are allowed");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      headers: { "user-agent": USER_AGENT, accept },
      signal: ctrl.signal,
      redirect: "follow",
      cache: "no-store",
    });
    if (!res.ok) throw new SourceFetchError(`HTTP ${res.status}${res.statusText ? " " + res.statusText : ""}`);
    const len = Number(res.headers.get("content-length") ?? 0);
    if (len > LIMITS.fetchMaxBytes) throw new SourceFetchError(`Response too large (${len} bytes)`);
    const text = await res.text();
    if (text.length > LIMITS.fetchMaxBytes) throw new SourceFetchError("Response too large");
    return text;
  } catch (err) {
    if ((err as Error).name === "AbortError") throw new SourceFetchError(`Timed out after ${timeoutMs / 1000}s`);
    if (err instanceof SourceFetchError) throw err;
    const cause = (err as { cause?: { code?: string; message?: string } }).cause;
    throw new SourceFetchError(`Network error: ${(err as Error).message}${cause ? ` (${cause.code ?? cause.message})` : ""}`);
  } finally {
    clearTimeout(timer);
  }
}
