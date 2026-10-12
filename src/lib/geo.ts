/**
 * Small, explicit gazetteer for geographic fit. Only the city→state links
 * listed here are inferred; anything else must match by name. We never assume
 * a company operates in Pune simply because the NGO is based there.
 */
const CITY_STATE: Record<string, string> = {
  pune: "maharashtra", "pimpri chinchwad": "maharashtra", mumbai: "maharashtra", thane: "maharashtra",
  "navi mumbai": "maharashtra", nagpur: "maharashtra", nashik: "maharashtra", aurangabad: "maharashtra",
  "chhatrapati sambhajinagar": "maharashtra", kolhapur: "maharashtra", solapur: "maharashtra", satara: "maharashtra",
  bengaluru: "karnataka", bangalore: "karnataka", mysuru: "karnataka", mysore: "karnataka", hubballi: "karnataka",
  ahmedabad: "gujarat", surat: "gujarat", vadodara: "gujarat", rajkot: "gujarat",
  chennai: "tamil nadu", coimbatore: "tamil nadu", madurai: "tamil nadu",
  hyderabad: "telangana", warangal: "telangana",
  kolkata: "west bengal", delhi: "delhi", "new delhi": "delhi", noida: "uttar pradesh", lucknow: "uttar pradesh",
  gurugram: "haryana", gurgaon: "haryana", jaipur: "rajasthan", bhopal: "madhya pradesh", indore: "madhya pradesh",
  patna: "bihar", ranchi: "jharkhand", bhubaneswar: "odisha", guwahati: "assam", kochi: "kerala",
  thiruvananthapuram: "kerala", visakhapatnam: "andhra pradesh", vijayawada: "andhra pradesh", goa: "goa",
  chandigarh: "chandigarh", raipur: "chhattisgarh", dehradun: "uttarakhand",
};

const NATIONAL = new Set(["india", "pan india", "pan-india", "nationwide", "national", "all india", "across india", "multiple states"]);

export function normGeo(s: string): string {
  return s.toLowerCase().replace(/[^a-z ]+/g, " ").replace(/\s+/g, " ").trim()
    .replace(/ district$| city$| state$| region$/, "");
}

export function stateOf(geo: string): string | null {
  const g = normGeo(geo);
  return CITY_STATE[g] ?? null;
}

function matches(annGeo: string, configured: string): "exact" | "contains" | "within" | null {
  const a = normGeo(annGeo);
  const c = normGeo(configured);
  if (!a || !c) return null;
  if (a === c) return "exact";
  if (stateOf(a) === c) return "exact"; // e.g. programme in Nagpur, configured "Maharashtra"
  if (stateOf(c) === a) return "contains"; // state-wide programme that may include the configured city
  return null;
}

export type GeoFit =
  | "operating"
  | "operating_state"
  | "expansion"
  | "national"
  | "unknown"
  | "mismatch"
  | "excluded";

export const GEO_FIT_FRACTION: Record<GeoFit, number> = {
  operating: 1,
  operating_state: 0.8,
  expansion: 0.67,
  national: 0.55,
  unknown: 0.35,
  mismatch: 0.15,
  excluded: 0,
};

export const GEO_FIT_LABEL: Record<GeoFit, string> = {
  operating: "In a current operating geography",
  operating_state: "State-wide programme covering an operating geography",
  expansion: "In a target expansion geography",
  national: "National / multi-state programme",
  unknown: "Geography not stated in the evidence",
  mismatch: "Outside current and target geographies",
  excluded: "In an excluded geography",
};

export function geographicFit(
  geographies: string[],
  cfg: { operating: string[]; expansion: string[]; excluded: string[] },
): { fit: GeoFit; matched: string[] } {
  const geos = geographies.map((g) => g.trim()).filter(Boolean);
  if (!geos.length) return { fit: "unknown", matched: [] };

  const hit = (list: string[], kinds: Array<"exact" | "contains" | "within">) => {
    const out: string[] = [];
    for (const g of geos) for (const c of list) {
      const m = matches(g, c);
      if (m && kinds.includes(m)) out.push(g);
    }
    return [...new Set(out)];
  };

  const op = hit(cfg.operating, ["exact"]);
  if (op.length) return { fit: "operating", matched: op };
  const opState = hit(cfg.operating, ["contains"]);
  if (opState.length) return { fit: "operating_state", matched: opState };
  const exp = hit(cfg.expansion, ["exact", "contains"]);
  if (exp.length) return { fit: "expansion", matched: exp };
  const nat = geos.filter((g) => NATIONAL.has(normGeo(g)));
  if (nat.length) return { fit: "national", matched: nat };
  const ex = hit(cfg.excluded, ["exact", "contains"]);
  if (ex.length && ex.length === geos.length) return { fit: "excluded", matched: ex };
  return { fit: "mismatch", matched: [] };
}
