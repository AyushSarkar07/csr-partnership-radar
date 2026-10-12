import type { Opportunity } from "./repo/opportunities";

/** API shape: private review notes are only returned to the signed-in user. */
export function toApiOpportunity(o: Opportunity, authed: boolean) {
  return {
    ...o,
    review: o.review ? { ...o.review, note: authed ? o.review.note : o.review.note ? "[private — sign in]" : null } : null,
  };
}
