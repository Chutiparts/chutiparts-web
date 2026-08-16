export type SyncResult = {
  ok: boolean
  error?: string
  message?: string
  rows_fetched?: number
  rows_published?: number
  rows_inserted?: number
  rows_updated?: number
  rows_upserted?: number
  skipped_rows?: { sku: string; reason: string }[]
}
