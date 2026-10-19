// Squarespace event pages as a feed source.
//
// Many orgs use Squarespace, which has no full iCal feed. But their public
// events page (list view) contains every upcoming event in the HTML, so we read
// that page directly — one request per org, no AI, no Browserless.
//
// We deliberately do NOT use Squarespace's ?format=json or ?format=ical URLs:
// Squarespace's robots.txt disallows them for automated tools. Plain event
// pages are allowed.
//
// Times are read exactly as displayed on the page and treated as Pacific time.
// (Some sites have the wrong site timezone set — e.g. Arizona — so converting
// from Squarespace's UTC timestamps would be off by an hour in winter.)
//
// Used by: app/api/import-ical (sync + manual import),
//          app/api/extract-events, app/api/discover-orgs/helpers.ts

import { parseClockTime, EVENT_TIMEZONE } from './calendar'

const UA = 'Mozilla/5.0 (compatible; Townstir/1.0; +https://www.townstir.com)'

const EVENT_PATH_WORDS = [
  'event', 'calendar', 'whats-on', 'what-s-on', 'shows', 'concert',
  'happening', 'upcoming', 'schedule',
]
const SKIP_PATH_WORDS = ['private', 'rental', 'wedding', 'catering', 'past']

// Same shape the iCal parser produces, plus a separate address and source uid.
export type FeedEvent = {
  summary: string
  description: string
  location: string
  address?: string
  dateStr: string      // YYYY-MM-DD (Pacific)
  timeStr: string      // "7:00 PM" or "All day"
  endTimeStr: string   // "9:00 PM" or ''
  url: string
  image: string
  uid: string
}

export const SQUARESPACE_UID_PREFIX = 'squarespace:'

// ---------- detection ----------

export function isSquarespaceHtml(html: string): boolean {
  return html.includes('This is Squarespace.') ||
    html.includes('SQUARESPACE_CONTEXT') ||
    html.includes('static1.squarespace.com')
}

// True only for a Squarespace events collection page in list view.
export function isSquarespaceEventList(html: string): boolean {
  return isSquarespaceHtml(html) && /<article[^>]+class="[^"]*\beventlist-event\b/.test(html)
}

async function fetchHtml(url: string, timeoutMs = 10000): Promise<{ html: string; finalUrl: string } | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) return null
    if (!(res.headers.get('content-type') || '').includes('html')) return null
    return { html: await res.text(), finalUrl: res.url || url }
  } catch {
    return null
  }
}

// Given any page on a site (homepage or events page), returns the URL of its
// Squarespace event list page, or null if the site isn't Squarespace or has none.
export async function findSquarespaceEventList(url: string, prefetchedHtml?: string): Promise<string | null> {
  let html = prefetchedHtml
  let pageUrl = url
  if (!html) {
    const page = await fetchHtml(url)
    if (!page) return null
    html = page.html
    pageUrl = page.finalUrl
  }
  if (!isSquarespaceHtml(html)) return null
  if (isSquarespaceEventList(html)) return pageUrl

  let origin: string
  try { origin = new URL(pageUrl).origin } catch { return null }

  // Candidate pages: /events plus nav links whose path looks like an events page
  const candidates = new Set<string>([`${origin}/events`, `${origin}/calendar`])
  for (const m of html.matchAll(/href=["']([^"'#?]+)["']/gi)) {
    let href = m[1]
    if (href.startsWith('/')) href = origin + href
    if (!href.startsWith(origin + '/')) continue
    const path = href.slice(origin.length).toLowerCase().replace(/\/$/, '')
    const depth = path.split('/').filter(Boolean).length
    if (depth === 0 || depth > 2) continue
    if (SKIP_PATH_WORDS.some(w => path.includes(w))) continue
    if (EVENT_PATH_WORDS.some(w => path.includes(w))) candidates.add(origin + path)
  }

  const checks = await Promise.all(
    [...candidates].slice(0, 8).map(async c => {
      const page = await fetchHtml(c, 8000)
      return page && isSquarespaceEventList(page.html) ? page.finalUrl : null
    })
  )
  return checks.find(Boolean) || null
}

// ---------- parsing ----------

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…',
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
}

function textOf(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/[\s ]+/g, ' ').trim()
}

// HTML → readable text with paragraph breaks
function htmlToText(html: string): string {
  const text = decodeEntities(
    html
      .replace(/<(script|style|svg|figure|noscript)[\s\S]*?<\/\1>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|h[1-6]|li|ul|ol|blockquote)>/gi, '\n\n')
      .replace(/<li[^>]*>/gi, '• ')
      .replace(/<[^>]+>/g, '')
  )
  return text
    .split('\n')
    .map(l => l.replace(/[ \t ]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function formatClock(minutes: number): string {
  const h24 = Math.floor(minutes / 60)
  const m = minutes % 60
  const h12 = h24 % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july',
  'august', 'september', 'october', 'november', 'december']

// "Wednesday, September 16, 2026" → "2026-09-16" (all matches, in order)
function datesFromText(text: string): string[] {
  const out: string[] = []
  const re = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})/gi
  for (const m of text.matchAll(re)) {
    const mi = MONTHS.findIndex(mn => mn.startsWith(m[1].toLowerCase().slice(0, 3)))
    if (mi >= 0) out.push(`${m[3]}-${String(mi + 1).padStart(2, '0')}-${String(Number(m[2])).padStart(2, '0')}`)
  }
  return out
}

function longDate(date: string): string {
  return new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', {
    timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric',
  })
}

function todayPacific(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: EVENT_TIMEZONE })
}

function parseArticle(article: string, pageUrl: string): FeedEvent | null {
  // Title + link
  const titleMatch =
    article.match(/<a[^>]+href="([^"]+)"[^>]*class="[^"]*eventlist-title-link[^"]*"[^>]*>([\s\S]*?)<\/a>/i) ||
    article.match(/<h1[^>]*class="[^"]*(?:eventlist-title|entry-title)[^"]*"[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i)
  if (!titleMatch) return null
  const title = textOf(titleMatch[2])
  if (!title) return null

  let link: URL
  try { link = new URL(decodeEntities(titleMatch[1]), pageUrl) } catch { return null }

  // Only look at the header/meta part for dates & times (not the description)
  const descStart = article.search(/class="[^"]*(eventlist-excerpt|eventlist-description)/)
  const meta = descStart > 0 ? article.slice(0, descStart) : article

  // Dates: <time class="event-date" datetime="YYYY-MM-DD"> (current templates)
  let dates = [...meta.matchAll(/<time[^>]*class="[^"]*\bevent-date\b[^"]*"[^>]*datetime="(\d{4}-\d{2}-\d{2})"/gi)].map(m => m[1])
  // Older templates: date written out as text
  if (dates.length === 0) {
    const heading = meta.match(/class="[^"]*eventlist-meta-date[^"]*"[^>]*>([\s\S]*?)<\/time>/i)
    dates = datesFromText(heading ? textOf(heading[1]) : textOf(meta))
  }
  if (dates.length === 0) return null
  const startDate = dates[0]
  const endDate = dates.length > 1 ? dates[dates.length - 1] : startDate
  const multiDay = endDate !== startDate

  // Times: displayed 12-hour times, in order (start, end). 24-hour duplicates are
  // skipped. Older templates put the whole range in one element ("6:00pm – 8:00pm").
  const times: number[] = []
  for (const m of meta.matchAll(/<time[^>]*class="[^"]*\bevent-time[^"]*"[^>]*>([\s\S]*?)<\/time>/gi)) {
    for (const t of textOf(m[1]).matchAll(/\d{1,2}(?::\d{2})?\s*[ap]\.?\s*m\.?/gi)) {
      const mins = parseClockTime(t[0])
      if (mins !== null) times.push(mins)
    }
  }
  const timeStr = times.length ? formatClock(times[0]) : 'All day'
  const endTimeStr = times.length > 1 && !multiDay ? formatClock(times[1]) : ''

  // Location: venue text + "(map)" link with the full address
  let venue = ''
  let address = ''
  const addrBlock = meta.match(/<(li|p)[^>]*class="[^"]*eventlist-meta-address[^"]*"[^>]*>([\s\S]*?)<\/\1>/i)
  if (addrBlock) {
    const inner = addrBlock[2]
    const mapMatch = inner.match(/href="https?:\/\/maps\.google\.com\?q=([^"]*)"/i)
    const clean = (s: string) => s
      .replace(/\s*,?\s*United States\s*$/i, '')
      .replace(/\s+/g, ' ')
      .replace(/^\s*,\s*/, '')
      .trim()
    venue = clean(textOf(inner.replace(/<a[^>]*maps\.google[\s\S]*?<\/a>/gi, '')))
    if (mapMatch) {
      let q = mapMatch[1]
      try { q = decodeURIComponent(q.replace(/\+/g, ' ')) } catch { /* keep raw */ }
      address = clean(decodeEntities(q))
    }
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
    // Venue is just the street ("750 Bridgeway") and the map link has only the
    // city ("Sausalito, CA, 94965") → combine into one full address.
    if (venue && address && /^\d/.test(venue) &&
        !norm(address).includes(norm(venue)) && !norm(venue).includes(norm(address))) {
      address = `${venue}, ${address}`
    }
  }

  // Description: short excerpt if present, otherwise the full description.
  // Start after the opening tag's ">" so no attribute text leaks in.
  let description = ''
  if (descStart > 0) {
    const bodyStart = article.indexOf('>', descStart) + 1
    let body = article.slice(bodyStart)
    const stop = body.search(/<a[^>]*class="[^"]*eventlist-button|<\/article>/i)
    if (stop >= 0) body = body.slice(0, stop)
    description = htmlToText(body)
  }
  description = description.replace(/^View Event\s*→?\s*$/gim, '').trim().slice(0, 5000)
  if (multiDay) description = `Runs through ${longDate(endDate)}.${description ? '\n\n' + description : ''}`

  // Image: first Squarespace-hosted image in the event card
  const img = article.match(/data-(?:image|src)="(https:\/\/images\.squarespace-cdn\.com\/[^"]+)"/i)

  return {
    summary: title,
    description,
    location: venue || address,
    address: address || venue,
    dateStr: startDate,
    timeStr,
    endTimeStr,
    url: link.href,
    image: img ? decodeEntities(img[1]) : '',
    uid: `${SQUARESPACE_UID_PREFIX}${link.host.replace(/^www\./, '')}${link.pathname.replace(/\/$/, '')}`,
  }
}

// Parses every upcoming event from a Squarespace event list page.
export function parseSquarespaceEvents(html: string, pageUrl: string, today = todayPacific()): FeedEvent[] {
  const events: FeedEvent[] = []
  const seen = new Set<string>()
  const articles = html.match(/<article[^>]+class="[^"]*\beventlist-event\b[\s\S]*?<\/article>/gi) || []
  for (const article of articles) {
    const ev = parseArticle(article, pageUrl)
    if (!ev || ev.dateStr < today || seen.has(ev.uid)) continue
    seen.add(ev.uid)
    events.push(ev)
  }
  return events.sort((a, b) => a.dateStr.localeCompare(b.dateStr))
}
