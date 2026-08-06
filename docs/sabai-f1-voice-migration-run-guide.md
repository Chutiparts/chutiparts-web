# SabAI F1 Voice — Migration Run Guide (STAGING)

Owner-run guide for `20260806000000_sabai_f1_voice.sql` (currently in `~/Downloads/`).

> ⚠️ **STAGING ONLY — `gccytdbydtmsqzvoibcz`.** Do **NOT** run on prod (`qaqawfvbaqyznuuecfp`).
> Voice tables do not go to prod until the real pilot, after the ledger cutover + Case 0.
> Run everything below in the **staging** project's Supabase SQL Editor.

The migration is **additive** (3 new tables + 3 additive columns on `ops_decisions`, all
`if not exists`; RLS enabled with no policies). It touches nothing existing. Safe rollback
block is at the bottom of the .sql file.

---

## Step 0 — Precheck (run BEFORE apply)

Confirms the FK type assumption (uuid) and that `status` isn't already there.

```sql
-- A) PK types of the referenced tables — ALL must be 'uuid'
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('businesses','contact_leads','orders')
  and column_name = 'id'
order by table_name;

-- B) ops_decisions.status must NOT exist yet (expect 0 rows)
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'ops_decisions' and column_name = 'status';
```

**Pass criteria:**
- (A) returns 3 rows, every `data_type = uuid`.
  → If any is `bigint`/`integer`/`text`: **stop.** Change the matching FK column type in the
    .sql (`contact_lead_id`, `order_id`, `business_id`) to match BEFORE apply, or the
    `references` clauses fail. (Header of the .sql documents this.)
- (B) returns **0 rows** (column absent). If it already exists, the `add column if not exists`
  is a harmless no-op — just note it.

---

## Step 1 — Apply

Paste the full contents of `20260806000000_sabai_f1_voice.sql` into the **staging** SQL Editor
and run. It executes inside `begin; … commit;`. Expect success with no errors.

---

## Step 2 — Validate (run AFTER apply)

```sql
-- A) the 3 new tables exist (expect 3 rows)
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('call_queue','voice_call_logs','voice_consent_log')
order by table_name;

-- B) ops_decisions gained all 3 columns (expect 3 rows)
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'ops_decisions'
  and column_name in ('source','voice_call_log_id','status')
order by column_name;

-- C) append-only trigger on the consent ledger exists (expect 1 row)
select tgname from pg_trigger where tgname = 'voice_consent_log_block_mutate';

-- D) RLS enabled on the 3 server-only tables (expect rowsecurity = true for all)
select relname, relrowsecurity
from pg_class
where relname in ('call_queue','voice_call_logs','voice_consent_log')
order by relname;
```

**Pass criteria:** (A) 3 tables · (B) `source` not-null, `voice_call_log_id` nullable uuid,
`status` nullable text · (C) trigger present · (D) all `true`.

Optional sanity — the consent ledger is truly append-only (should raise an exception):
```sql
-- expect ERROR: voice_consent_log is append-only (PDPA audit): UPDATE is not allowed
update public.voice_consent_log set granted = false where id = gen_random_uuid();
```

---

## Step 3 — Code checks (local, against staging)

```bash
# unit tests (no DB needed) — must stay green
node --test app/api/voice/_shared/*.test.ts        # 26/26

# curl smoke — needs a dev server whose env points at STAGING:
#   NEXT_PUBLIC_SUPABASE_URL = https://gccytdbydtmsqzvoibcz.supabase.co
#   SUPABASE_SECRET_KEY      = <staging service-role key>
#   SABAI_STUB_MODE=true     (default; no dialing)
npm run dev
# then follow README.voice.md "curl" — use REAL staging contact_lead / order / business ids.
```

Expected smoke behaviour (stub mode, real staging DB):
- `POST /consent` (granted) → `{ ok:true, data:{ consent_id, granted:true } }` (real row written)
- `GET /context?contact_lead_id=…` → consent.granted reflects the row just written
- `POST /trigger-call` **without** a granted consent → `409 CONSENT_REQUIRED` (fail-closed)
- `POST /trigger-call` **with** granted consent → `{ call_queue_id, status:"queued" }` (real row)
- `POST /call-result` (`intent=confirmed`, `stt_confidence≥0.85`) → `routed_to:"review"`;
  writes `voice_call_logs` + `ops_decisions(source='voice', status='pending_review')`, nothing else.

---

## Rollback (staging, if needed)

Uncomment and run the ROLLBACK block at the bottom of the .sql (drops `status`, then
`voice_call_log_id`, `source`, the trigger/function, then the 3 tables in FK-safe order).

---

## Notes
- Migration SQL is kept in `~/Downloads/`, not version-controlled (project convention: owner
  runs SQL in the Supabase SQL Editor). To track it in-repo under `supabase/migrations/`, see
  the design-review packet §4 — ask first.
- `SABAI_STUB_MODE=false` (real orchestrator/dialing) stays OFF until Owner provides credentials
  and Case 0 closes (gate).
