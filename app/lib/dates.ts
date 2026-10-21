// Calendar dates in Pacific time, as 'YYYY-MM-DD'.
// Never use new Date().toISOString().split('T')[0] for "today": that is the
// UTC date, which is already tomorrow from 5 PM Pacific (4 PM in winter).

export const TZ = 'America/Los_Angeles'

export function todayPT(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ })
}

// Pure date-string arithmetic (no time zones involved).
export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + days))
  return t.toISOString().slice(0, 10)
}

// 0 = Sunday … 6 = Saturday
export function dayOfWeek(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

// A Date at noon for display formatting (safe in any viewer's time zone).
export function noonDate(dateStr: string): Date {
  return new Date(dateStr + 'T12:00:00')
}
