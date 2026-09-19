// docs/backups.md
import { basename } from 'node:path'

export type Counts = Record<string, number>

export const COUNT_QUERY = `select table_schema || '.' || table_name || '|' ||
  (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text
from information_schema.tables
where table_type = 'BASE TABLE' and table_schema not in ('pg_catalog', 'information_schema')
order by 1;`

export function backupName(database: string, now: Date): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15)
  return `${database}-${stamp}.dump`
}

export function parseCounts(output: string): Counts {
  const counts: Counts = {}
  for (const line of output.split('\n')) {
    const [table, value] = line.trim().split('|')
    if (table && value !== undefined && /^\d+$/.test(value)) counts[table] = Number(value)
  }
  return counts
}

export type Difference = { table: string; expected: number | null; restored: number | null }

export function compareCounts(expected: Counts, restored: Counts): Difference[] {
  const tables = [...new Set([...Object.keys(expected), ...Object.keys(restored)])].sort()
  return tables
    .filter((t) => expected[t] !== restored[t])
    .map((t) => ({ table: t, expected: expected[t] ?? null, restored: restored[t] ?? null }))
}

export function backupsToPrune(files: string[], database: string, keep: number): string[] {
  const ours = files
    .filter((f) => basename(f).startsWith(`${database}-`) && f.endsWith('.dump'))
    .sort()
  return keep > 0 ? ours.slice(0, Math.max(0, ours.length - keep)) : []
}
