# SabAI F1 Voice API — scaffold (stub + typed contract)

Surface between the AI Brain (orchestrator) and DocBrief. **Stub only** — no LiveKit/SIP,
no real dialing, no money/stock commits. Additive; touches only `app/api/voice/**` + this file.

> ⚠️ **Run the migration slice FIRST** (`20260806000000_sabai_f1_voice.sql`): tables
> `call_queue`, `voice_call_logs`, `voice_consent_log` + the `ops_decisions` alter must exist.
> The consent gate reads `voice_consent_log` **for real even in stub mode** — without the
> table it **fails closed** (`409 CONSENT_REQUIRED`), never fail-open. (brief §2.1)

## Feature flag
`SABAI_STUB_MODE` (default **true**) stubs the **orchestrator/telephony boundary only** — it
does **not** stub the database. Consent read/write + logging always hit real tables. Set
`SABAI_STUB_MODE=false` once the orchestrator is wired.

## Contract

| Endpoint | Method | Reads | Writes | Key guardrail |
|---|---|---|---|---|
| `/api/voice/context` | GET | contact_leads, businesses, orders, voice_consent_log | — | always returns `consent.granted` (dial gate) |
| `/api/voice/trigger-call` | POST | voice_consent_log, call_queue | call_queue | consent-first + fail-closed · idempotent on `idempotency_key` |
| `/api/voice/call-result` | POST | voice_call_logs, ops_decisions | voice_call_logs, ops_decisions | no orders/sales/stock write · idempotent on `voice_call_log_id` |
| `/api/voice/consent` | POST/GET | voice_consent_log | voice_consent_log (POST) | append-only; latest by `captured_at` |

Envelope: `{ ok: true, data }` or `{ ok: false, error: { code, message, details? } }`.
Codes: `VALIDATION_FAILED` 400 · `CONSENT_REQUIRED` 409 · `NOT_FOUND` 404 · `INTERNAL` 500.

**Catch #1** — no `customers` table: use `contact_lead_id` everywhere (seam: `CustomerRef` in `_shared/types.ts`). `customer_id` is rejected.
**Catch #2** — trigger decoupled from receive-ledger: `trigger_source='orders_ready_for_pickup'`, payloads carry `order_id` (seam: `TRIGGER_SOURCES` in `_shared/schema.ts`). `stock_movement_id` is rejected.

## curl (SABAI_STUB_MODE=true)
```bash
BASE=http://localhost:3000/api/voice

# 1) consent — grant first (real write) so trigger-call can pass
curl -s -X POST $BASE/consent -H 'content-type: application/json' -d '{
  "contact_lead_id":"<lead-uuid>","channel":"voice","granted":true,
  "consent_text_version":"v1","method":"ivr","captured_at":"2026-08-06T03:00:00Z"}'

# 2) context — everything the AI needs before dialing
curl -s "$BASE/context?contact_lead_id=<lead-uuid>&order_id=<order-uuid>"

# 3) trigger-call — enqueue (consent-gated, idempotent). Re-run same key → same id.
curl -s -X POST $BASE/trigger-call -H 'content-type: application/json' -d '{
  "idempotency_key":"demo-1","contact_lead_id":"<lead-uuid>","business_id":"<biz-uuid>",
  "order_id":"<order-uuid>","intent_type":"arrival_notify","trigger_source":"orders_ready_for_pickup"}'

# 4) call-result — orchestrator posts outcome; routes to review or inbox
curl -s -X POST $BASE/call-result -H 'content-type: application/json' -d '{
  "voice_call_log_id":"<vcl-uuid>","call_queue_id":"<cq-uuid>","contact_lead_id":"<lead-uuid>",
  "order_id":"<order-uuid>","outcome":"answered","intent":"confirmed","stt_confidence":0.92,
  "transcript_ref":"storage://calls/abc","duration_sec":42,"cost_thb":0.9}'

# consent status (GET)
curl -s "$BASE/consent?contact_lead_id=<lead-uuid>"
```
`trigger-call` without a granted consent → `409 CONSENT_REQUIRED`. `call-result` with
`intent=confirmed & stt_confidence≥0.85` → `routed_to:"review"`; otherwise `"inbox"`.

## Tests
```bash
node --test app/api/voice/_shared/*.test.ts
```
Covers: consent-gate incl. **fail-closed**, intent-routing thresholds, latest-by-captured_at,
idempotency decision, schema validation (incl. Catch #1/#2 forbidden fields), and a static
**no-auto-commit** scan (no voice route writes orders/sales_records/stock_movements).

## File tree
```
app/api/voice/
├── _shared/
│   ├── types.ts              # contract types (no runtime values)
│   ├── schema.ts             # validators + runtime enum arrays (Zod-substitute)
│   ├── guardrails.ts         # PURE logic: routeCallResult, consentAllows, latestConsent
│   ├── responses.ts          # envelope + HTTP mapping
│   ├── db.ts                 # service client + getLatestConsent (fail-closed) + stub mocks
│   ├── guardrails.test.ts
│   ├── schema.test.ts
│   └── no-auto-commit.test.ts
├── context/route.ts          # GET
├── trigger-call/route.ts     # POST
├── call-result/route.ts      # POST
└── consent/route.ts          # POST + GET
```

## Deviations & open items (report to owner)
- **Zod not used** — adding it edits `package.json` (outside this slice's file scope) and
  breaks "zero new dependency". `_shared/schema.ts` is a self-contained validator with a
  Zod-like contract; swap-in later is one file. (brief §1.2)
- **🔴 `ops_decisions.status` gap** — `/call-result` writes `status='pending_review'|'need_human_followup'`
  per brief §3.3, but the migration slice adds only `source` + `voice_call_log_id`. If
  `ops_decisions` has no `status` column, the insert fails in real mode. **Owner: confirm the
  column exists or extend the migration.** (`ops_decisions.topic` may also be NOT NULL — we set it.)
- **Testability & imports** — cross-module imports among `_shared` are `import type` only, so
  Node's test runner erases them and loads `guardrails.ts`/`schema.ts` standalone. Production
  imports are extensionless (tsc `moduleResolution: bundler`); tests use `.ts` (tsconfig excludes `*.test.ts`).
- **PK type assumption** — migration FKs assume `uuid` PKs on contact_leads/orders/businesses.
  Code evidence supports uuid; owner runs the `information_schema` check in the SQL header before applying.

## TODO markers left in code
- `context/route.ts` — normalize `phone_e164` to strict E.164 before dialing (orchestrator).
- `call-result/route.ts` — `ops_decisions.status` column assumption (see above).
- Retention: every new table has `created_at`; **90-day purge job not implemented** (brief §4).
- Real orchestrator/telephony wiring is out of scope until Case 0 closes (brief Gate).
