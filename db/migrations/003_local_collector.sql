-- 003: runs started by the Mac-side collector for sources that block cloud IPs.
alter table fetch_runs drop constraint if exists fetch_runs_trigger_check;
alter table fetch_runs add constraint fetch_runs_trigger_check check (trigger in ('manual','cron','seed','test','collector'));

-- FundsForNGOs is fetched again, but only by the local collector (config.runner = 'local').
update sources set enabled = true, updated_at = now() where id = 'fundsforngos'
