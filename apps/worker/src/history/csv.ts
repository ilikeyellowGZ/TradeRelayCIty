import { redactSensitiveText } from './model'

export function sanitizeCsvCell(input: unknown): string {
  const value = input === null || input === undefined ? '' : redactSensitiveText(String(input))
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe
}

export function serializeHistoryCsv(rows: Record<string, unknown>[]) {
  const columns = ['id', 'version', 'symbol', 'side', 'orderType', 'volume', 'entryTime', 'exitTime', 'averageEntryPrice', 'averageExitPrice', 'grossPnl', 'commission', 'swap', 'otherCosts', 'netPnl', 'currency', 'status', 'outcome', 'source', 'exitReason']
  return [columns.join(','), ...rows.map((row) => columns.map((column) => sanitizeCsvCell(row[column])).join(','))].join('\r\n') + '\r\n'
}
