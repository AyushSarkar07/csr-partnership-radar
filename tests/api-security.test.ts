import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setDb } from "@/lib/db/client";
import { createSessionToken, SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { seedDemoData } from "@/lib/seed";
import { syncRegistry } from "@/lib/sources/registry";
import * as cron from "@/app/api/cron/weekly-digest/route";
import * as digestGen from "@/app/api/digest/generate/route";
import * as login from "@/app/api/auth/login/route";
import * as opp from "@/app/api/opportunities/[id]/route";
import * as oppList from "@/app/api/opportunities/route";
import * as refresh from "@/app/api/refresh/route";
import * as reseed from "@/app/api/demo/reseed/route";
import * as settings from "@/app/api/settings/route";
import * as source from "@/app/api/sources/[id]/route";
import * as health from "@/app/api/health/route";
import { createTestDb } from "./helpers/db";

let db: Awaited<ReturnType<typeof createTestDb>>;
let oppId: string;
const H = "http://localhost:3000";
const ctx = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) }) as never;
const json = (method: string, path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(H + path, { method, headers: { "content-type": "application/json", host: "localhost:3000", ...headers }, body: JSON.stringify(body) });

beforeAll(async () => {
  process.env.ACCESS_CODE = "test-access-code";
  process.env.SESSION_SECRET = "0123456789abcdef0123456789abcdef";
  process.env.CRON_SECRET = "cron-secret-0123456789";
  db = await createTestDb();
  setDb(db);
  await syncRegistry(db);
  await seedDemoData(db);
  oppId = (await db.query<{ id: string }>("select id from announcements where seed_id='SYN-004'"))[0].id;
});
afterAll(async () => { setDb(null); await db.close(); });

describe("privileged endpoints reject missing/invalid authorisation (Test 16)", () => {
  const forged = `${SESSION_COOKIE}=v1.9999999999999.forged`;
  const cases: Array<[string, () => Promise<Response>]> = [
    ["POST /api/refresh", () => refresh.POST(json("POST", "/api/refresh", {}))],
    ["POST /api/digest/generate", () => digestGen.POST(json("POST", "/api/digest/generate", { mode: "demo" }))],
    ["PUT /api/settings", () => settings.PUT(json("PUT", "/api/settings", {}))],
    ["PATCH /api/opportunities/:id", () => opp.PATCH(json("PATCH", `/api/opportunities/${oppId}`, { status: "monitor" }), ctx({ id: oppId }))],
    ["PATCH /api/sources/:id", () => source.PATCH(json("PATCH", "/api/sources/indiacsr", { enabled: false }), ctx({ id: "indiacsr" }))],
    ["POST /api/demo/reseed", () => reseed.POST(json("POST", "/api/demo/reseed", {}))],
    ["PATCH with forged cookie", () => opp.PATCH(json("PATCH", `/api/opportunities/${oppId}`, { status: "monitor" }, { cookie: forged }), ctx({ id: oppId }))],
  ];
  for (const [name, call] of cases) {
    it(`${name} → 401`, async () => expect((await call()).status).toBe(401));
  }
  it("cron without / with wrong bearer → 401", async () => {
    expect((await cron.GET(new Request(H + "/api/cron/weekly-digest"))).status).toBe(401);
    expect((await cron.GET(new Request(H + "/api/cron/weekly-digest", { headers: { authorization: "Bearer wrong" } }))).status).toBe(401);
  });
  it("cross-origin writes are rejected even with a valid session", async () => {
    const res = await opp.PATCH(json("PATCH", `/api/opportunities/${oppId}`, { status: "monitor" }, { cookie: `${SESSION_COOKIE}=${createSessionToken()}`, origin: "https://evil.example" }), ctx({ id: oppId }));
    expect(res.status).toBe(403);
  });
  it("writes fail closed when auth is not configured", async () => {
    const saved = process.env.ACCESS_CODE;
    delete process.env.ACCESS_CODE;
    expect((await refresh.POST(json("POST", "/api/refresh", {}, { cookie: `${SESSION_COOKIE}=${createSessionToken()}` }))).status).toBe(503);
    process.env.ACCESS_CODE = saved;
  });
  it("no state changed after rejected calls", async () => {
    expect((await db.query<{ n: number }>("select count(*)::int n from opportunity_reviews where actor='ananya'"))[0].n).toBe(0);
    expect((await db.query<{ n: number }>("select count(*)::int n from user_settings"))[0].n).toBe(0);
  });
});

describe("sign-in and authorised writes", () => {
  it("wrong code → 401; right code → signed HttpOnly cookie", async () => {
    expect((await login.POST(json("POST", "/api/auth/login", { code: "nope" }))).status).toBe(401);
    const ok = await login.POST(json("POST", "/api/auth/login", { code: "test-access-code" }));
    expect(ok.status).toBe(200);
    const cookie = ok.headers.get("set-cookie")!;
    expect(cookie).toMatch(/HttpOnly/);
    expect(verifySessionToken(cookie.split(";")[0].split("=")[1])).toBe(true);
  });
  it("validates request bodies", async () => {
    const c = { cookie: `${SESSION_COOKIE}=${createSessionToken()}` };
    expect((await opp.PATCH(json("PATCH", `/api/opportunities/${oppId}`, { status: "maybe" }, c), ctx({ id: oppId }))).status).toBe(400);
    expect((await settings.PUT(json("PUT", "/api/settings", { weights: {} }, c))).status).toBe(400);
    const notJson = new Request(H + "/api/settings", { method: "PUT", headers: { "content-type": "text/plain", host: "localhost:3000", ...c }, body: "x" });
    expect((await settings.PUT(notJson)).status).toBe(400);
  });
  it("private notes are hidden from anonymous readers", async () => {
    const c = { cookie: `${SESSION_COOKIE}=${createSessionToken()}` };
    await opp.PATCH(json("PATCH", `/api/opportunities/${oppId}`, { status: "monitor", note: "secret note" }, c), ctx({ id: oppId }));
    const anon = await (await opp.GET(new Request(H + `/api/opportunities/${oppId}`), ctx({ id: oppId }))).json();
    expect(JSON.stringify(anon)).not.toContain("secret note");
    const authed = await (await opp.GET(new Request(H + `/api/opportunities/${oppId}`, { headers: c }), ctx({ id: oppId }))).json();
    expect(authed.opportunity.review.note).toBe("secret note");
  });
  it("public endpoints expose no secrets", async () => {
    const body = await (await health.GET()).text();
    for (const s of ["test-access-code", "0123456789abcdef0123456789abcdef", "cron-secret-0123456789"]) expect(body).not.toContain(s);
    const list = await oppList.GET(new Request(H + "/api/opportunities?mode=demo"));
    expect(list.status).toBe(200);
  });
});
