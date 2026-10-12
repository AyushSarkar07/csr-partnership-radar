import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setDb } from "@/lib/db/client";
import { seedDemoData } from "@/lib/seed";
import { syncRegistry } from "@/lib/sources/registry";
import * as cron from "@/app/api/cron/weekly-digest/route";
import * as digestGen from "@/app/api/digest/generate/route";
import * as opp from "@/app/api/opportunities/[id]/route";
import * as oppList from "@/app/api/opportunities/route";
import * as refresh from "@/app/api/refresh/route";
import * as reseed from "@/app/api/demo/reseed/route";
import * as settings from "@/app/api/settings/route";
import * as source from "@/app/api/sources/[id]/route";
import * as health from "@/app/api/health/route";
import { createTestDb } from "./helpers/db";

/**
 * Access model (no sign-in): anyone using the app can make changes, but
 *  - cross-origin mutation attempts are rejected (Test 16, CSRF),
 *  - the scheduled job requires CRON_SECRET,
 *  - request bodies are validated, and public endpoints expose no secrets.
 */
let db: Awaited<ReturnType<typeof createTestDb>>;
let oppId: string;
const H = "http://localhost:3000";
const ctx = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) }) as never;
const json = (method: string, path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(H + path, { method, headers: { "content-type": "application/json", host: "localhost:3000", ...headers }, body: JSON.stringify(body) });
const evil = { origin: "https://evil.example" };

beforeAll(async () => {
  process.env.CRON_SECRET = "cron-secret-0123456789";
  db = await createTestDb();
  setDb(db);
  await syncRegistry(db);
  await seedDemoData(db);
  oppId = (await db.query<{ id: string }>("select id from announcements where seed_id='SYN-004'"))[0].id;
});
afterAll(async () => { setDb(null); await db.close(); });

describe("cross-origin mutations are rejected (Test 16)", () => {
  const cases: Array<[string, () => Promise<Response>]> = [
    ["POST /api/refresh", () => refresh.POST(json("POST", "/api/refresh", {}, evil))],
    ["POST /api/digest/generate", () => digestGen.POST(json("POST", "/api/digest/generate", { mode: "demo" }, evil))],
    ["PUT /api/settings", () => settings.PUT(json("PUT", "/api/settings", {}, evil))],
    ["PATCH /api/opportunities/:id", () => opp.PATCH(json("PATCH", `/api/opportunities/${oppId}`, { status: "monitor" }, evil), ctx({ id: oppId }))],
    ["PATCH /api/sources/:id", () => source.PATCH(json("PATCH", "/api/sources/indiacsr", { enabled: false }, evil), ctx({ id: "indiacsr" }))],
    ["POST /api/demo/reseed", () => reseed.POST(json("POST", "/api/demo/reseed", {}, evil))],
  ];
  for (const [name, call] of cases) {
    it(`${name} from another site → 403`, async () => expect((await call()).status).toBe(403));
  }
  it("no state changed after rejected calls", async () => {
    expect((await db.query<{ n: number }>("select count(*)::int n from opportunity_reviews where actor='ananya'"))[0].n).toBe(0);
    expect((await db.query<{ n: number }>("select count(*)::int n from user_settings"))[0].n).toBe(0);
  });
});

describe("scheduled job stays protected", () => {
  it("cron without / with wrong bearer → 401", async () => {
    expect((await cron.GET(new Request(H + "/api/cron/weekly-digest"))).status).toBe(401);
    expect((await cron.GET(new Request(H + "/api/cron/weekly-digest", { headers: { authorization: "Bearer wrong" } }))).status).toBe(401);
  });
  it("cron is refused entirely when CRON_SECRET is unset", async () => {
    const saved = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;
    expect((await cron.GET(new Request(H + "/api/cron/weekly-digest", { headers: { authorization: "Bearer " } }))).status).toBe(401);
    process.env.CRON_SECRET = saved;
  });
});

describe("same-origin writes work without sign-in", () => {
  const same = { origin: H };
  it("records a review and returns its note to any reader", async () => {
    const res = await opp.PATCH(json("PATCH", `/api/opportunities/${oppId}`, { status: "contact_this_week", note: "call Monday" }, same), ctx({ id: oppId }));
    expect(res.status).toBe(200);
    const got = await (await opp.GET(new Request(H + `/api/opportunities/${oppId}`), ctx({ id: oppId }))).json();
    expect(got.opportunity.review.status).toBe("contact_this_week");
    expect(got.history[0].note).toBe("call Monday");
  });
  it("validates request bodies", async () => {
    expect((await opp.PATCH(json("PATCH", `/api/opportunities/${oppId}`, { status: "maybe" }, same), ctx({ id: oppId }))).status).toBe(400);
    expect((await settings.PUT(json("PUT", "/api/settings", { weights: {} }, same))).status).toBe(400);
    const notJson = new Request(H + "/api/settings", { method: "PUT", headers: { "content-type": "text/plain", host: "localhost:3000" }, body: "x" });
    expect((await settings.PUT(notJson)).status).toBe(400);
  });
  it("expensive operations have a cooldown", async () => {
    const first = await digestGen.POST(json("POST", "/api/digest/generate", { mode: "demo" }, same));
    expect(first.status).toBe(200);
    const second = await digestGen.POST(json("POST", "/api/digest/generate", { mode: "demo" }, same));
    expect(second.status).toBe(429);
  });
  it("public endpoints expose no secrets", async () => {
    const body = await (await health.GET()).text();
    expect(body).not.toContain("cron-secret-0123456789");
    expect((await oppList.GET(new Request(H + "/api/opportunities?mode=demo"))).status).toBe(200);
  });
});
