import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { allItems, type DigestContent, type DigestItemPayload } from "@/lib/digest/build";
import { generateDigest, type Summarizer } from "@/lib/digest/generate";
import { renderDigestEmail } from "@/lib/delivery/email";
import { runRefresh } from "@/lib/pipeline/ingest";
import { getDashboard } from "@/lib/queries";
import { parseFilters } from "@/lib/repo/filters";
import { seedDemoData } from "@/lib/seed";
import { syncRegistry } from "@/lib/sources/registry";
import { createTestDb } from "./helpers/db";
import { FIXTURE_SOURCES, NOW, fakeClassifier, fixtureFetch } from "./helpers/fixtures";

let db: Awaited<ReturnType<typeof createTestDb>>;
const failingSummarizer: Summarizer = async () => { throw new Error("Gemini unavailable"); };
const okSummarizer: Summarizer = async (c) => ({ model: "fake", summary: { overview: "Fixture overview of this week.", top_actions: [{ item_id: allItems(c)[0]?.announcementId ?? "x", action: "Call" }, { item_id: "not-a-real-id", action: "Hallucinated" }], caveats: "" } });

beforeAll(async () => {
  db = await createTestDb();
  await syncRegistry(db);
  await seedDemoData(db);
  await runRefresh(db, { trigger: "test", now: NOW, fetchImpl: fixtureFetch(), classify: fakeClassifier, sourceIds: FIXTURE_SOURCES });
});
afterAll(async () => db.close());

describe("digest generation (PDF-6, BR-18)", () => {
  it("demo digest has the expected sections and excludes closed/not-relevant items", async () => {
    const r = await generateDigest(db, { mode: "demo", trigger: "test", summarize: okSummarizer });
    const d = (await db.query<{ content: DigestContent; delivery_status: string }>("select content, delivery_status from digests where id=$1", [r.digestId]))[0];
    const hp = d.content.sections.high_priority.map((i: DigestItemPayload) => i.headline);
    expect(hp[0]).toMatch(/Orchid Pharma/); // explicit call ranks first
    expect(hp.some((h: string) => /Maple Electricals/.test(h))).toBe(false); // won/closed excluded
    expect(d.content.sections.monitor.some((i: DigestItemPayload) => /Opal/.test(i.headline))).toBe(false); // not relevant excluded
    expect(d.content.sections.policy.length).toBe(2);
    expect(d.content.sections.background.length).toBeGreaterThan(0);
    expect(d.delivery_status).toBe("not_attempted"); // demo is never emailed
    for (const i of allItems(d.content)) {
      expect(i.dataOrigin).toBe("synthetic");
      expect(i.sources.length).toBeGreaterThan(0);
      expect(i.nextAction).toBeTruthy();
      expect(i.scoreBreakdown).toHaveLength(5);
    }
  });

  it("drops AI top-actions that reference unknown items", async () => {
    const r = await generateDigest(db, { mode: "demo", trigger: "test", summarize: okSummarizer });
    const s = JSON.parse((await db.query<{ summary: string }>("select summary from digests where id=$1", [r.digestId]))[0].summary);
    expect(s.top_actions.map((a: { item_id: string }) => a.item_id)).not.toContain("not-a-real-id");
  });

  it("falls back to a deterministic summary when Gemini fails, and says so", async () => {
    const r = await generateDigest(db, { mode: "demo", trigger: "test", summarize: failingSummarizer });
    expect(r.summarySource).toBe("deterministic_fallback");
    expect(r.aiError).toMatch(/unavailable/);
  });
});

describe("seed-data separation (Test 12)", () => {
  it("live digest and live metrics never include synthetic records", async () => {
    const r = await generateDigest(db, { mode: "live", trigger: "test", now: NOW, summarize: okSummarizer });
    const items = await db.query<{ data_origin: string }>("select a.data_origin from digest_items di join announcements a on a.id = di.announcement_id where di.digest_id=$1", [r.digestId]);
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.data_origin === "live")).toBe(true);
    const d = await getDashboard(db, parseFilters({ mode: "live" }, { mode: "live", days: 7 }));
    expect(d.all.every((o) => o.dataOrigin === "live")).toBe(true);
    const demo = await getDashboard(db, parseFilters({ mode: "demo" }, { mode: "live", days: 7 }));
    expect(demo.all.every((o) => o.dataOrigin === "synthetic" && o.verificationStatus === "synthetic")).toBe(true);
  });
});

describe("digest idempotency (Test 15)", () => {
  it("re-running for the same window updates one digest and never duplicates items or emails", async () => {
    const sent: string[] = [];
    const send = async (_to: string, _e: unknown, key: string) => { sent.push(key); return `msg-${sent.length}`; };
    const a = await generateDigest(db, { mode: "live", trigger: "cron", now: NOW, summarize: okSummarizer, send });
    const b = await generateDigest(db, { mode: "live", trigger: "cron", now: new Date(NOW.getTime() + 60_000), summarize: okSummarizer, send });
    expect(b.digestId).toBe(a.digestId);
    expect(b.generation).toBeGreaterThan(a.generation);
    const dup = await db.query<{ n: number }>("select count(*)::int n from (select announcement_id from digest_items where digest_id=$1 group by announcement_id having count(*) > 1) x", [a.digestId]);
    expect(dup[0].n).toBe(0);
    expect((await db.query<{ n: number }>("select count(*)::int n from digests where digest_key like 'live:%'"))[0].n).toBe(1);
    expect(sent).toHaveLength(1);
    expect(b.delivery.status).toBe("sent");
    expect(b.delivery.detail).toMatch(/not re-sent/);
  });

  it("without an email provider the status is 'not_configured', never 'sent'", async () => {
    await db.query("delete from digests where data_mode='live'");
    const r = await generateDigest(db, { mode: "live", trigger: "manual", now: NOW, summarize: okSummarizer });
    expect(r.delivery.status).toBe("not_configured");
    const row = (await db.query<{ delivery_status: string; delivered_at: string | null }>("select delivery_status, delivered_at from digests where id=$1", [r.digestId]))[0];
    expect(row.delivery_status).toBe("not_configured");
    expect(row.delivered_at).toBeNull();
  });
});

describe("email template", () => {
  it("escapes untrusted text and only links http(s) URLs", async () => {
    const r = await generateDigest(db, { mode: "demo", trigger: "test", summarize: okSummarizer });
    const content = (await db.query<{ content: DigestContent }>("select content from digests where id=$1", [r.digestId]))[0].content;
    content.sections.high_priority[0].headline = "<script>alert(1)</script>";
    content.sections.high_priority[0].sources[0].url = "javascript:alert(1)";
    const e = renderDigestEmail(content, "Summary & <b>", r.digestId);
    expect(e.html).not.toContain("<script>");
    expect(e.html).not.toContain("javascript:");
    expect(e.html).toContain("&lt;b&gt;");
  });
});
