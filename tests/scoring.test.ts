import { describe, expect, it } from "vitest";
import { geographicFit } from "@/lib/geo";
import { scoreOpportunity, type ScoringInput } from "@/lib/scoring/score";
import { DEFAULT_SETTINGS, settingsSchema } from "@/lib/settings/schema";
import { reportingWindow } from "@/lib/time/window";

const w = reportingWindow(new Date("2026-10-12T00:30:00Z"), 7, "Asia/Kolkata");
const base: ScoringInput = {
  isRelevant: true, announcementType: "new_initiative", partnerSignal: "none", sectors: ["skill_development"], otherSectors: [],
  geographies: ["Pune"], publishedAt: new Date("2026-10-11T06:00:00Z"), publishedAtProvenance: "feed_pubdate",
  sources: [{ credibility: 0.95, isOfficial: true, publisher: "Co newsroom" }],
  claims: [{ kind: "fact", excerptVerified: true }], aiStatus: "done", fundingSignal: false,
};
const score = (o: Partial<ScoringInput>, s = DEFAULT_SETTINGS) => scoreOpportunity({ ...base, ...o }, s, w);

describe("scoring engine (BR-11)", () => {
  it("is deterministic and sums components to the total", () => {
    const a = score({});
    const b = score({});
    expect(a).toEqual(b);
    const sum = a.components.reduce((s, c) => s + c.points, 0);
    expect(Math.abs(a.total - sum)).toBeLessThanOrEqual(0.5);
    expect(a.components.map((c) => c.max)).toEqual([25, 25, 20, 15, 15]);
  });
  it("fresh relevant official initiative in Pune is high priority (Test 1)", () => {
    expect(score({}).priority).toBe("high");
  });
  it("explicit partner request outranks a generic CSR statement (Tests 2 & 3)", () => {
    const explicit = score({ announcementType: "explicit_partner_request", partnerSignal: "explicit" });
    const generic = score({ announcementType: "general_csr" });
    expect(explicit.total).toBeGreaterThan(generic.total);
    expect(generic.priority).not.toBe("high");
    expect(generic.components.find((c) => c.key === "intent")!.explanation).toMatch(/does not establish/);
  });
  it("unconfirmed partner-request classification is downgraded", () => {
    const r = score({ announcementType: "explicit_partner_request", partnerSignal: "none" });
    expect(r.flags).toContain("partner_request_unconfirmed");
    expect(r.components.find((c) => c.key === "intent")!.points).toBeLessThan(25);
  });
  it("irrelevant sector cannot rank high (Test 4)", () => {
    const r = score({ sectors: [], otherSectors: ["Environment"] });
    expect(r.priority).toBe("low");
    expect(r.components[0].points).toBe(0);
    expect(score({ isRelevant: false, announcementType: "not_csr" }).priority).toBe("low");
  });
  it("geographic mismatch is reflected in the score and caps priority (Test 5)", () => {
    const r = score({ geographies: ["Assam"] });
    expect(r.geoFit).toBe("mismatch");
    expect(r.components.find((c) => c.key === "geography")!.points).toBeLessThan(3);
    expect(r.priority).toBe("monitor");
    expect(geographicFit(["Nagpur"], { operating: ["Pune"], expansion: ["Maharashtra"], excluded: [] }).fit).toBe("expansion");
    expect(geographicFit(["Maharashtra"], { operating: ["Pune"], expansion: [], excluded: [] }).fit).toBe("operating_state");
    expect(geographicFit([], { operating: ["Pune"], expansion: [], excluded: [] }).fit).toBe("unknown");
  });
  it("changing configured geography changes the fit", () => {
    const s = settingsSchema.parse({ ...DEFAULT_SETTINGS, operatingGeographies: ["Assam"] });
    expect(score({ geographies: ["Assam"] }, s).geoFit).toBe("operating");
  });
  it("stale items get zero recency and background priority (Test 6)", () => {
    const r = score({ publishedAt: new Date("2026-09-30T00:00:00Z") });
    expect(r.components.find((c) => c.key === "recency")!.points).toBe(0);
    expect(r.priority).toBe("background");
  });
  it("unknown dates are not treated as fresh (Test 8)", () => {
    const r = score({ publishedAt: null, publishedAtProvenance: "unknown" });
    expect(r.freshness).toBe("unknown");
    expect(r.priority).not.toBe("high");
    expect(r.flags).toContain("date_unknown");
  });
  it("weak, unverifiable evidence is downgraded (Test 9)", () => {
    const r = score({ sources: [{ credibility: 0.4, isOfficial: false, publisher: "blog" }], claims: [{ kind: "fact", excerptVerified: false }] });
    expect(r.evidenceStrength).toBe("weak");
    expect(r.flags).toEqual(expect.arrayContaining(["weak_evidence", "unsupported_claims"]));
    expect(r.priority).not.toBe("high");
    expect(r.confidence).toBe("low");
  });
  it("corroboration by a second publisher raises evidence quality", () => {
    const one = score({ sources: [{ credibility: 0.8, isOfficial: false, publisher: "A" }] });
    const two = score({ sources: [{ credibility: 0.8, isOfficial: false, publisher: "A" }, { credibility: 0.7, isOfficial: false, publisher: "B" }] });
    expect(two.components[4].points).toBeGreaterThan(one.components[4].points);
  });
  it("weights are configurable and must sum to 100", () => {
    expect(settingsSchema.safeParse({ ...DEFAULT_SETTINGS, weights: { sector: 30, intent: 30, recency: 20, geography: 10, evidence: 15 } }).success).toBe(false);
    const s = settingsSchema.parse({ ...DEFAULT_SETTINGS, weights: { sector: 10, intent: 10, recency: 60, geography: 10, evidence: 10 } });
    expect(score({}, s).components.find((c) => c.key === "recency")!.max).toBe(60);
  });
  it("policy changes go to the policy section, stale policy to background", () => {
    expect(score({ announcementType: "policy_change", sectors: [] }).priority).toBe("policy");
    expect(score({ announcementType: "policy_change", publishedAt: new Date("2026-09-01T00:00:00Z") }).priority).toBe("background");
  });
});
