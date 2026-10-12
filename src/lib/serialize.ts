import type { Opportunity } from "./repo/opportunities";

/** API shape for an opportunity (no sign-in: notes are visible to everyone). */
export function toApiOpportunity(o: Opportunity) {
  return o;
}
