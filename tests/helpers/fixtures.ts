import { readFileSync } from "node:fs";
import path from "node:path";
import type { Analysis } from "@/lib/ai/analysis";
import { verifyClaims } from "@/lib/ai/classify";
import type { Classifier } from "@/lib/pipeline/ingest";
import { REGISTRY } from "@/lib/sources/registry";

export const NOW = new Date("2026-10-12T00:30:00Z"); // Monday 06:00 IST
const feed = (f: string) => readFileSync(path.join(import.meta.dirname, "..", "fixtures", f), "utf8");
const url = (id: string) => REGISTRY.find((s) => s.id === id)!.feed_url!;

export const FIXTURE_SOURCES = ["indiacsr", "thecsrjournal", "et-corporate-trends"];

/** Deterministic stand-in for the network: two fixture feeds and one failing source. */
export function fixtureFetch(opts: { failA?: boolean } = {}) {
  return async (u: string) => {
    if (u === url("indiacsr")) {
      if (opts.failA) throw new Error("ECONNRESET");
      return new Response(feed("feed-a.xml"), { status: 200 });
    }
    if (u === url("thecsrjournal")) return new Response(feed("feed-b.xml"), { status: 200 });
    if (u === url("et-corporate-trends")) return new Response("Forbidden", { status: 403 });
    return new Response("not found", { status: 404 });
  };
}

function base(over: Partial<Analysis>): Analysis {
  return {
    is_csr_relevant: true,
    company_name: null,
    initiative_name: null,
    announcement_type: "general_csr",
    sectors: [],
    other_sectors: [],
    geographies: [],
    beneficiary_groups: [],
    funding_signal: { present: false, description: null },
    implementation_partner_signal: { level: "none", evidence: "Not stated" },
    summary: "Fixture summary text.",
    why_it_matters: "Fixture rationale.",
    evidence_claims: [],
    missing_information: [],
    suggested_next_action: "Fixture next action.",
    outreach_angle: null,
    policy_implication: null,
    injection_detected: false,
    ...over,
  };
}

/** Rule-based fake of the Gemini classifier, keyed on headline content. */
export const fakeClassifier: Classifier = async (input) => {
  const h = input.headline.toLowerCase();
  let a: Analysis;
  if (h.includes("trees")) {
    a = base({ company_name: "Fixture Infotech Ltd", initiative_name: "Tree planting", announcement_type: "new_initiative", other_sectors: ["Environment"], geographies: ["Pune"] });
  } else if (h.includes("fixture infotech")) {
    a = base({
      company_name: "Fixture Infotech Ltd", initiative_name: "Fixture digital skilling programme", announcement_type: "new_initiative",
      sectors: ["digital_literacy", "skill_development"], geographies: ["Pune"],
      evidence_claims: [{ claim: "Programme for 2,000 youth in Pune", kind: "fact", excerpt: input.text.split(".")[0] }],
    });
  } else if (h.includes("invites ngos")) {
    a = base({
      company_name: "Fixture Motors", announcement_type: "explicit_partner_request", sectors: ["skill_development"], geographies: ["Pimpri-Chinchwad"],
      implementation_partner_signal: { level: "explicit", evidence: "inviting NGOs to submit proposals" },
      evidence_claims: [{ claim: "Inviting NGO proposals", kind: "fact", excerpt: "is inviting NGOs to submit proposals to implement a CSR skill development project" }],
    });
  } else if (h.includes("fixture bank")) {
    a = base({ company_name: "Fixture Bank", announcement_type: "general_csr", sectors: ["education"], geographies: ["India"],
      evidence_claims: [{ claim: "No new programme", kind: "fact", excerpt: "No new programme was announced" }] });
  } else if (h.includes("injection") || h.includes("ignore previous")) {
    a = base({ company_name: "Fixture Telecom", announcement_type: "general_csr", sectors: ["education"], injection_detected: true });
  } else {
    a = base({ company_name: input.headline.split(" ").slice(0, 2).join(" "), announcement_type: "new_initiative", sectors: ["skill_development"], geographies: ["Pune"],
      evidence_claims: [{ claim: "Announced programme", kind: "fact", excerpt: input.text.slice(0, 40) }] });
  }
  return { analysis: a, claims: verifyClaims(a, input.text, input.headline), model: "fake-classifier" };
};
