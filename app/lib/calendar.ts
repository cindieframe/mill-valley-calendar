// Shared "Add to Calendar" logic.
//
// Events store a date ("2026-10-20") and free-text times ("7:00 PM") that are
// always Pacific time. Everything here converts those into exact moments so
// calendar apps show the right time no matter where the viewer is.
//
// Used by: app/event/[id]/page.tsx (Google link + JSON-LD)
//          app/api/event/[id]/ics/route.ts (.ics file)

export const EVENT_TIMEZONE = 'America/Los_Angeles'
const SITE_URL = 'https://www.townstir.com'
const DEFAULT_DURATION_MINUTES = 60

export type CalendarEventInput = {
  id: string | number
  title: string
  date: string            // YYYY-MM-DD
  time?: string | null    // "7:00 PM", "All day", "7pm", "19:00", "7:00 PM - 9:00 PM" ...
  end_time?: string | null
  location?: string | null
  address?: string | null
  description?: string | null
  website?: string | null
  meeting_link?: string | null
  organization?: string | null
  town?: string | null
}

export type EventTiming =
  | { allDay: true; startDate: string; endDateExclusive: string }
  | { allDay: false; start: Date; end: Date; startIsoPacific: string; endIsoPacific: string }

// ---------- time parsing ----------

// Returns minutes after midnight, or null if the string isn't a clock time.
export function parseClockTime(raw: string | null | undefined): number | null {
  if (!raw) return null
  // Node's toLocaleTimeString inserts a narrow no-break space (U+202F) before AM/PM
  const s = raw.replace(/[\s  ]+/g, ' ').trim().toLowerCase()
  if (!s) return null

  // 12-hour: "7pm", "7 pm", "7:00 PM", "7:00 p.m."
  let m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s*m?\.?$/)
  if (m) {
    let h = Number(m[1])
    const min = m[2] ? Number(m[2]) : 0
    if (h < 1 || h > 12 || min > 59) return null
    if (m[3] === 'a' && h === 12) h = 0
    if (m[3] === 'p' && h !== 12) h += 12
    return h * 60 + min
  }

  // 24-hour: "19:00", "19:00:00"
  m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (m) {
    const h = Number(m[1])
    const min = Number(m[2])
    if (h > 23 || min > 59) return null
    return h * 60 + min
  }

  // Common words
  if (s === 'noon') return 12 * 60
  if (s === 'midnight') return 0

  return null
}

// Some imports store a range in the time field ("7:00 PM - 9:00 PM").
function splitRange(raw: string | null | undefined): [string, string | null] {
  if (!raw) return ['', null]
  const parts = raw.split(/\s*(?:–|—|-|\bto\b)\s*/i)
  if (parts.length === 2) return [parts[0], parts[1]]
  return [raw, null]
}

// ---------- Pacific <-> UTC ----------

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: EVENT_TIMEZONE,
  hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
})

// Offset of Pacific time from UTC at a given moment, in minutes (e.g. -420 in summer).
function pacificOffsetMinutes(utcMs: number): number {
  const p: Record<string, number> = {}
  for (const part of partsFormatter.formatToParts(new Date(utcMs))) {
    if (part.type !== 'literal') p[part.type] = Number(part.value)
  }
  const wallAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return Math.round((wallAsUtc - utcMs) / 60000)
}

// Converts a Pacific wall-clock time to the exact UTC moment (DST-aware).
export function pacificToUtc(date: string, minutesAfterMidnight: number): Date {
  const [y, mo, d] = date.split('-').map(Number)
  const wallMs = Date.UTC(y, mo - 1, d, 0, minutesAfterMidnight)
  let offset = pacificOffsetMinutes(wallMs)
  let utcMs = wallMs - offset * 60000
  // Re-check once in case the guess crossed a DST boundary
  const offset2 = pacificOffsetMinutes(utcMs)
  if (offset2 !== offset) {
    offset = offset2
    utcMs = wallMs - offset * 60000
  }
  return new Date(utcMs)
}

const pad = (n: number) => String(n).padStart(2, '0')

// "2026-10-20T19:00:00-07:00" — for JSON-LD
function toPacificIso(utc: Date): string {
  const offset = pacificOffsetMinutes(utc.getTime())
  const wall = new Date(utc.getTime() + offset * 60000)
  const sign = offset <= 0 ? '-' : '+'
  const abs = Math.abs(offset)
  return `${wall.getUTCFullYear()}-${pad(wall.getUTCMonth() + 1)}-${pad(wall.getUTCDate())}` +
    `T${pad(wall.getUTCHours())}:${pad(wall.getUTCMinutes())}:00${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
}

// "20261021T020000Z"
function toUtcStamp(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
}

function addDays(date: string, days: number): string {
  const [y, mo, d] = date.split('-').map(Number)
  const dt = new Date(Date.UTC(y, mo - 1, d + days))
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`
}

// ---------- timing ----------

export function getEventTiming(ev: Pick<CalendarEventInput, 'date' | 'time' | 'end_time'>): EventTiming {
  const [startRaw, rangeEndRaw] = splitRange(ev.time)
  const startMin = parseClockTime(startRaw)

  // No usable start time ("All day", "See organizer", blank, unparseable) → all-day event
  if (startMin === null) {
    return { allDay: true, startDate: ev.date, endDateExclusive: addDays(ev.date, 1) }
  }

  let endMin = parseClockTime(ev.end_time) ?? parseClockTime(rangeEndRaw)
  let endDate = ev.date
  if (endMin === null) {
    endMin = startMin + DEFAULT_DURATION_MINUTES
  } else if (endMin <= startMin) {
    // Ends after midnight (e.g. 10 PM – 1 AM)
    endDate = addDays(ev.date, 1)
  }

  const start = pacificToUtc(ev.date, startMin)
  const end = pacificToUtc(endDate, endMin)
  return {
    allDay: false,
    start,
    end,
    startIsoPacific: toPacificIso(start),
    endIsoPacific: toPacificIso(end),
  }
}

// ---------- shared text ----------

export function eventPageUrl(id: string | number): string {
  return `${SITE_URL}/event/${id}`
}

export function eventIcsUrl(id: string | number): string {
  return `/api/event/${id}/ics`
}

function locationText(ev: CalendarEventInput): string {
  const loc = (ev.location || '').trim()
  const addr = (ev.address || '').trim()
  if (loc && addr && !addr.toLowerCase().includes(loc.toLowerCase())) return `${loc}, ${addr}`
  return addr || loc || (ev.meeting_link ? 'Online' : '')
}

function detailsText(ev: CalendarEventInput, maxDescription?: number): string {
  let desc = (ev.description || '').trim()
  if (maxDescription && desc.length > maxDescription) {
    desc = desc.slice(0, maxDescription).replace(/\s+\S*$/, '') + '…'
  }
  const lines: string[] = []
  if (desc) lines.push(desc, '')
  if (ev.meeting_link) lines.push(`Join online: ${ev.meeting_link}`)
  if (ev.website) lines.push(`Website: ${ev.website}`)
  lines.push(`Details on Townstir: ${eventPageUrl(ev.id)}`)
  return lines.join('\n')
}

// ---------- Google Calendar ----------

export function googleCalendarUrl(ev: CalendarEventInput): string {
  const t = getEventTiming(ev)
  const dates = t.allDay
    ? `${t.startDate.replace(/-/g, '')}/${t.endDateExclusive.replace(/-/g, '')}`
    : `${toUtcStamp(t.start)}/${toUtcStamp(t.end)}`

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: ev.title,
    dates,
    ctz: EVENT_TIMEZONE,
    // Google's link breaks on very long URLs, so trim long descriptions
    details: detailsText(ev, 1000),
    location: locationText(ev),
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

// ---------- .ics (Apple Calendar, Outlook, etc.) ----------

function icsEscape(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

// RFC 5545: lines longer than 75 bytes are folded; never split a multi-byte character.
function foldLine(line: string): string {
  const encoder = new TextEncoder()
  if (encoder.encode(line).length <= 75) return line
  const out: string[] = []
  let current = ''
  let bytes = 0
  for (const ch of line) {
    const len = encoder.encode(ch).length
    const limit = out.length === 0 ? 75 : 74 // continuation lines start with a space
    if (bytes + len > limit) {
      out.push(current)
      current = ''
      bytes = 0
    }
    current += ch
    bytes += len
  }
  out.push(current)
  return out.join('\r\n ')
}

export function buildIcs(ev: CalendarEventInput, now: Date = new Date()): string {
  const t = getEventTiming(ev)
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Townstir//Townstir Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:event-${ev.id}@townstir.com`,
    `DTSTAMP:${toUtcStamp(now)}`,
    ...(t.allDay
      ? [
          `DTSTART;VALUE=DATE:${t.startDate.replace(/-/g, '')}`,
          `DTEND;VALUE=DATE:${t.endDateExclusive.replace(/-/g, '')}`,
        ]
      : [
          `DTSTART:${toUtcStamp(t.start)}`,
          `DTEND:${toUtcStamp(t.end)}`,
        ]),
    `SUMMARY:${icsEscape(ev.title)}`,
    `DESCRIPTION:${icsEscape(detailsText(ev))}`,
    ...(locationText(ev) ? [`LOCATION:${icsEscape(locationText(ev))}`] : []),
    `URL:${eventPageUrl(ev.id)}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.map(foldLine).join('\r\n') + '\r\n'
}

export function icsFileName(title: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
  return `${slug || 'event'}.ics`
}
