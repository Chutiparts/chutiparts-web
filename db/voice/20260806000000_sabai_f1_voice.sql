-- ============================================================================
-- Migration: SabAI F1 voice module — additive schema  (slice ค)
-- Target   : Supabase / Postgres  (prod ref qaqawfvbaqyznuuecfp)
-- Pairs with: SabAI_F1_API_Scaffold_Brief.md  (this is the "hard prerequisite"
--             migration in brief §2.1 — MUST run BEFORE the API scaffold slice)
--
-- SCOPE: ADDITIVE ONLY. Creates 3 new tables + adds 2 columns to ops_decisions.
--        Touches NOTHING existing (no drops, no column changes, no data rewrite).
--        Zero-impact → safe to run before Case 0 closes (brief §Gate).
--
-- Rename to Supabase convention before committing, e.g.
--   supabase/migrations/20260806120000_sabai_f1_voice.sql
-- ============================================================================

-- ⚠️ VERIFY BEFORE RUNNING — primary-key TYPES of the referenced tables.
--    The cross-table FK columns below (contact_lead_id, order_id, business_id)
--    are declared `uuid`, matching Supabase's default. If your prod PKs are
--    bigint/int/text, change those columns to the matching type first, or the
--    REFERENCES clause will fail. Check with:
--
--    select table_name, column_name, data_type
--    from information_schema.columns
--    where table_name in ('contact_leads','orders','businesses','ops_decisions')
--      and column_name = 'id';
--
--    (If the referenced PKs are NOT uuid: this migration still creates the tables
--     fine — only the REFERENCES clauses need their type switched to match.)

begin;

-- ---------------------------------------------------------------------------
-- 1) call_queue — outbound call queue (F1). One row per intended call.
--    Catch #1: customer ref = contact_lead_id (NOT customer_id; no customers table)
--    Catch #2: trigger_source pinned to 'orders_ready_for_pickup' (decoupled from ledger)
-- ---------------------------------------------------------------------------
create table if not exists public.call_queue (
  id               uuid primary key default gen_random_uuid(),
  idempotency_key  text        not null,                 -- dedupe retries (brief §3.2)
  contact_lead_id  uuid        not null references public.contact_leads(id),
  order_id         uuid                 references public.orders(id),
  business_id      uuid        not null references public.businesses(id),
  intent_type      text        not null check (intent_type in ('arrival_notify','order_confirm')),
  trigger_source   text        not null default 'orders_ready_for_pickup'
                                        check (trigger_source in ('orders_ready_for_pickup')),
  status           text        not null default 'queued'
                                        check (status in ('queued','dialing','completed','failed','cancelled')),
  requested_by     text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint call_queue_idempotency_key_uniq unique (idempotency_key)
);

create index if not exists call_queue_status_idx       on public.call_queue (status);
create index if not exists call_queue_contact_lead_idx on public.call_queue (contact_lead_id);

comment on table  public.call_queue is 'SabAI F1 outbound call queue. Retention: purge rows > 90 days (cleanup job, TODO).';
comment on column public.call_queue.idempotency_key is 'Client-supplied; /trigger-call is idempotent on this (brief §3.2).';
comment on column public.call_queue.trigger_source is 'Catch #2: pinned to orders_ready_for_pickup — do not widen without design review.';

-- ---------------------------------------------------------------------------
-- 2) voice_call_logs — one row per completed call (result + cost).
--    `id` IS the voice_call_log_id supplied by the orchestrator → natural
--    idempotency for /call-result (brief §3.3). Audio/transcript stay self-host;
--    we store only a reference (data residency).
-- ---------------------------------------------------------------------------
create table if not exists public.voice_call_logs (
  id              uuid primary key default gen_random_uuid(),  -- = voice_call_log_id
  call_queue_id   uuid                 references public.call_queue(id),
  contact_lead_id uuid        not null references public.contact_leads(id),
  order_id        uuid                 references public.orders(id),
  outcome         text        not null check (outcome in ('answered','no_answer','busy','failed')),
  intent          text                 check (intent  in ('confirmed','declined','reschedule','unclear')),
  stt_confidence  numeric(4,3)         check (stt_confidence >= 0 and stt_confidence <= 1),
  transcript_ref  text,                                         -- reference only, never inline audio/transcript
  duration_sec    integer              check (duration_sec >= 0),
  cost_thb        numeric(10,4)        check (cost_thb >= 0),   -- cost log EVERY call (target self-host 1.65 THB/min)
  created_at      timestamptz not null default now()
);

create index if not exists voice_call_logs_call_queue_idx   on public.voice_call_logs (call_queue_id);
create index if not exists voice_call_logs_contact_lead_idx on public.voice_call_logs (contact_lead_id, created_at desc);

comment on table  public.voice_call_logs is 'SabAI F1 per-call result + cost. Retention: purge rows > 90 days (cleanup job, TODO).';
comment on column public.voice_call_logs.transcript_ref is 'Pointer to self-hosted transcript/audio. Never store the transcript body here (data residency).';

-- ---------------------------------------------------------------------------
-- 3) voice_consent_log — PDPA ม.19 consent ledger. APPEND-ONLY.
--    Consent-first gate reads "latest by captured_at" (brief §3.4 / §4).
-- ---------------------------------------------------------------------------
create table if not exists public.voice_consent_log (
  id                   uuid primary key default gen_random_uuid(),
  contact_lead_id      uuid        not null references public.contact_leads(id),
  channel              text        not null default 'voice' check (channel in ('voice')),
  granted              boolean     not null,
  consent_text_version text        not null,
  method               text        not null check (method in ('ivr','agent','web')),
  captured_at          timestamptz not null,
  created_at           timestamptz not null default now()
);

create index if not exists voice_consent_log_lookup_idx
  on public.voice_consent_log (contact_lead_id, captured_at desc);

comment on table public.voice_consent_log is 'PDPA ม.19 consent ledger, append-only. Retention: keep >= 90 days for audit.';

-- Enforce append-only: block UPDATE/DELETE at the DB (audit integrity).
create or replace function public.voice_consent_log_no_mutate()
returns trigger
language plpgsql
as $$
begin
  raise exception 'voice_consent_log is append-only (PDPA audit): % is not allowed', tg_op;
end;
$$;

drop trigger if exists voice_consent_log_block_mutate on public.voice_consent_log;
create trigger voice_consent_log_block_mutate
  before update or delete on public.voice_consent_log
  for each row execute function public.voice_consent_log_no_mutate();

-- ---------------------------------------------------------------------------
-- 4) ops_decisions — ADDITIVE columns only (existing table, do not rewrite).
--    Links a voice-originated decision back to its call log; source tags origin.
-- ---------------------------------------------------------------------------
alter table public.ops_decisions
  add column if not exists source text not null default 'manual'
    check (source in ('manual','voice'));

alter table public.ops_decisions
  add column if not exists voice_call_log_id uuid references public.voice_call_logs(id);

-- Voice /call-result writes status='pending_review' | 'need_human_followup' (brief §3.3).
-- nullable, NO default / NO CHECK on purpose: existing manual rows stay status=NULL
-- untouched, and future statuses aren't blocked. Voice code always sets a valid value.
alter table public.ops_decisions
  add column if not exists status text;

create index if not exists ops_decisions_voice_call_log_idx
  on public.ops_decisions (voice_call_log_id);

comment on column public.ops_decisions.source is 'Origin of the decision: manual (default) | voice (SabAI).';
comment on column public.ops_decisions.voice_call_log_id is 'FK to voice_call_logs.id when source=voice. NULL for manual.';
comment on column public.ops_decisions.status is 'Review state for voice decisions: pending_review | need_human_followup. NULL for legacy/manual rows.';

-- ---------------------------------------------------------------------------
-- 5) RLS — server-only tables. Enable RLS with NO policies so anon/authenticated
--    are blocked; server routes use the service-role key (bypasses RLS).
-- ---------------------------------------------------------------------------
alter table public.call_queue        enable row level security;
alter table public.voice_call_logs   enable row level security;
alter table public.voice_consent_log enable row level security;

commit;

-- ============================================================================
-- ROLLBACK (manual, additive-safe). Review before running in prod.
-- ----------------------------------------------------------------------------
-- begin;
--   alter table public.ops_decisions drop column if exists status;
--   alter table public.ops_decisions drop column if exists voice_call_log_id;
--   alter table public.ops_decisions drop column if exists source;
--   drop trigger  if exists voice_consent_log_block_mutate on public.voice_consent_log;
--   drop function if exists public.voice_consent_log_no_mutate();
--   drop table if exists public.voice_consent_log;
--   drop table if exists public.voice_call_logs;   -- drop AFTER ops_decisions FK removed
--   drop table if exists public.call_queue;        -- drop AFTER voice_call_logs FK removed
-- commit;
-- ============================================================================
