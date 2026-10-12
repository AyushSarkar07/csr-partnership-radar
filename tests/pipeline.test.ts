import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GeminiError } from "@/lib/ai/gemini";
import { runRefresh, type Classifier } from "@/lib/pipeline/ingest";
import { addReview, loadOpportunities } from "@/lib/repo/opportunities";
import { DEFAULT_SETTINGS } from "@/lib/settings/schema";
import { syncRegistry } from "@/lib/sources/registry";
import { reportingWindow } from "@/lib/time/window";
import { createTestDb } from "./helpers/db";
import { FIXTURE_SOURCES, NOW, fakeClassifier, fixtureFetch } from "./helpers/fixtures";

let db: Awaited<ReturnType<typeof createTestDb>>;
const w = reportingWindow(NOW, 7, "Asia/Kolkata");
const live = () => loadOpportunities(db, "live", DEFAULT_SETTINGS, w);
const find = async (s: string) => (await live()).find((o) => o.headline.toLowerCase().includes(s.toLowerCase()));

beforeAll(async () => {
  db = await createTestDb();
  await syncRegistry(db);
});
afterAll(async () => db.close());

describe("live pipeline with deterministic fixtures", () => {
  it("runs end to end, isolating a failing source (Test 10)", async () => {
    const r = await runRefresh(db, { trigger: "test", now: NOW, fetchImpl: fixtureFetch(), classify: fakeClassifier, sourceIds: FIXTURE_SOURCES });
    expect(r.status).toBe("partial");
    const et = r.sources.find((s) => s.sourceId === "et-corporate-trends")!;
    expect(et.ok).toBe(false);
    expect(et.error).toMatch(/403/);
    const a = r.sources.find((s) => s.sourceId === "indiacsr")!;
    expect(a.skipped.duplicate_in_feed).toBe(1);
    expect(a.skipped.older_than_lookback).toBe(1);
    expect(a.skipped.no_csr_term).toBe(1);
    const src = (await db.query<{ last_error: string | null }>("select last_error from sources where id='et-corporate-trends'"))[0];
    expect(src.last_error).toMatch(/403/);
  });

  it("fresh digital-skilling announcement is classified and ranked (Test 1)", async () => {
    const o = (await find("Fixture Infotech launches"))!;
    expect(o.aiStatus).toBe("done");
    expect(o.sectors).toContain("digital_literacy");
    expect(o.score.freshness).toBe("fresh");
    expect(o.score.total).toBeGreaterThan(60);
  });

  it("explicit partner request is classified as such (Test 2)", async () => {
    const o = (await find("invites NGOs"))!;
    expect(o.announcementType).toBe("explicit_partner_request");
    expect(o.partnerSignal).toBe("explicit");
    expect(o.score.priority).toBe("high");
  });

  it("generic CSR statement is not a partner request (Test 3)", async () => {
    const o = (await find("Fixture Bank"))!;
    expect(o.partnerSignal).not.toBe("explicit");
    expect(o.score.priority).not.toBe("high");
  });

  it("duplicate coverage merges into one opportunity with two sources (Test 7)", async () => {
    const opps = await live();
    const infotech = opps.filter((o) => o.company === "Fixture Infotech Ltd" && o.sectors.includes("digital_literacy"));
    expect(infotech).toHaveLength(1);
    expect(infotech[0].coverage).toHaveLength(2);
    const trees = opps.filter((o) => o.headline.includes("trees"));
    expect(trees).toHaveLength(1); // same company, different announcement: NOT merged
  });

  it("missing date is stored as unknown, never fabricated (Test 8)", async () => {
    const o = (await find("Fixture Cement"))!;
    expect(o.publishedAt).toBeNull();
    expect(o.publishedAtProvenance).toBe("unknown");
    expect(o.score.freshness).toBe("unknown");
    expect(o.coverage[0].retrieved_at).toBeTruthy();
  });

  it("stale item within lookback is stored but not fresh (Test 6)", async () => {
    const o = (await find("Fixture Foods"))!;
    expect(o.score.freshness).toBe("stale");
    expect(o.score.priority).toBe("background");
  });

  it("prompt-injection content is processed as data and flagged", async () => {
    const o = (await find("Fixture Telecom"))!;
    expect(o.analysis?.injection_detected).toBe(true);
    expect(o.score.priority).not.toBe("high");
  });

  it("re-running is idempotent and preserves human reviews (Test 14)", async () => {
    const o = (await find("invites NGOs"))!;
    await addReview(db, o.id, "contact_this_week", "Call Monday", "test");
    const before = (await db.query<{ n: number }>("select count(*)::int n from announcements"))[0].n;
    const r = await runRefresh(db, { trigger: "test", now: new Date(NOW.getTime() + 3600_000), fetchImpl: fixtureFetch(), classify: fakeClassifier, sourceIds: FIXTURE_SOURCES });
    expect(r.itemsNew).toBe(0);
    expect((await db.query<{ n: number }>("select count(*)::int n from announcements"))[0].n).toBe(before);
    const again = (await find("invites NGOs"))!;
    expect(again.review?.status).toBe("contact_this_week");
    expect(again.review?.note).toBe("Call Monday");
  });

  it("a feed outage does not erase existing data (Test 10)", async () => {
    const before = (await live()).length;
    const r = await runRefresh(db, { trigger: "test", now: NOW, fetchImpl: fixtureFetch({ failA: true }), classify: fakeClassifier, sourceIds: ["indiacsr"] });
    expect(r.status).toBe("failed");
    expect((await live()).length).toBe(before);
  });

  it("scheduled runs with the same run key execute once", async () => {
    const opts = { trigger: "cron" as const, runKey: "weekly:2026-10-12", now: NOW, fetchImpl: fixtureFetch(), classify: fakeClassifier, sourceIds: FIXTURE_SOURCES };
    const first = await runRefresh(db, opts);
    const second = await runRefresh(db, opts);
    expect(first.skipped).toBeUndefined();
    expect(second.skipped).toBe("already_ran");
    expect((await db.query<{ n: number }>("select count(*)::int n from fetch_runs where run_key='weekly:2026-10-12'"))[0].n).toBe(1);
  });
});

describe("Gemini failure handling inside the pipeline (Test 11)", () => {
  it("missing key keeps items pending without burning attempts; timeouts mark failed", async () => {
    const db2 = await createTestDb();
    await syncRegistry(db2);
    const missing: Classifier = async () => { throw new GeminiError("missing_key", "no key"); };
    const r = await runRefresh(db2, { trigger: "test", now: NOW, fetchImpl: fixtureFetch(), classify: missing, sourceIds: ["indiacsr"] });
    expect(r.classified).toBe(0);
    expect(r.aiNote).toMatch(/queued/);
    const pending = await db2.query<{ ai_status: string; ai_attempts: number }>("select ai_status, ai_attempts from announcements");
    expect(pending.every((p) => p.ai_status === "pending" && p.ai_attempts === 0)).toBe(true);
    // Dashboard still loads unclassified items.
    const opps = await loadOpportunities(db2, "live", DEFAULT_SETTINGS, w);
    expect(opps.length).toBeGreaterThan(0);
    expect(opps[0].nextAction).toMatch(/Analysis pending/);

    const timeout: Classifier = async () => { throw new GeminiError("timeout", "slow"); };
    const r2 = await runRefresh(db2, { trigger: "test", now: NOW, fetchImpl: fixtureFetch(), classify: timeout, sourceIds: ["indiacsr"] });
    expect(r2.aiFailed).toBeGreaterThan(0);
    const failed = await db2.query<{ ai_status: string; ai_error: string }>("select ai_status, ai_error from announcements where ai_status='failed'");
    expect(failed[0].ai_error).toMatch(/timeout/);
    await db2.close();
  });
});
