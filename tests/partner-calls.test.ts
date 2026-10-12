import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { describeDatabaseUrl, resolveDatabaseUrl } from "@/lib/db/url";
import { normalizeItem, prefilter } from "@/lib/pipeline/normalize";
import { scoreOpportunity, type ScoringInput } from "@/lib/scoring/score";
import { DEFAULT_SETTINGS } from "@/lib/settings/schema";
import { fetchGdelt, isRateLimitNotice } from "@/lib/sources/adapters/gdelt";
import { parseNgoboxListing } from "@/lib/sources/adapters/ngobox";
import { REGISTRY } from "@/lib/sources/registry";
import { parseDeadline, reportingWindow } from "@/lib/time/window";

const html = readFileSync(path.join(import.meta.dirname, "fixtures", "ngobox-listing.html"), "utf8");
const ngobox = REGISTRY.find((s) => s.id === "ngobox-rfp")!;
const w = reportingWindow(new Date("2026-10-12T00:30:00Z"), 7, "Asia/Kolkata");

describe("NGOBox RFP/EOI adapter", () => {
  const items = parseNgoboxListing(html);
  it("parses title, organisation, deadline and absolute URL; no publication date", () => {
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe("Call for NGO Implementation Partners – Youth Skilling Programme, Pune");
    expect(items[0].url).toBe("https://www.ngobox.org/full_rfp_eoi_Call-for-NGO-Partners-Youth-Skilling-Pune-Fixture-Foundation_101");
    expect(items[0].deadlineRaw).toBe("30 Oct. 2026");
    expect(items[0].publishedRaw).toBeNull();
    expect(items[0].description).toContain("Issued by: Fixture Foundation");
  });
  it("normalises the deadline and keeps the date unknown", () => {
    const n = normalizeItem(items[0], ngobox);
    expect(n.ok).toBe(true);
    if (!n.ok) return;
    expect(n.item.deadline).toBe("2026-10-30");
    expect(n.item.publishedAt).toBeNull();
    expect(n.item.provenance).toBe("unknown");
    expect(prefilter(n.item, DEFAULT_SETTINGS, ngobox).candidate).toBe(true);
  });
  it("vendor procurement without a sector term is filtered out", () => {
    const n = normalizeItem(items[1], ngobox);
    expect(n.ok && prefilter(n.item, DEFAULT_SETTINGS, ngobox).candidate).toBe(false);
  });
  it("rejects an unrecognised layout instead of returning nothing silently", () => {
    expect(() => parseNgoboxListing("<html><body>maintenance</body></html>")).toThrow(/layout not recognised/);
  });
});

describe("deadline parsing", () => {
  it.each([
    ["19 Oct. 2026", "2026-10-19"],
    ["5th November 2026", "2026-11-05"],
    ["2026-12-01", "2026-12-01"],
    ["31-Dec-2026", "2026-12-31"],
  ])("%s → %s", (raw, iso) => expect(parseDeadline(raw)).toBe(iso));
  it("returns null for unparseable text", () => {
    expect(parseDeadline("ASAP")).toBeNull();
    expect(parseDeadline(null)).toBeNull();
  });
});

describe("open-call scoring rule", () => {
  const base: ScoringInput = {
    isRelevant: true, announcementType: "explicit_partner_request", partnerSignal: "explicit", sectors: ["skill_development"], otherSectors: [],
    geographies: ["Pune"], publishedAt: null, publishedAtProvenance: "unknown",
    sources: [{ credibility: 0.65, isOfficial: false, publisher: "NGOBox RFP/EOI board" }],
    claims: [{ kind: "fact", excerptVerified: true }], aiStatus: "done", fundingSignal: false,
  };
  it("an explicit call with a future source-stated deadline is current despite an unknown publication date", () => {
    const r = scoreOpportunity({ ...base, deadline: "2026-10-30" }, DEFAULT_SETTINGS, w);
    expect(r.freshness).toBe("open_call");
    expect(r.components.find((c) => c.key === "recency")!.points).toBe(15);
    expect(r.priority).toBe("high");
    expect(r.flags).toContain("date_unknown");
  });
  it("a passed deadline drops the call to background", () => {
    const r = scoreOpportunity({ ...base, deadline: "2026-10-05" }, DEFAULT_SETTINGS, w);
    expect(r.flags).toContain("deadline_passed");
    expect(r.priority).toBe("background");
  });
  it("a deadline does not make a non-explicit item current", () => {
    const r = scoreOpportunity({ ...base, announcementType: "new_initiative", partnerSignal: "none", deadline: "2026-10-30" }, DEFAULT_SETTINGS, w);
    expect(r.freshness).toBe("unknown");
    expect(r.priority).not.toBe("high");
  });
  it("without a deadline an undated explicit call stays capped below high", () => {
    const r = scoreOpportunity({ ...base, deadline: null }, DEFAULT_SETTINGS, w);
    expect(r.freshness).toBe("unknown");
    expect(r.priority).not.toBe("high");
  });
});

describe("GDELT polite retry", () => {
  const gdelt = REGISTRY.find((s) => s.id === "gdelt-csr-education")!;
  it("waits and retries exactly once after the rate-limit notice", async () => {
    let calls = 0;
    const waits: number[] = [];
    const fetchImpl = async () => {
      calls++;
      return new Response(calls === 1 ? "Please limit requests to one every 5 seconds" : '{"articles":[{"url":"https://x.example/a","title":"CSR skilling push","seendate":"20261011T054500Z"}]}');
    };
    const r = await fetchGdelt(gdelt, fetchImpl, async (ms) => { waits.push(ms); });
    expect(calls).toBe(2);
    expect(waits).toEqual([6000]);
    expect(r.items).toHaveLength(1);
    expect(isRateLimitNotice("ok")).toBe(false);
  });
  it("treats HTTP 429 the same way, and gives up after the single retry", async () => {
    let calls = 0;
    const fetchImpl = async () => { calls++; return new Response("", { status: 429 }); };
    await expect(fetchGdelt(gdelt, fetchImpl, async () => {})).rejects.toThrow(/429/);
    expect(calls).toBe(2);
  });
});

describe("bounded HTTP retry", () => {
  it("retries a network reset once, but not HTTP errors", async () => {
    const { boundedGet } = await import("@/lib/sources/http");
    let n = 0;
    const flaky = async () => { n++; if (n === 1) throw Object.assign(new Error("fetch failed"), { cause: { code: "ERR_HTTP2_STREAM_ERROR" } }); return new Response("<rss/>"); };
    expect(await boundedGet("https://x.example/feed", flaky, undefined, 1000, 1)).toBe("<rss/>");
    expect(n).toBe(2);
    let m = 0;
    await expect(boundedGet("https://x.example/feed", async () => { m++; return new Response("", { status: 403 }); }, undefined, 1000, 1)).rejects.toThrow(/403/);
    expect(m).toBe(1);
  });
});

describe("cloud vs local runner split", () => {
  it("Vercel runs skip local-only sources; the collector fetches only them", async () => {
    const { runsHere } = await import("@/lib/pipeline/ingest");
    const ids = (runner: "cloud" | "local" | "all") => REGISTRY.filter((s) => s.enabled || s.id === "fundsforngos").filter((s) => runsHere(s, runner)).map((s) => s.id);
    expect(ids("local").sort()).toEqual(["fundsforngos", "gdelt-csr-education", "ngobox-rfp"]);
    expect(ids("cloud")).not.toContain("ngobox-rfp");
    expect(ids("cloud")).toContain("indiacsr");
    expect(ids("all")).toEqual(expect.arrayContaining(["ngobox-rfp", "indiacsr"]));
  });
});

describe("deadline round-trip through the pipeline", () => {
  it("stores and reads back the exact source-stated date, and ranks the open call", async () => {
    const { createTestDb } = await import("./helpers/db");
    const { syncRegistry } = await import("@/lib/sources/registry");
    const { runRefresh } = await import("@/lib/pipeline/ingest");
    const { loadOpportunities } = await import("@/lib/repo/opportunities");
    const { fakeClassifier } = await import("./helpers/fixtures");
    const db = await createTestDb();
    await syncRegistry(db);
    const now = new Date("2026-10-12T00:30:00Z");
    const fetchImpl = async () => new Response(html, { status: 200 });
    const classify: typeof fakeClassifier = async (input, settings) => {
      const r = await fakeClassifier(input, settings);
      return { ...r, analysis: { ...r.analysis, company_name: "Fixture Foundation", announcement_type: "explicit_partner_request", implementation_partner_signal: { level: "explicit", evidence: "Call for NGO Implementation Partners" }, sectors: ["skill_development"], geographies: ["Pune"] } };
    };
    const r = await runRefresh(db, { trigger: "test", now, fetchImpl, classify, sourceIds: ["ngobox-rfp"], runner: "all" });
    expect(r.itemsNew).toBe(1);
    const row = (await db.query<{ deadline: unknown }>("select deadline from announcements"))[0];
    expect(row.deadline).toBe("2026-10-30");
    const [o] = await loadOpportunities(db, "live", DEFAULT_SETTINGS, reportingWindow(now, 7, "Asia/Kolkata"));
    expect(o.deadline).toBe("2026-10-30");
    expect(o.score.freshness).toBe("open_call");
    expect(o.publishedAt).toBeNull();
    await db.close();
  });
});

describe("database selection (dev vs prod)", () => {
  const saved = { ...process.env };
  afterEach(() => { process.env = { ...saved }; });
  it("local development uses DEV_DATABASE_URL; Vercel production uses DATABASE_URL", () => {
    process.env.DATABASE_URL = "postgres://u:p@prod-host.example/db";
    process.env.DEV_DATABASE_URL = "postgres://u:p@dev-host.example/db";
    delete process.env.VERCEL_ENV;
    expect(describeDatabaseUrl(resolveDatabaseUrl())).toBe("dev-host");
    process.env.VERCEL_ENV = "production";
    expect(describeDatabaseUrl(resolveDatabaseUrl())).toBe("prod-host");
    expect(describeDatabaseUrl(resolveDatabaseUrl({ target: "prod" }))).toBe("prod-host");
    delete process.env.DEV_DATABASE_URL;
    delete process.env.VERCEL_ENV;
    expect(describeDatabaseUrl(resolveDatabaseUrl())).toBe("prod-host");
  });
});

describe("deadline stated in the source text", () => {
  it("reads submission deadlines and ignores query dates", async () => {
    const { extractDeadline } = await import("@/lib/pipeline/normalize");
    expect(extractDeadline("Last Date for Queries: 24 September 2026 Last Date for Submission: 25 September 2026")).toBe("2026-09-25");
    expect(extractDeadline("Applications close on 16 October 2026.")).toBe("2026-10-16");
    expect(extractDeadline("The deadline for submission is May 22, 2026, at 23:59")).toBeNull(); // US-style month-first not parsed → no guess
    expect(extractDeadline("Apply by 28 August 2026")).toBe("2026-08-28");
    expect(extractDeadline("The company launched a programme for 2,000 youth.")).toBeNull();
  });
  it("expired partner calls are not stored; open ones are kept beyond 30 days", async () => {
    const { createTestDb } = await import("./helpers/db");
    const { syncRegistry, listSources } = await import("@/lib/sources/registry");
    const { ingestItems } = await import("@/lib/pipeline/ingest");
    const db = await createTestDb();
    await syncRegistry(db);
    const src = (await listSources(db)).find((s) => s.id === "ngoportal-csr")!;
    const now = new Date("2026-10-12T00:30:00Z");
    const mk = (title: string, date: string, body: string) => ({ url: `https://ngoportal.example/${encodeURIComponent(title)}`, title, publishedRaw: date, publishedProvenance: "feed_pubdate" as const, description: body, contentHtml: null, publisher: "NGOportal", categories: [] });
    const out = await ingestItems(db, src, [
      mk("Foundation RFP for NGO implementation partners in education", "Thu, 10 Sep 2026 12:00:00 +0000", "Education implementation partners in India. Last Date for Submission: 25 September 2026."),
      mk("Foundation invites NGO proposals for youth skilling in Pune", "Mon, 24 Aug 2026 12:00:00 +0000", "Youth skilling programme in Pune, India. Applications close on 30 October 2026."),
    ], DEFAULT_SETTINGS, null, now);
    expect(out.skipped.deadline_passed).toBe(1);
    expect(out.new).toBe(1); // 49 days old but still open → kept
    const row = (await db.query<{ deadline: string }>("select deadline from announcements"))[0];
    expect(row.deadline).toBe("2026-10-30");
    await db.close();
  });
});
