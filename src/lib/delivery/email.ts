import { appUrl } from "../config";
import type { DigestContent, DigestItemPayload } from "../digest/build";
import { formatDate } from "../time/window";

/**
 * Optional email delivery through Resend (https://resend.com). Only used when
 * RESEND_API_KEY and DIGEST_FROM_EMAIL are set AND email is enabled in
 * Settings with a recipient. Otherwise the digest is stored and viewable in the
 * app, and the delivery status says so — never "sent".
 */

export interface EmailConfigStatus {
  configured: boolean;
  missing: string[];
}

export function emailConfigStatus(emailEnabled: boolean, emailTo: string): EmailConfigStatus {
  const missing: string[] = [];
  if (!process.env.RESEND_API_KEY) missing.push("RESEND_API_KEY");
  if (!process.env.DIGEST_FROM_EMAIL) missing.push("DIGEST_FROM_EMAIL");
  if (!emailEnabled) missing.push("email delivery disabled in Settings");
  if (!emailTo) missing.push("recipient email in Settings");
  return { configured: missing.length === 0, missing };
}

const esc = (s: string | null | undefined) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function safeHref(url: string) {
  return /^https?:\/\//i.test(url) ? esc(url) : "#";
}

function itemHtml(i: DigestItemPayload, tz: string) {
  const src = i.sources.find((s) => s.isPrimary) ?? i.sources[0];
  return `<tr><td style="padding:14px 0;border-bottom:1px solid #e5e7eb">
  <div style="font:600 15px system-ui">${esc(i.company ?? "Unknown company")} — ${esc(i.headline)}</div>
  <div style="font:12px system-ui;color:#6b7280">${esc(formatDate(i.publishedAt, tz))} · Score ${i.score}/100 · ${esc(i.verdict)}</div>
  <p style="font:14px system-ui;margin:8px 0"><b>What was announced:</b> ${esc(i.whatWasAnnounced)}</p>
  <p style="font:14px system-ui;margin:8px 0"><b>Why it matters:</b> ${esc(i.whyItMatters)}</p>
  <p style="font:14px system-ui;margin:8px 0"><b>Next action:</b> ${esc(i.nextAction)}</p>
  ${src ? `<a href="${safeHref(src.url)}" style="font:13px system-ui">Original source (${esc(src.publisher)})</a>` : ""}
  </td></tr>`;
}

export function renderDigestEmail(content: DigestContent, summary: string, digestId: string) {
  const tz = content.window.timezone;
  const subject = `CSR Radar — week ending ${formatDate(content.window.end, tz)}: ${content.counts.high_priority} to call, ${content.counts.monitor} to monitor`;
  const section = (title: string, items: DigestItemPayload[]) =>
    items.length ? `<h2 style="font:600 17px system-ui;margin:24px 0 4px">${esc(title)}</h2><table width="100%">${items.map((i) => itemHtml(i, tz)).join("")}</table>` : "";
  const link = `${appUrl()}/digest/${digestId}`;
  const html = `<div style="max-width:680px;margin:auto">
  <h1 style="font:700 20px system-ui">Weekly CSR intelligence digest</h1>
  <p style="font:13px system-ui;color:#6b7280">${esc(formatDate(content.window.start, tz))} – ${esc(formatDate(content.window.end, tz))} (${esc(tz)})</p>
  <p style="font:14px system-ui">${esc(summary)}</p>
  ${content.limitedEvidenceNote ? `<p style="font:13px system-ui;color:#92400e">${esc(content.limitedEvidenceNote)}</p>` : ""}
  ${section("High priority — worth a call this week", content.sections.high_priority)}
  ${section("Monitor", content.sections.monitor)}
  ${section("Policy & regulatory", content.sections.policy)}
  <p style="font:13px system-ui;margin-top:24px"><a href="${esc(link)}">Open the full digest with evidence and review controls</a></p>
  <p style="font:11px system-ui;color:#9ca3af">Scores are decision support, not a prediction of funding. AI analysis by Gemini Flash; verify facts on the original source before outreach.</p>
  </div>`;
  const text = [
    subject,
    summary,
    ...content.sections.high_priority.map((i) => `• ${i.company}: ${i.headline} (${i.score}/100) — ${i.nextAction}`),
    `Full digest: ${link}`,
  ].join("\n\n");
  return { subject, html, text };
}

export async function sendViaResend(to: string, email: { subject: string; html: string; text: string }, idempotencyKey: string, fetchImpl: typeof fetch = fetch) {
  const res = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
    },
    body: JSON.stringify({ from: process.env.DIGEST_FROM_EMAIL, to: [to], subject: email.subject, html: email.html, text: email.text }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!res.ok || !body.id) throw new Error(`Resend HTTP ${res.status}: ${body.message ?? "unknown error"}`);
  return body.id;
}
