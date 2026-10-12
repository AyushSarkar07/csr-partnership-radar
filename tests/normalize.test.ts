import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseGdelt } from "@/lib/sources/adapters/gdelt";
import { parseFeed } from "@/lib/sources/adapters/rss";
import { normalizeItem, prefilter } from "@/lib/pipeline/normalize";
import { DEFAULT_SETTINGS } from "@/lib/settings/schema";
import { REGISTRY } from "@/lib/sources/registry";
import { canonicalizeUrl, containsExcerpt, headlineSimilarity, htmlToText, normalizeCompany } from "@/lib/text";

const src = REGISTRY.find((s) => s.id === "indiacsr")!;
const xml = readFileSync(path.join(import.meta.dirname, "fixtures", "feed-a.xml"), "utf8");

describe("RSS adapter + normalisation (BR-3, BR-5)", () => {
  const items = parseFeed(xml, "fallback");
  it("parses all items with publisher from the channel", () => {
    expect(items).toHaveLength(9);
    expect(items[0].publisher).toBe("Fixture CSR News A");
  });
  it("strips scripts/HTML and keeps provenance", () => {
    const n = normalizeItem(items[0], src);
    expect(n.ok).toBe(true);
    if (!n.ok) return;
    expect(n.item.text).not.toMatch(/<|alert/);
    expect(n.item.provenance).toBe("feed_pubdate");
    expect(n.item.canonicalUrl).toBe("https://fixture-a.example/news/fixture-infotech-digital-skilling");
  });
  it("missing pubDate stays null with provenance 'unknown' (Test 8)", () => {
    const n = normalizeItem(items[6], src);
    expect(n.ok && n.item.publishedAt).toBeNull();
    expect(n.ok && n.item.provenance).toBe("unknown");
  });
  it("pre-filter keeps CSR+sector items and drops unrelated business news", () => {
    const pf = (i: number) => { const n = normalizeItem(items[i], src); return n.ok ? prefilter(n.item, DEFAULT_SETTINGS, src).candidate : false; };
    expect(pf(0)).toBe(true);
    expect(pf(1)).toBe(true);
    expect(pf(3)).toBe(false);
  });
  it("publication names containing 'CSR' do not count as a CSR signal", () => {
    const n = normalizeItem({ ...items[3], title: "Student wins quiz | The CSR Journal", description: "A school quiz was held." }, src);
    expect(n.ok && prefilter(n.item, DEFAULT_SETTINGS, src).candidate).toBe(false);
  });
  it("rejects malformed XML and non-feeds", () => {
    expect(() => parseFeed("<html><body>blocked</body></html>", "x")).toThrow();
  });
  it("GDELT rate-limit text is treated as a source failure", () => {
    expect(() => parseGdelt("Please limit requests to one every 5 seconds")).toThrow(/did not return JSON/);
    expect(parseGdelt('{"articles":[{"url":"https://x.example/a","title":"T","seendate":"20261011T054500Z","domain":"x.example"}]}')[0].publishedProvenance).toBe("api_seendate");
  });
});

describe("text utilities", () => {
  it("canonicalises URLs for exact dedup", () => {
    expect(canonicalizeUrl("https://www.Example.com/a/b/?utm_source=x&id=2#frag")).toBe("https://example.com/a/b?id=2");
    expect(canonicalizeUrl("javascript:alert(1)")).toBeNull();
  });
  it("headline similarity separates same-event from different-event headlines", () => {
    expect(headlineSimilarity("Lumen Telecom launches Code Ready coding programme for 5,000 Pune youth", "Lumen Telecom launches 'Code Ready' coding programme for 5,000 youth in Pune")).toBeGreaterThan(0.6);
    expect(headlineSimilarity("Kestrel Digital launches digital skilling academy", "Kestrel Digital to plant 50,000 trees")).toBeLessThan(0.3);
  });
  it("normalises company names", () => {
    expect(normalizeCompany("Infosys Foundation")).toBe(normalizeCompany("Infosys Ltd."));
  });
  it("verifies excerpts verbatim (whitespace/quote tolerant) and rejects fabrications (Test 17)", () => {
    const text = "The company said it “will work with implementation partners” to deliver sessions.";
    expect(containsExcerpt(text, 'will work with  implementation partners"')).toBe(true);
    expect(containsExcerpt(text, "is seeking NGO partners for Pune")).toBe(false);
    expect(containsExcerpt(text, "short")).toBe(false);
  });
  it("htmlToText decodes entities and drops tags", () => {
    expect(htmlToText("<p>A &amp; B&#8217;s <b>plan</b></p>")).toBe("A & B’s plan");
  });
});
