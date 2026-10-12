import { describe, expect, it } from "vitest";
import { nextDigestAt } from "@/lib/time/window";

describe("next digest time (Monday 06:00 IST = 00:30 UTC)", () => {
  it.each([
    ["2026-10-12T02:00:00Z", "2026-10-19T00:30:00.000Z"], // Monday after the run → next Monday
    ["2026-10-12T00:10:00Z", "2026-10-12T00:30:00.000Z"], // Monday before the run → today
    ["2026-10-14T10:00:00Z", "2026-10-19T00:30:00.000Z"], // Wednesday
    ["2026-10-18T23:00:00Z", "2026-10-19T00:30:00.000Z"], // Sunday night UTC = Monday 04:30 IST
  ])("%s → %s", (now, next) => expect(nextDigestAt(new Date(now)).toISOString()).toBe(next));
});
