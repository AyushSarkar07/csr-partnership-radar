/** Plain-language versions of technical fetch errors, for display. */
export function friendlySourceError(err: string | null | undefined): string | null {
  if (!err) return null;
  const e = err.toLowerCase();
  if (/http 403|forbidden|http 401/.test(e)) return "Access refused by the site";
  if (/429|limit requests|rate/.test(e)) return "Temporarily limiting requests";
  if (/timed out|timeout/.test(e)) return "Did not respond in time";
  if (/http 404/.test(e)) return "Feed not found";
  if (/http 5\d\d/.test(e)) return "Site temporarily unavailable";
  if (/network|fetch failed|econn|enotfound/.test(e)) return "Connection problem";
  if (/xml|json|layout|not an rss|unparseable/.test(e)) return "Feed format changed";
  return "Check failed";
}
