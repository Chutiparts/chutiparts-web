// app/api/voice/_shared/no-auto-commit.test.ts
// Guardrail §4/§7.1: NO voice route may WRITE to orders / sales_records / stock_movements.
// Static source scan (a write path must never exist, in any branch). Reads are allowed
// (e.g. /context reads orders), so we only flag mutating chained calls.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const routes = ['context', 'trigger-call', 'call-result', 'consent']
const FORBIDDEN = ['orders', 'sales_records', 'stock_movements']
const MUTATORS = ['insert', 'update', 'delete', 'upsert']

function source(routeDir: string): string {
  // _shared/ -> ../<routeDir>/route.ts
  return readFileSync(join(import.meta.dirname, '..', routeDir, 'route.ts'), 'utf8')
}

test('no voice route writes to orders/sales_records/stock_movements', () => {
  for (const r of routes) {
    const src = source(r)
    for (const table of FORBIDDEN) {
      for (const m of MUTATORS) {
        // matches: .from('orders') ... .insert(  (allowing whitespace/newlines between)
        const re = new RegExp(`\\.from\\(['"\`]${table}['"\`]\\)[\\s\\S]{0,80}?\\.${m}\\(`)
        assert.ok(!re.test(src), `${r}/route.ts must not ${m} into ${table}`)
      }
    }
  }
})

test('call-result writes only voice_call_logs + ops_decisions', () => {
  const src = source('call-result')
  const writes = [...src.matchAll(/\.from\(['"`]([a-z_]+)['"`]\)[\s\S]{0,80}?\.(insert|update|delete|upsert)\(/g)].map((m) => m[1])
  for (const t of writes) {
    assert.ok(['voice_call_logs', 'ops_decisions'].includes(t), `call-result unexpectedly writes ${t}`)
  }
})
