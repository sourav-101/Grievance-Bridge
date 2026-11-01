-- =============================================================================
-- IIT Roorkee Contract Worker Platform — initial schema
-- Run in the Supabase SQL editor (or `supabase db push`).
--
-- Security model
--   * Every table has RLS enabled. The browser never talks to these tables with
--     the anon key; all worker traffic goes through Next.js API routes that use
--     the service-role key after checking the worker's signed session cookie.
--   * The only client-side reads are by logged-in ADMIN users (Supabase Auth),
--     for the realtime Kanban feed. Those reads are restricted by the policies
--     at the bottom of this file.
--   * Anonymous (whistleblower) tickets store worker_id = NULL. The link back to
--     the worker lives in grievance_owners, which has no policies at all, so no
--     admin role can ever read it — only the server, to show the worker their
--     own history.
-- =============================================================================

create extension if not exists vector;
create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Shared trigger: keep updated_at fresh
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 1. CONTRACTOR AGENCIES
-- -----------------------------------------------------------------------------
create table public.contractors (
  id              uuid primary key default gen_random_uuid(),
  agency_name     varchar(150) not null,
  contract_type   varchar(50)  not null
                  check (contract_type in ('Sanitation','Security','Horticulture','Construction','Maintenance')),
  supervisor_name varchar(100),
  contact_phone   varchar(15)  not null,
  is_active       boolean      not null default true,
  created_at      timestamptz  not null default now()
);

-- -----------------------------------------------------------------------------
-- 2. WORKERS (profiles; authentication is our own phone-OTP flow)
-- -----------------------------------------------------------------------------
create table public.workers (
  id                 uuid primary key default gen_random_uuid(),
  phone_number       varchar(15)  unique not null,
  full_name          varchar(100) not null,
  age                int check (age > 0 and age < 100),
  is_phone_verified  boolean      not null default false,
  preferred_dialect  varchar(20)  not null default 'hindi'
                     check (preferred_dialect in ('hindi','bhojpuri','garhwali','kumaoni')),
  work_type          varchar(50)
                     check (work_type is null or work_type in ('Sanitation','Security','Horticulture','Construction','Maintenance')),
  contractor_id      uuid references public.contractors(id) on delete set null,
  created_at         timestamptz  not null default now(),
  updated_at         timestamptz  not null default now()
);
create trigger workers_updated_at before update on public.workers
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 3. OTP CODES (one row per phone; codes are stored as HMAC hashes)
-- -----------------------------------------------------------------------------
create table public.otp_codes (
  phone_number       varchar(15) primary key,
  code_hash          text        not null,
  expires_at         timestamptz not null,
  attempts           int         not null default 0,
  send_count         int         not null default 1,
  window_started_at  timestamptz not null default now(),
  created_at         timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 4. GRIEVANCE TICKETS
-- -----------------------------------------------------------------------------
create table public.grievances (
  id                    uuid primary key default gen_random_uuid(),
  ticket_number         serial unique,                     -- internal running number (admin/audit use)
  ticket_token          varchar(6) unique not null,        -- random 4-digit token the worker hears/speaks
  worker_id             uuid references public.workers(id) on delete set null,  -- NULL when anonymous
  contractor_id         uuid references public.contractors(id) on delete set null,
  category              varchar(50) not null
                        check (category in ('Wage Dispute','Safety/PPE','Sanitation','Harassment','General')),
  campus_location       varchar(100) not null,             -- human-readable location
  campus_zone           varchar(50),                       -- zone id from src/lib/campus.ts
  latitude              double precision,
  longitude             double precision,
  raw_audio_url         text,                              -- storage PATH in the private bucket (NULL for tap-filed tickets)
  transcript_hindi      text not null,
  summary_english       text not null,
  is_anonymous          boolean not null default false,
  is_emergency          boolean not null default false,
  emergency_keywords    text[]  not null default '{}',
  parent_ticket_id      uuid references public.grievances(id) on delete set null,  -- duplicate clustering
  status                varchar(20) not null default 'New'
                        check (status in ('New','Under Review','In Progress','Resolved')),
  assigned_department   varchar(100) not null default 'Institute Works Department',
  resolution_note_hindi text,
  resolved_at           timestamptz,
  dialect               varchar(20) not null default 'hindi',
  source                varchar(10) not null default 'voice' check (source in ('voice','tap')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint anonymous_has_no_worker check (not is_anonymous or worker_id is null)
);
create index grievances_status_idx       on public.grievances (status);
create index grievances_cluster_idx      on public.grievances (category, campus_zone, created_at desc);
create index grievances_parent_idx       on public.grievances (parent_ticket_id);
create index grievances_contractor_idx   on public.grievances (contractor_id);
create index grievances_worker_idx       on public.grievances (worker_id);
create index grievances_created_idx      on public.grievances (created_at desc);
create trigger grievances_updated_at before update on public.grievances
  for each row execute function public.set_updated_at();

-- Private link between an anonymous ticket and the worker who filed it.
-- No RLS policies => unreadable by anon/authenticated roles. Server-only.
create table public.grievance_owners (
  grievance_id uuid primary key references public.grievances(id) on delete cascade,
  worker_id    uuid not null references public.workers(id) on delete cascade,
  created_at   timestamptz not null default now()
);
create index grievance_owners_worker_idx on public.grievance_owners (worker_id);

-- Status-change audit trail (powers "resolution timelines" in exports).
create table public.grievance_events (
  id            uuid primary key default gen_random_uuid(),
  grievance_id  uuid not null references public.grievances(id) on delete cascade,
  actor_admin_id uuid,
  actor_label   text not null,         -- e.g. "Estate Officer: A. Sharma" or "System"
  from_status   varchar(20),
  to_status     varchar(20),
  note          text,
  created_at    timestamptz not null default now()
);
create index grievance_events_grievance_idx on public.grievance_events (grievance_id, created_at);

-- -----------------------------------------------------------------------------
-- 5. RESOLUTION FEEDBACK
-- -----------------------------------------------------------------------------
create table public.feedback (
  id                  uuid primary key default gen_random_uuid(),
  grievance_id        uuid not null references public.grievances(id) on delete cascade,
  worker_id           uuid references public.workers(id) on delete set null,  -- NULL for anonymous tickets
  rating              varchar(20) not null check (rating in ('Satisfied','Unsatisfied')),
  feedback_audio_url  text,          -- storage path
  feedback_transcript text,
  created_at          timestamptz not null default now(),
  unique (grievance_id)
);

-- -----------------------------------------------------------------------------
-- 6. CAMPUS KNOWLEDGE BASE (RAG)
--    1536-dim vectors from Gemini gemini-embedding-001 (outputDimensionality=1536, L2-normalised)
-- -----------------------------------------------------------------------------
create table public.knowledge_base (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  category       varchar(50) not null
                 check (category in ('Schemes','Wage Rules','Health Camps','Campus Policies','Document Checklist')),
  content_hindi  text not null,
  embedding      vector(1536),
  is_published   boolean not null default true,
  is_placeholder boolean not null default false,   -- true = seed text that must be replaced with real data
  sort_order     int not null default 100,
  updated_by     uuid,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index knowledge_base_category_idx on public.knowledge_base (category, sort_order);
create index knowledge_base_embedding_idx on public.knowledge_base
  using hnsw (embedding vector_cosine_ops);
create trigger knowledge_base_updated_at before update on public.knowledge_base
  for each row execute function public.set_updated_at();

-- Semantic search. similarity = cosine similarity in [−1, 1] (1 = identical).
create or replace function public.match_knowledge(
  query_embedding vector(1536),
  match_count int default 3
)
returns table (
  id uuid,
  title text,
  category varchar,
  content_hindi text,
  similarity double precision
)
language sql
stable
as $$
  select kb.id, kb.title, kb.category, kb.content_hindi,
         1 - (kb.embedding <=> query_embedding) as similarity
  from public.knowledge_base kb
  where kb.is_published and kb.embedding is not null
  order by kb.embedding <=> query_embedding
  limit match_count;
$$;

-- -----------------------------------------------------------------------------
-- 7. EMERGENCY HELPLINES (editable from the admin content manager)
-- -----------------------------------------------------------------------------
create table public.helplines (
  id                 uuid primary key default gen_random_uuid(),
  kind               varchar(20) not null check (kind in ('security','medical','women','other')),
  name_hindi         text not null,
  name_english       text not null,
  phone              varchar(20) not null,
  instructions_hindi text not null,
  is_placeholder     boolean not null default false,
  sort_order         int not null default 100,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create trigger helplines_updated_at before update on public.helplines
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 8. VOICE QUERY LOG (worker questions + AI answers)
-- -----------------------------------------------------------------------------
create table public.voice_queries (
  id                   uuid primary key default gen_random_uuid(),
  worker_id            uuid references public.workers(id) on delete cascade,
  transcript           text not null,
  corrected_transcript text,
  intent               varchar(20) not null,
  answer_text          text,
  answer_source        varchar(20),          -- rag | web | none | grievance | status
  confidence           double precision,
  dialect              varchar(20) not null default 'hindi',
  created_at           timestamptz not null default now()
);
create index voice_queries_worker_idx on public.voice_queries (worker_id, created_at desc);

-- -----------------------------------------------------------------------------
-- 9. ADMIN USERS + RBAC  (ids = Supabase Auth user ids)
-- -----------------------------------------------------------------------------
create table public.admin_users (
  id             uuid primary key references auth.users(id) on delete cascade,
  email          text not null,
  full_name      text not null,
  role           varchar(20) not null check (role in ('dean','estate_officer','contractor')),
  contractor_id  uuid references public.contractors(id) on delete set null,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  constraint contractor_role_needs_agency check (role <> 'contractor' or contractor_id is not null)
);

create or replace function public.current_admin_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.admin_users where id = auth.uid() and is_active;
$$;

create or replace function public.current_admin_contractor()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select contractor_id from public.admin_users where id = auth.uid() and is_active;
$$;

-- -----------------------------------------------------------------------------
-- 10. ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------
alter table public.contractors      enable row level security;
alter table public.workers          enable row level security;
alter table public.otp_codes        enable row level security;
alter table public.grievances       enable row level security;
alter table public.grievance_owners enable row level security;
alter table public.grievance_events enable row level security;
alter table public.feedback         enable row level security;
alter table public.knowledge_base   enable row level security;
alter table public.helplines        enable row level security;
alter table public.voice_queries    enable row level security;
alter table public.admin_users      enable row level security;

-- Admins may read grievances for the realtime board. Contractors only see their
-- own agency's NON-anonymous tickets. (Worker identity is never in this table
-- for anonymous tickets, and the API strips worker details for contractors.)
create policy grievances_admin_read on public.grievances
  for select to authenticated
  using (
    public.current_admin_role() in ('dean','estate_officer')
    or (
      public.current_admin_role() = 'contractor'
      and contractor_id = public.current_admin_contractor()
      and not is_anonymous
    )
  );

create policy admin_users_self_read on public.admin_users
  for select to authenticated
  using (id = auth.uid() or public.current_admin_role() = 'dean');

-- Server-only RPC.
revoke execute on function public.match_knowledge(vector, int) from public, anon, authenticated;
grant  execute on function public.match_knowledge(vector, int) to service_role;

-- -----------------------------------------------------------------------------
-- 11. REALTIME (admin Kanban listens to grievance changes)
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.grievances;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 12. STORAGE — PRIVATE audio vault. No storage policies are created, so only
--     the service role can read/write; admins get short-lived signed URLs.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('worker-audio-vault', 'worker-audio-vault', false, 5242880,
        array['audio/wav','audio/x-wav','audio/webm','audio/mp4','audio/mpeg','audio/ogg'])
on conflict (id) do nothing;
