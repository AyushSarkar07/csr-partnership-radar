import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEMO_REFERENCE_TIME } from "@/lib/demo";
import { loadOpportunities, type Opportunity } from "@/lib/repo/opportunities";
import { SEED_RECORDS, seedDemoData } from "@/lib/seed";
import { DEFAULT_SETTINGS } from "@/lib/settings/schema";
import { reportingWindow } from "@/lib/time/window";
import { createTestDb } from "./helpers/db";

let db: Awaited<ReturnType<typeof createTestDb>>;
let opps: Opportunity[];
const window = reportingWindow(DEMO_REFERENCE_TIME, 7, "Asia/Kolkata");

beforeAll(async () => {
  db = await createTestDb();
  const r = await seedDemoData(db);
  expect(r.inserted).toBe(SEED_RECORDS.length);
  opps = await loadOpportunities(db, "synthetic", DEFAULT_SETTINGS, window);
});
afterAll(async () => db.close());

const bySeed = (id: string) => opps.find((o) => o.seedId === id);

describe("seed dataset integrity", () => {
  it("has 24–36 records covering all 16 required scenarios", () => {
    expect(SEED_RECORDS.length).toBeGreaterThanOrEqual(24);
    expect(SEED_RECORDS.length).toBeLessThanOrEqual(36);
    const covered = new Set(SEED_RECORDS.flatMap((r) => r.scenario.ids));
    for (let i = 1; i <= 16; i++) expect(covered.has(i), `scenario ${i}`).toBe(true);
  });

  it("uses only reserved example.org URLs and stable unique ids", () => {
    const ids = new Set<string>();
    for (const r of SEED_RECORDS) {
      expect(r.source.url.startsWith("https://example.org/synthetic/")).toBe(true);
      expect(r.source.publisher).toMatch(/\(demo\)/i);
      expect(ids.has(r.seed_id)).toBe(false);
      ids.add(r.seed_id);
    }
  });

  it("every stored synthetic row is labelled synthetic", async () => {
    const rows = await db.query<{ n: number }>("select count(*)::int as n from announcements where data_origin <> 'synthetic' or verification_status <> 'synthetic'");
    expect(rows[0].n).toBe(0);
  });

  it("seeding is idempotent", async () => {
    const again = await seedDemoData(db);
    expect(again.inserted).toBe(0);
  });
});

describe("expected ranking behaviour (default settings, demo reference time)", () => {
  for (const r of SEED_RECORDS) {
    const exp = r.scenario.expected as { ranking: string; category?: string; geo_relevance?: string; evidence_strength?: string };
    if (exp.ranking === "merged") continue;
    it(`${r.seed_id} → ${exp.ranking}`, () => {
      const o = bySeed(r.seed_id)!;
      expect(o, `${r.seed_id} present`).toBeTruthy();
      expect(o.score.priority, `${r.seed_id} total=${o.score.total} flags=${o.score.flags.join(",")}`).toBe(exp.ranking);
      if (exp.evidence_strength) expect(o.score.evidenceStrength).toBe(exp.evidence_strength);
      if (exp.geo_relevance && exp.geo_relevance !== "unknown") expect(o.score.geoFit).toBe(exp.geo_relevance);
    });
  }
});

describe("deduplication on seed data (Test 7)", () => {
  it("merges SYN-010 into SYN-009 with two supporting sources", () => {
    expect(bySeed("SYN-010")).toBeUndefined();
    const primary = bySeed("SYN-009")!;
    expect(primary.coverage).toHaveLength(2);
    expect(new Set(primary.coverage.map((c) => c.publisher)).size).toBe(2);
  });
  it("does not merge a different announcement from the same company (SYN-028 vs SYN-001)", () => {
    expect(bySeed("SYN-001")).toBeTruthy();
    expect(bySeed("SYN-028")).toBeTruthy();
    expect(bySeed("SYN-001")!.coverage).toHaveLength(1);
  });
});

describe("dashboard search and hidden-item explanation", () => {
  it("free-text search matches company, headline and place", async () => {
    const { applyFilters, parseFilters, explainHidden } = await import("@/lib/repo/filters");
    const f = parseFilters({ mode: "demo", q: "orchid nashik" }, { mode: "demo", days: 7 });
    const r = applyFilters(opps, f);
    expect(r.map((o) => o.seedId)).toEqual(["SYN-004"]);
    const all = parseFilters({ mode: "demo" }, { mode: "demo", days: 7 });
    const h = explainHidden(opps, all);
    expect(h.shown + h.lowHidden + h.olderHidden).toBe(opps.length);
    expect(h.lowHidden).toBeGreaterThan(0);
    expect(h.olderHidden).toBeGreaterThan(0);
  });
});

describe("calls closing soon (demo)", () => {
  it("SYN-031 carries its deadline and counts as closing within 7 days", async () => {
    const o = bySeed("SYN-031")!;
    expect(o.deadline).toBe("2026-10-16");
    const { getDashboard } = await import("@/lib/queries");
    const { parseFilters } = await import("@/lib/repo/filters");
    const d = await getDashboard(db, parseFilters({ mode: "demo" }, { mode: "demo", days: 7 }));
    expect(d.metrics.closingSoon).toBe(1); // Orchid (7 Nov) and Ember (15 Nov) are further out
  });
});
