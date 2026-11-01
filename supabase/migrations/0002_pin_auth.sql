-- =============================================================================
-- PIN login (AUTH_MODE=pin) — phone number + 4-digit PIN, no SMS needed.
-- Run after 0001_init.sql.
--
-- Credentials live in their own table (keyed by phone) so a PIN can be created
-- before the worker's profile exists (onboarding happens right after).
-- No RLS policies => only the server (service role) can read or write it.
-- =============================================================================

create table public.worker_credentials (
  phone_number      varchar(15) primary key,
  pin_hash          text,                    -- scrypt hash; NULL while a reset is pending
  failed_attempts   int not null default 0,
  locked_until      timestamptz,
  reset_code_hash   text,                    -- one-time code issued by the Estate Office
  reset_expires_at  timestamptz,
  reset_by_admin    uuid,
  reset_at          timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger worker_credentials_updated_at before update on public.worker_credentials
  for each row execute function public.set_updated_at();

alter table public.worker_credentials enable row level security;
