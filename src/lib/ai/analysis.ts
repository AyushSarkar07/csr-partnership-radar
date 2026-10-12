import { z } from "zod";

export const ANNOUNCEMENT_TYPES = [
  "explicit_partner_request",
  "new_initiative",
  "programme_expansion",
  "increased_allocation",
  "policy_change",
  "general_csr",
  "historical_activity",
  "not_csr",
] as const;
export type AnnouncementType = (typeof ANNOUNCEMENT_TYPES)[number];

export const ANNOUNCEMENT_TYPE_LABEL: Record<AnnouncementType, string> = {
  explicit_partner_request: "Explicit NGO-partner request",
  new_initiative: "New CSR initiative",
  programme_expansion: "Programme expansion",
  increased_allocation: "Increased CSR allocation",
  policy_change: "Policy / regulatory change",
  general_csr: "General CSR activity",
  historical_activity: "Historical activity only",
  not_csr: "Not a CSR development",
};

export const claimSchema = z.object({
  claim: z.string().trim().min(3).max(400),
  kind: z.enum(["fact", "interpretation", "unknown"]),
  excerpt: z.string().trim().max(600).nullable(),
});

/** Structured output contract for Gemini classification (validated before saving). */
export function analysisSchema(sectorKeys: string[]) {
  const keys = sectorKeys.length ? (sectorKeys as [string, ...string[]]) : (["education"] as [string]);
  return z.object({
    is_csr_relevant: z.boolean(),
    company_name: z.string().trim().max(120).nullable(),
    initiative_name: z.string().trim().max(160).nullable(),
    announcement_type: z.enum(ANNOUNCEMENT_TYPES),
    sectors: z.array(z.enum(keys)).max(8),
    other_sectors: z.array(z.string().trim().max(60)).max(8),
    geographies: z.array(z.string().trim().max(60)).max(12),
    beneficiary_groups: z.array(z.string().trim().max(80)).max(8),
    funding_signal: z.object({
      present: z.boolean(),
      description: z.string().trim().max(300).nullable(),
    }),
    implementation_partner_signal: z.object({
      level: z.enum(["explicit", "implied", "none"]),
      evidence: z.string().trim().max(400).nullable(),
    }),
    summary: z.string().trim().min(10).max(900),
    why_it_matters: z.string().trim().min(5).max(700),
    evidence_claims: z.array(claimSchema).max(10),
    missing_information: z.array(z.string().trim().max(200)).max(10),
    suggested_next_action: z.string().trim().min(5).max(300),
    outreach_angle: z.string().trim().max(400).nullable(),
    policy_implication: z
      .object({
        implication: z.string().trim().max(500),
        status: z.enum(["confirmed", "needs_interpretation"]),
      })
      .nullable(),
    injection_detected: z.boolean(),
  });
}

export type Analysis = z.infer<ReturnType<typeof analysisSchema>>;
export type Claim = z.infer<typeof claimSchema>;
