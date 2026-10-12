import { describe, expect, it } from "vitest";
import { dateKey, freshness, parseFeedDate, reportingWindow } from "@/lib/time/window";

const end = new Date("2026-10-12T00:30:00Z"); // Mon 06:00 IST
const w = reportingWindow(end, 7, "Asia/Kolkata");

describe("reporting window (Test 6 / Test 8 / BR-7)", () => {
  it("spans exactly 7×24h ending at the reference time", () => {
    expect(w.start.toISOString()).toBe("2026-10-05T00:30:00.000Z");
  });
  it("start is exclusive, end inclusive", () => {
    expect(freshness(new Date("2026-10-05T00:30:00Z"), w)).toBe("stale");
    expect(freshness(new Date("2026-10-05T00:30:01Z"), w)).toBe("fresh");
    expect(freshness(end, w)).toBe("fresh");
  });
  it("stale announcements are not fresh (Test 6)", () => {
    expect(freshness(new Date("2026-09-30T05:30:00Z"), w)).toBe("stale");
  });
  it("missing dates are 'unknown', never fresh (Test 8)", () => {
    expect(freshness(null, w)).toBe("unknown");
    expect(parseFeedDate(undefined)).toBeNull();
    expect(parseFeedDate("not a date")).toBeNull();
    expect(parseFeedDate("Sun, 11 Oct 2026 06:00:00 +0000")?.toISOString()).toBe("2026-10-11T06:00:00.000Z");
    expect(parseFeedDate("20261011T054500Z")?.toISOString()).toBe("2026-10-11T05:45:00.000Z");
  });
  it("future-dated items are flagged, allowing 1h skew", () => {
    expect(freshness(new Date(end.getTime() + 30 * 60_000), w)).toBe("fresh");
    expect(freshness(new Date(end.getTime() + 3 * 3_600_000), w)).toBe("future");
  });
  it("date keys use the configured timezone", () => {
    // 2026-10-11T20:00Z is already Monday 12 Oct in IST.
    expect(dateKey(new Date("2026-10-11T20:00:00Z"), "Asia/Kolkata")).toBe("2026-10-12");
    expect(dateKey(new Date("2026-10-11T20:00:00Z"), "UTC")).toBe("2026-10-11");
  });
});
