-- CSR Partnership Radar — initial schema.
-- Conventions: text ids for registry rows, uuid ids for generated rows,
-- timestamptz everywhere, data_origin separates live and synthetic records.

-- gen_random_uuid() is built into PostgreSQL 13+, no extension required.

-- Source registry -----------------------------------------------------------
create table if not exists sources (
  id                  text primary key,
  name                text not null,
  source_type         text not null check (source_type in
                        ('corporate_official','annual_report','business_news','csr_specialist_news',
                         'government','partner_calls','news_api')),
  base_url            text not null,
  feed_url            text,
  retrieval_method    text not null check (retrieval_method in ('rss','gdelt_api','link_only')),
  is_official         boolean not null default false,
  credibility         numeric(3,2) not null default 0.6 check (credibility between 0 and 1),
  sector_relevance    text[] not null default '{}',
  geographic_coverage text not null default 'India',
  enabled             boolean not null default true,
  access_limitations  text,
  notes               text,
  config              jsonb not null default '{}'::jsonb,
  last_attempt_at     timestamptz,
  last_success_at     timestamptz,
  last_error          text,
  last_error_at       timestamptz,
  last_item_count     integer,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Fetch / pipeline runs -----------------------------------------------------
create table if not exists fetch_runs (
  id                uuid primary key default gen_random_uuid(),
  run_key           text unique,             -- set for scheduled runs to guarantee idempotency
  trigger           text not null check (trigger in ('manual','cron','seed','test')),
  status            text not null default 'running' check (status in ('running','succeeded','partial','failed')),
  started_at        timestamptz not null default now(),
  finished_at       timestamptz,
  sources_attempted integer not null default 0,
  sources_succeeded integer not null default 0,
  items_fetched     integer not null default 0,
  items_candidate   integer not null default 0,
  items_new         integer not null default 0,
  items_duplicate   integer not null default 0,
  items_classified  integer not null default 0,
  items_ai_failed   integer not null default 0,
  details           jsonb not null default '{}'::jsonb,
  error             text
);
create index if not exists fetch_runs_started_idx on fetch_runs (started_at desc);

-- Companies -----------------------------------------------------------------
create table if not exists companies (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  normalized_name text not null,
  data_origin     text not null check (data_origin in ('live','synthetic')),
  created_at      timestamptz not null default now(),
  unique (normalized_name, data_origin)
);

-- Announcements = primary opportunity records (one per real-world event) ----
create table if not exists announcements (
  id                       uuid primary key default gen_random_uuid(),
  data_origin              text not null check (data_origin in ('live','synthetic')),
  verification_status      text not null default 'needs_verification'
                             check (verification_status in ('verified','needs_verification','synthetic')),
  seed_id                  text unique,          -- stable id for synthetic records
  company_id               uuid references companies(id) on delete set null,
  headline                 text not null,
  normalized_headline      text not null,
  published_at             timestamptz,          -- null = unknown, never substituted
  published_at_provenance  text not null check (published_at_provenance in
                             ('feed_pubdate','api_seendate','synthetic','unknown')),
  first_seen_at            timestamptz not null default now(),
  primary_text             text,                 -- safely extracted text used for AI + excerpt checks
  content_hash             text,
  -- AI classification (Gemini Flash) ------------------------------------
  ai_status                text not null default 'pending'
                             check (ai_status in ('pending','done','failed','skipped','fixture')),
  ai_model                 text,
  ai_error                 text,
  ai_attempts              integer not null default 0,
  ai_processed_at          timestamptz,
  ai_input_hash            text,                 -- cache key: skip reclassification when unchanged
  is_relevant              boolean,
  announcement_type        text,
  sectors                  text[] not null default '{}',
  geographies              text[] not null default '{}',
  initiative_name          text,
  partner_signal           text check (partner_signal in ('explicit','implied','none')),
  analysis                 jsonb,                -- full validated structured output
  scenario                 jsonb,                -- synthetic-only: scenario + expectations
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index if not exists announcements_origin_pub_idx on announcements (data_origin, published_at desc);
create index if not exists announcements_company_idx on announcements (company_id);
create index if not exists announcements_type_idx on announcements (announcement_type);
create index if not exists announcements_ai_status_idx on announcements (ai_status);
create index if not exists announcements_sectors_idx on announcements using gin (sectors);

-- Every retrieved item (coverage), grouped under an announcement ----------
create table if not exists announcement_sources (
  id                       uuid primary key default gen_random_uuid(),
  announcement_id          uuid not null references announcements(id) on delete cascade,
  source_id                text references sources(id) on delete set null,
  fetch_run_id             uuid references fetch_runs(id) on delete set null,
  data_origin              text not null check (data_origin in ('live','synthetic')),
  url                      text not null,
  canonical_url            text not null unique,
  publisher                text,
  headline                 text not null,
  normalized_headline      text not null,
  published_at             timestamptz,
  published_at_provenance  text not null,
  retrieved_at             timestamptz not null default now(),
  excerpt                  text,
  raw_text                 text,
  source_type              text not null,
  credibility              numeric(3,2) not null default 0.5,  -- snapshot of source credibility at retrieval
  is_official              boolean not null default false,
  is_primary               boolean not null default false,
  created_at               timestamptz not null default now()
);
create index if not exists announcement_sources_ann_idx on announcement_sources (announcement_id);

-- Deterministic score snapshots --------------------------------------------
create table if not exists opportunity_scores (
  announcement_id uuid primary key references announcements(id) on delete cascade,
  total           integer not null check (total between 0 and 100),
  priority        text not null,
  confidence      text not null,
  breakdown       jsonb not null,
  settings_version integer not null,
  computed_at     timestamptz not null default now()
);

-- Evidence claims (each claim tied to an excerpt + coverage row) -----------
create table if not exists evidence_claims (
  id                   uuid primary key default gen_random_uuid(),
  announcement_id      uuid not null references announcements(id) on delete cascade,
  announcement_source_id uuid references announcement_sources(id) on delete set null,
  claim                text not null,
  kind                 text not null check (kind in ('fact','interpretation','unknown')),
  excerpt              text,
  excerpt_verified     boolean not null default false,  -- excerpt found verbatim in retrieved text
  created_at           timestamptz not null default now()
);
create index if not exists evidence_claims_ann_idx on evidence_claims (announcement_id);

-- Human review (append-only history; latest row = current status) ---------
create table if not exists opportunity_reviews (
  id              uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references announcements(id) on delete cascade,
  status          text not null check (status in
                    ('contact_this_week','monitor','research_further','not_relevant',
                     'already_contacted','discussion_underway','won_closed')),
  note            text,
  actor           text not null default 'ananya',
  created_at      timestamptz not null default now()
);
create index if not exists opportunity_reviews_ann_idx on opportunity_reviews (announcement_id, created_at desc);

-- Digests -------------------------------------------------------------------
create table if not exists digests (
  id               uuid primary key default gen_random_uuid(),
  digest_key       text not null unique,      -- "<mode>:<IST date of window end>" => idempotent
  data_mode        text not null check (data_mode in ('live','demo')),
  window_start     timestamptz not null,
  window_end       timestamptz not null,
  timezone         text not null,
  trigger          text not null check (trigger in ('manual','cron','test')),
  status           text not null check (status in ('generating','ready','failed')),
  generated_at     timestamptz not null default now(),
  generation_count integer not null default 1,
  summary          text,
  summary_source   text check (summary_source in ('gemini','deterministic_fallback')),
  ai_model         text,
  ai_error         text,
  content          jsonb not null default '{}'::jsonb,
  delivery_status  text not null default 'not_configured'
                     check (delivery_status in ('not_configured','pending','sent','failed','not_attempted')),
  delivery_channel text,
  delivered_at     timestamptz,
  delivery_error   text,
  delivery_message_id text
);
create index if not exists digests_generated_idx on digests (data_mode, generated_at desc);

create table if not exists digest_items (
  id              uuid primary key default gen_random_uuid(),
  digest_id       uuid not null references digests(id) on delete cascade,
  announcement_id uuid not null references announcements(id) on delete cascade,
  section         text not null check (section in ('high_priority','monitor','policy','background')),
  rank            integer not null,
  score           integer not null,
  payload         jsonb not null,
  unique (digest_id, announcement_id)
);

-- Settings (single row) -----------------------------------------------------
create table if not exists user_settings (
  id         integer primary key check (id = 1),
  settings   jsonb not null,
  version    integer not null default 1,
  updated_at timestamptz not null default now()
);

-- Audit trail ---------------------------------------------------------------
create table if not exists audit_events (
  id         uuid primary key default gen_random_uuid(),
  at         timestamptz not null default now(),
  actor      text not null,
  action     text not null,
  entity     text,
  entity_id  text,
  details    jsonb not null default '{}'::jsonb
);
create index if not exists audit_events_at_idx on audit_events (at desc);

-- Rate limiting for expensive operations -----------------------------------
create table if not exists rate_limits (
  key        text primary key,
  last_at    timestamptz not null
);
