import seed from "../../data/seed-opportunities.json";

/** Fixed reference time for Demo mode (Monday 06:00 IST) so synthetic behaviour is reproducible. */
export const DEMO_REFERENCE_TIME = new Date(seed.reference_time);
export const SEED_VERSION = seed.version;
