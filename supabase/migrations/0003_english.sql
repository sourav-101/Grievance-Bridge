-- =============================================================================
-- English as a worker language. Run after 0002_pin_auth.sql.
-- Allows workers.preferred_dialect = 'english' (the original check only listed
-- Hindi and the three dialects, so saving English from the language menu failed).
-- =============================================================================

alter table public.workers drop constraint if exists workers_preferred_dialect_check;
alter table public.workers
  add constraint workers_preferred_dialect_check
  check (preferred_dialect in ('hindi','english','bhojpuri','garhwali','kumaoni'));
