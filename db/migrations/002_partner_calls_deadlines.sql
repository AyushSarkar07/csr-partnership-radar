-- 002: regulatory news sources, HTML listing adapter (NGOBox RFP/EOI board),
-- and source-stated application deadlines (never inferred by AI).

alter table sources drop constraint if exists sources_source_type_check;
alter table sources add constraint sources_source_type_check check (source_type in
  ('corporate_official','annual_report','business_news','csr_specialist_news',
   'government','partner_calls','news_api','regulatory_news'));

alter table sources drop constraint if exists sources_retrieval_method_check;
alter table sources add constraint sources_retrieval_method_check check (retrieval_method in
  ('rss','gdelt_api','ngobox_html','link_only'));

-- Deadline exactly as stated by the source listing (date only), with provenance.
alter table announcement_sources add column if not exists deadline date;
alter table announcements add column if not exists deadline date;
alter table announcements add column if not exists deadline_provenance text;

-- Registry decision recorded as data: FundsForNGOs blocks Vercel IPs (HTTP 403) and is
-- replaced by the NGOBox RFP/EOI board. (syncRegistry never overrides `enabled` on existing rows.)
update sources set enabled = false, updated_at = now() where id = 'fundsforngos'
