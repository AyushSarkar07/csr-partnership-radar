import { z } from "zod";
import { DEFAULT_TIMEZONE } from "../config";

const keySchema = z
  .string()
  .trim()
  .min(2)
  .max(40)
  .regex(/^[a-z][a-z0-9_]*$/, "use lowercase letters, digits and underscores");

const label = z.string().trim().min(2).max(60);
const geo = z.string().trim().min(2).max(60);

export const sectorSchema = z.object({
  key: keySchema,
  label,
  priority: z.enum(["high", "medium", "low"]),
  keywords: z.array(z.string().trim().min(2).max(40)).max(30).default([]),
});

export const weightsSchema = z
  .object({
    sector: z.number().int().min(0).max(100),
    intent: z.number().int().min(0).max(100),
    recency: z.number().int().min(0).max(100),
    geography: z.number().int().min(0).max(100),
    evidence: z.number().int().min(0).max(100),
  })
  .refine((w) => w.sector + w.intent + w.recency + w.geography + w.evidence === 100, {
    message: "Scoring weights must add up to exactly 100",
  });

export const settingsSchema = z
  .object({
    organisation: z.object({
      name: z.string().trim().min(2).max(80),
      base: z.string().trim().min(2).max(60),
    }),
    sectors: z.array(sectorSchema).min(1).max(15),
    excludedSectors: z.array(label).max(20),
    operatingGeographies: z.array(geo).max(30),
    expansionGeographies: z.array(geo).max(30),
    excludedGeographies: z.array(geo).max(30),
    programmeTypes: z.array(label).max(20),
    beneficiaryGroups: z.array(label).max(20),
    weights: weightsSchema,
    recency: z
      .object({
        topHours: z.number().int().min(1).max(168),
        midHours: z.number().int().min(1).max(336),
        unknownDateFraction: z.number().min(0).max(0.5),
      })
      .refine((r) => r.midHours > r.topHours, { message: "midHours must exceed topHours" }),
    thresholds: z
      .object({ high: z.number().int().min(1).max(100), monitor: z.number().int().min(0).max(99) })
      .refine((t) => t.high > t.monitor, { message: "High threshold must exceed monitor threshold" }),
    reportingWindowDays: z.number().int().min(1).max(60),
    timezone: z.string().refine(isValidTimeZone, "Unknown IANA timezone"),
    digest: z.object({
      enabled: z.boolean(),
      maxHighPriority: z.number().int().min(1).max(25),
      maxMonitor: z.number().int().min(0).max(25),
      emailEnabled: z.boolean(),
      emailTo: z.union([z.email(), z.literal("")]),
    }),
    dataMode: z.object({
      defaultMode: z.enum(["live", "demo"]),
      showDemo: z.boolean(),
    }),
  })
  .refine((s) => new Set(s.sectors.map((x) => x.key)).size === s.sectors.length, {
    message: "Sector keys must be unique",
  });

export type Settings = z.infer<typeof settingsSchema>;
export type SectorSetting = z.infer<typeof sectorSchema>;
export type Weights = z.infer<typeof weightsSchema>;

function isValidTimeZone(tz: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Defaults. Sector list comes from the assignment; everything else is an
 * implementation assumption documented in docs/ASSUMPTIONS.md.
 */
export const DEFAULT_SETTINGS: Settings = {
  organisation: { name: "Ananya's education NGO", base: "Pune" },
  sectors: [
    {
      key: "education",
      label: "Education",
      priority: "high",
      keywords: ["education", "school", "learning", "scholarship", "classroom", "teacher", "stem"],
    },
    {
      key: "skill_development",
      label: "Skill development",
      priority: "high",
      keywords: ["skill", "skilling", "vocational", "apprentice", "training", "employability", "upskilling"],
    },
    {
      key: "digital_literacy",
      label: "Digital literacy",
      priority: "high",
      keywords: ["digital literacy", "digital skills", "computer literacy", "coding", "digital inclusion"],
    },
    {
      key: "youth_employment",
      label: "Youth employment",
      priority: "high",
      keywords: ["youth employment", "jobs", "placement", "livelihood", "first-generation", "dropout"],
    },
  ],
  excludedSectors: [],
  operatingGeographies: ["Pune", "Pimpri-Chinchwad"],
  expansionGeographies: ["Maharashtra", "Karnataka", "Gujarat"],
  excludedGeographies: [],
  programmeTypes: [
    "Vocational skilling",
    "Digital literacy",
    "School-to-work transition",
    "Placement support",
  ],
  beneficiaryGroups: ["School dropouts", "First-generation job seekers", "Youth (18–29)"],
  weights: { sector: 25, intent: 25, recency: 20, geography: 15, evidence: 15 },
  recency: { topHours: 48, midHours: 96, unknownDateFraction: 0.2 },
  thresholds: { high: 70, monitor: 45 },
  reportingWindowDays: 7,
  timezone: DEFAULT_TIMEZONE,
  digest: { enabled: true, maxHighPriority: 10, maxMonitor: 10, emailEnabled: false, emailTo: "" },
  dataMode: { defaultMode: "live", showDemo: true },
};
