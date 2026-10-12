import { config } from "dotenv";
import { classifyWithGemini } from "../src/lib/ai/classify";
import { SEED_RECORDS } from "../src/lib/seed";
import { DEFAULT_SETTINGS } from "../src/lib/settings/schema";

config({ path: ".env.local", quiet: true });

/**
 * Runs REAL Gemini Flash classification over the synthetic seed texts and compares
 * against the hand-written expectations. Evidence for PDF-2 / BR-14 quality.
 * Usage: npx tsx scripts/gemini-eval.ts
 */
async function main() {
  const rows: string[] = [];
  let typeOk = 0, partnerOk = 0, verifiedFacts = 0, totalFacts = 0, n = 0;
  for (const r of SEED_RECORDS) {
    const expType = (r.scenario.expected as { category?: string }).category ?? r.type;
    try {
      const out = await classifyWithGemini(
        { headline: r.headline, publisher: r.source.publisher, sourceType: r.source.source_type, publishedAt: r.published_at, url: r.source.url, text: r.text },
        DEFAULT_SETTINGS,
      );
      n++;
      const t = out.analysis.announcement_type === expType;
      const p = out.analysis.implementation_partner_signal.level === r.partner_signal || (r.partner_signal !== "explicit" && out.analysis.implementation_partner_signal.level !== "explicit");
      typeOk += t ? 1 : 0;
      partnerOk += p ? 1 : 0;
      const facts = out.claims.filter((c) => c.kind === "fact");
      totalFacts += facts.length;
      verifiedFacts += facts.filter((c) => c.excerptVerified).length;
      rows.push(`| ${r.seed_id} | ${expType} | ${out.analysis.announcement_type} ${t ? "✓" : "✗"} | ${r.partner_signal} | ${out.analysis.implementation_partner_signal.level} ${p ? "✓" : "✗"} | ${facts.filter((c) => c.excerptVerified).length}/${facts.length} |`);
    } catch (e) {
      rows.push(`| ${r.seed_id} | ${expType} | ERROR ${(e as Error).message.slice(0, 60)} | | | |`);
    }
  }
  console.log(`Model: ${process.env.GEMINI_MODEL ?? "gemini-3.8-flash"} · records: ${n}/${SEED_RECORDS.length}`);
  console.log(`Announcement type exact match: ${typeOk}/${n} · Partner-signal safety (never false 'explicit'): ${partnerOk}/${n} · Fact excerpts verified: ${verifiedFacts}/${totalFacts}`);
  console.log("| Seed | Expected type | Gemini type | Expected partner | Gemini partner | Verified facts |\n|---|---|---|---|---|---|");
  console.log(rows.join("\n"));
}
main();
