# SabAI F1 Voice — Design Review Packet (scaffold slice)

**Status:** prep complete · **NOT merged / NOT deployed** · awaiting design-team review + gate
**Branch:** `sabai-f1-voice-scaffold` (off `main`)
**Commits:** `91737ce` (scaffold) → `19b2e6a` (close ops_decisions.status gap)
**Date:** 6 ส.ค. 2026 · **Contract detail + curl:** [README.voice.md](../README.voice.md)

> This is a permanent hand-off record. Scope of this slice = **API scaffold only** (stub +
> typed contract). No orchestrator/SIP, no real dialing, no money/stock commit. Additive;
> touches only `app/api/voice/**` + `README.voice.md`. The DB migration (slice ค) is a
> separate owner-run SQL file (`~/Downloads/20260806000000_sabai_f1_voice.sql`).

---

## 1. What was built

4 route handlers + a shared layer + tests (902 lines, 13 files):

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/voice/context` | GET | Everything the AI needs before dialing (customer, business, order, consent) |
| `/api/voice/trigger-call` | POST | Enqueue an outbound call (consent-gated, idempotent). Does **not** dial |
| `/api/voice/call-result` | POST | Orchestrator posts outcome → logs cost + creates a human-review decision |
| `/api/voice/consent` | POST/GET | PDPA ม.19 append-only consent ledger |

Shared: `types` (contract types) · `schema` (validators + enum arrays) · `guardrails` (pure
logic) · `responses` (envelope) · `db` (service client + fail-closed consent lookup).

---

## 2. Design decisions the team should ratify

### 2.1 The two "Catches" (each reversible at ONE seam)
- **Catch #1 — no `customers` table.** DocBrief uses `contact_leads` as the customer. Every
  endpoint refers to the customer by **`contact_lead_id`**. `customer_id` is actively rejected.
  → Seam to change identity model later: `CustomerRef` in `_shared/types.ts`.
- **Catch #2 — arrival trigger decoupled from the receive-ledger** (which isn't live). F1
  triggers off **`orders.status='ready_for_pickup'`**, payloads carry **`order_id`**;
  `stock_movement_id` is rejected. → Seam: `TRIGGER_SOURCES` in `_shared/schema.ts`.

**Decision needed:** confirm both defaults, or tell us which seam to flip.

### 2.2 Stub scope — DB is real, only the orchestrator is stubbed
`SABAI_STUB_MODE` (default `true`) stubs the **telephony/orchestrator boundary only**. Consent
read/write and logging always hit **real tables**. There is no "stub consent" — the consent
gate runs for real even in stub mode. **Decision needed:** confirm this is the intended safety posture.

### 2.3 Validation without Zod (deviation from brief)
Brief named Zod, but adding it edits `package.json`/lockfile — outside this slice's file scope
and against its "zero new dependency" intent. `_shared/schema.ts` is a self-contained validator
with a Zod-like `safeParse` contract (swap-in is one file). **Decision needed:** keep the
self-contained validator, or approve adding `zod` as a real dependency.

---

## 3. Guardrails implemented in code (not just comments) — with tests

| Guardrail | Behaviour | Test |
|---|---|---|
| **Consent-first, FAIL-CLOSED** | No granted consent, or consent table unreadable → `409 CONSENT_REQUIRED`. Never fail-open. | ✅ `guardrails.test` |
| **Human-in-loop routing** | clear intent (`confirmed/declined/reschedule`) ∧ `stt_confidence≥0.85` → `review` (`pending_review`); else → `inbox` (`need_human_followup`) | ✅ `guardrails.test` |
| **No money/stock auto-commit** | `/call-result` writes only `voice_call_logs` + `ops_decisions`. Static source scan asserts no write to `orders`/`sales_records`/`stock_movements` | ✅ `no-auto-commit.test` |
| **Idempotency** | `/trigger-call` on `idempotency_key`, `/call-result` on `voice_call_log_id` — reuse existing, no double insert | ✅ decision logic tested; full integration test needs live DB |
| **Consent latest-by-captured_at** | append-only; newest `captured_at` wins (revocation respected) | ✅ `guardrails.test` |
| **Input validation** | bad payload → `400 VALIDATION_FAILED`; Catch #1/#2 forbidden fields rejected | ✅ `schema.test` |
| **Data residency** | store only `transcript_ref`, never inline audio/transcript | code + README |
| **Cost log every call** | `cost_thb` written on every `/call-result` | code |

Run: `node --test app/api/voice/_shared/*.test.ts` → **26/26 pass**. `tsc --noEmit` clean for voice.

---

## 4. Migration dependency (slice ค — owner-run)

The scaffold assumes these exist BEFORE real mode: `call_queue`, `voice_call_logs`,
`voice_consent_log`, and `ops_decisions` gains `source`, `voice_call_log_id`, **`status`**.

- **✅ `ops_decisions.status` gap — closed.** Builder verified the column didn't exist (would
  crash real-mode `/call-result`). Migration now adds `add column if not exists status text`
  (nullable, no default/CHECK — legacy manual rows stay NULL, future statuses not blocked).
- **PK types:** FKs assume `uuid` on contact_leads/orders/businesses. Code evidence supports
  uuid (orders.id sliced as hex ref; lead id typed string). The SQL header has an
  `information_schema` check the owner runs on prod before applying — **please confirm `businesses`**.
- The migration SQL is kept in `~/Downloads/`, **not** in the repo, per project convention
  (owner runs it in the Supabase SQL Editor). Flag if you want it version-controlled under `supabase/migrations/`.

---

## 5. Open questions for the design team

1. Ratify Catch #1 (`contact_lead_id`) and Catch #2 (`orders.ready_for_pickup` / `order_id`).
2. Keep the self-contained validator, or add `zod`?
3. Confirm stub posture (DB real, orchestrator stubbed, consent gate always live + fail-closed).
4. `ops_decisions.status` values — is `pending_review | need_human_followup` the final vocabulary,
   or should we add a CHECK constraint once the set is frozen? (left unconstrained for now on purpose.)
5. Retention: 90-day purge job is a documented TODO, not implemented. Owner of that job?
6. Confirm `businesses.id` is uuid (only table without a clear code tell).

---

## 6. Not done (by design) / gate

Forbidden until Case 0 (ChutiBenz) closes its final test round: real orchestrator wiring, real
SIP dialing, real pilot-data wiring, `SABAI_STUB_MODE=false` in prod. This slice was allowed to
proceed in parallel **only** because it is stub-only and zero-impact. Merge happens later, with
the migration, after cutover + Case 0.

---

## 7. How to review

```bash
git checkout sabai-f1-voice-scaffold
node --test app/api/voice/_shared/*.test.ts   # 26/26
# read README.voice.md for the full contract + curl examples
git diff main..sabai-f1-voice-scaffold
```

File tree:
```
app/api/voice/
├── _shared/  types · schema · guardrails · responses · db  (+ 3 *.test.ts)
├── context/route.ts        GET
├── trigger-call/route.ts   POST
├── call-result/route.ts    POST
└── consent/route.ts        POST + GET
README.voice.md             contract table + curl + deviations/TODOs
```
