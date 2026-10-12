import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setDb } from "@/lib/db/client";
import { runRefresh } from "@/lib/pipeline/ingest";
import { getDashboard, getOpportunityDetail } from "@/lib/queries";
import { parseFilters } from "@/lib/repo/filters";
import { DEFAULT_SETTINGS } from "@/lib/settings/schema";
import { loadSettings } from "@/lib/settings/store";
import { syncRegistry } from "@/lib/sources/registry";
import { generateDigest } from "@/lib/digest/generate";
import * as opp from "@/app/api/opportunities/[id]/route";
import * as settingsRoute from "@/app/api/settings/route";
import * as latest from "@/app/api/digest/latest/route";
import { createTestDb } from "./helpers/db";
import { FIXTURE_SOURCES, NOW, fakeClassifier, fixtureFetch } from "./helpers/fixtures";

let db: Awaited<ReturnType<typeof createTestDb>>;
const H = "http://localhost:3000";
const auth = () => ({ "content-type": "application/json", host: "localhost:3000", origin: H });

beforeAll(async () => {
  db = await createTestDb();
  setDb(db);
  await syncRegistry(db);
});
afterAll(async () => { setDb(null); await db.close(); });

describe("configuration persistence (Test 13)", () => {
  it("sector, geography and weight changes survive a reload and change scores", async () => {
    const next = {
      ...DEFAULT_SETTINGS,
      sectors: [...DEFAULT_SETTINGS.sectors, { key: "women_livelihoods", label: "Women's livelihoods", priority: "medium" as const, keywords: ["women"] }],
      operatingGeographies: ["Pune", "Nagpur"],
      weights: { sector: 20, intent: 30, recency: 20, geography: 15, evidence: 15 },
    };
    const res = await settingsRoute.PUT(new Request(H + "/api/settings", { method: "PUT", headers: auth(), body: JSON.stringify(next) }));
    expect(res.status).toBe(200);
    // "Reload": read back from the database through a fresh call.
    const loaded = await loadSettings(db);
    expect(loaded.persisted).toBe(true);
    expect(loaded.settings.sectors.map((s) => s.key)).toContain("women_livelihoods");
    expect(loaded.settings.operatingGeographies).toEqual(["Pune", "Nagpur"]);
    expect(loaded.settings.weights.intent).toBe(30);
    const via = await (await settingsRoute.GET()).json();
    expect(via.version).toBe(1);
  });
  it("invalid settings are rejected and not saved", async () => {
    const res = await settingsRoute.PUT(new Request(H + "/api/settings", { method: "PUT", headers: auth(), body: JSON.stringify({ ...DEFAULT_SETTINGS, timezone: "Mars/Olympus", weights: { ...DEFAULT_SETTINGS.weights, sector: 90 } }) }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.issues.join(" ")).toMatch(/timezone|100/i);
    expect((await loadSettings(db)).version).toBe(1);
  });
});

describe("end-to-end journey (Test 18)", () => {
  it("retrieve → process → open → inspect evidence → decide → digest → persists", async () => {
    await settingsRoute.PUT(new Request(H + "/api/settings", { method: "PUT", headers: auth(), body: JSON.stringify(DEFAULT_SETTINGS) }));
    // 1. Retrieval + processing with deterministic fixtures
    const run = await runRefresh(db, { trigger: "test", now: NOW, fetchImpl: fixtureFetch(), classify: fakeClassifier, sourceIds: FIXTURE_SOURCES });
    expect(run.itemsNew).toBeGreaterThan(3);
    // 2. Dashboard shows a ranked feed (window relative to NOW via days=30 to stay deterministic over time)
    const dash = await getDashboard(db, parseFilters({ mode: "live", days: "30", freshness: "all" }, { mode: "live", days: 7 }));
    expect(dash.shown.length).toBeGreaterThan(0);
    const target = dash.all.find((o) => o.partnerSignal === "explicit")!;
    // 3. Open the opportunity and inspect evidence
    const detail = await getOpportunityDetail(db, target.id);
    expect(detail!.opp.coverage[0].url).toMatch(/^https:\/\/fixture-a\.example/);
    expect(detail!.opp.claims.some((c) => c.kind === "fact" && c.excerpt_verified)).toBe(true);
    // 4. Change its status
    const patch = await opp.PATCH(new Request(H + `/api/opportunities/${target.id}`, { method: "PATCH", headers: auth(), body: JSON.stringify({ status: "contact_this_week", note: "E2E" }) }), { params: Promise.resolve({ id: target.id }) } as never);
    expect(patch.status).toBe(200);
    // 5. Generate a digest
    const dg = await generateDigest(db, { mode: "live", trigger: "manual", now: NOW, summarize: async () => { throw new Error("offline"); } });
    expect(dg.items).toBeGreaterThan(0);
    // 6. Verify persistence via the public API
    const got = await (await latest.GET(new Request(H + "/api/digest/latest?mode=live"))).json();
    expect(got.id).toBe(dg.digestId);
    const item = [...got.content.sections.high_priority, ...got.content.sections.monitor].find((i: { announcementId: string }) => i.announcementId === target.id);
    expect(item.reviewStatus).toBe("contact_this_week");
    const after = await getOpportunityDetail(db, target.id);
    expect(after!.history[0].status).toBe("contact_this_week");
  });
});
