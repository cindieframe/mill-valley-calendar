import Anthropic from '@anthropic-ai/sdk'

// The ONE list of categories and tags every importer uses.
// Keys match the Post Event form and the calendar filters. When you add or
// change a category or tag, change it here and every importer follows.
export const CATEGORY_GUIDE: { key: string; means: string }[] = [
  { key: 'outdoors',  means: 'hikes, sports, yoga, fitness, nature walks, running, martial arts, dance' },
  { key: 'arts',      means: 'concerts, live music, theater, film, art shows, open studios, performances' },
  { key: 'food',      means: 'farmers markets, food and drink events, wine tastings, mixers, potlucks, trivia nights' },
  { key: 'community', means: 'volunteering, cleanups, neighborhood and nonprofit events, town celebrations' },
  { key: 'family',    means: 'kids, children, youth, teens, storytime, school and family activities' },
  { key: 'classes',   means: 'workshops, lectures, lessons, classes, demos, talks, learning' },
  { key: 'gov',       means: 'city council, planning, commissions, town halls, public hearings' },
]

export const TAG_GUIDE: { key: string; means: string }[] = [
  { key: 'free',      means: 'free to attend' },
  { key: 'family',    means: 'aimed at kids and families (storytime, kids activities, family days) — not just any social or adult event' },
  { key: 'wellness',  means: 'health or wellness focused' },
  { key: 'reg',       means: 'registration or tickets required in advance' },
  { key: 'volunteer', means: 'a volunteering opportunity' },
  { key: 'music',     means: 'LIVE MUSIC performance for an audience: musicians, a band, singer, DJ set, jazz/folk/rock night, concert, or open mic with music. NOT music lessons or classes, kids sing-alongs or music-and-movement sessions, lectures about music, or film screenings' },
]

const CATEGORY_KEYS = new Set(CATEGORY_GUIDE.map(c => c.key))
const TAG_KEYS = new Set(TAG_GUIDE.map(t => t.key))
const ALIASES: Record<string, string> = { youth: 'family', kids: 'family', 'live music': 'music', 'live-music': 'music' }

// Text block for any AI prompt that assigns categories/tags.
export function categoryPromptGuide(): string {
  return `Categories (pick all that apply, comma-separated keys):
${CATEGORY_GUIDE.map(c => `- ${c.key} (${c.means})`).join('\n')}

Tags (pick all that apply, comma-separated keys, or none):
${TAG_GUIDE.map(t => `- ${t.key} (${t.means})`).join('\n')}

Any event with the "music" tag also gets the "arts" category.
Use only the keys listed above.`
}

function cleanList(raw: unknown, valid: Set<string>): string[] {
  const parts = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',') : []
  const out: string[] = []
  for (const p of parts) {
    const k = String(p).trim().toLowerCase()
    const key = ALIASES[k] ?? k
    if (valid.has(key) && !out.includes(key)) out.push(key)
  }
  return out
}

// Keeps only real keys, so invented ones (e.g. "senior") are dropped.
export function cleanCategories(raw: unknown): string {
  const cats = cleanList(raw, CATEGORY_KEYS)
  return (cats.length ? cats : ['community']).join(',')
}

export function cleanTags(raw: unknown): string {
  return cleanList(raw, TAG_KEYS).join(',')
}

// Free, deterministic rule: events that say they are live music are live
// music, whatever the AI answered (or if the AI call failed).
const LIVE_MUSIC_WORDS = /\blive music\b|\bconcerts?\b|\blive band\b|\bband\b.*\b(plays?|performs?|performance|live)\b|\bopen mic\b|\bmusic performance\b/i
const NOT_LIVE_MUSIC = /\b(lessons?|class(es)?|workshop|lecture|sing[- ]?along|storytime|music (and|&) movement)\b/i

export function looksLikeLiveMusic(text: string): boolean {
  return LIVE_MUSIC_WORDS.test(text) && !NOT_LIVE_MUSIC.test(text)
}

// Applies the live-music rule, and music → arts.
export function finalize(categories: string, tags: string, text = ''): { categories: string; tags: string } {
  const cats = categories.split(',').filter(Boolean)
  const tagList = tags.split(',').filter(Boolean)
  if (text && looksLikeLiveMusic(text) && !tagList.includes('music')) tagList.push('music')
  if (tagList.includes('music') && !cats.includes('arts')) cats.push('arts')
  return { categories: cats.join(','), tags: tagList.join(',') }
}

// Retries with backoff when the API is busy or rate-limited.
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 5 })

// Small, cheap model: classification only. ~$0.0005 per event.
const CATEGORIZE_MODEL = 'claude-haiku-4-5-20251001'

export async function categorizeEvent(ev: {
  title: string
  description?: string | null
  organization?: string | null
  location?: string | null
  town?: string | null
}): Promise<{ categories: string; tags: string; ok: boolean }> {
  const text = `${ev.title} ${ev.description || ''}`
  try {
    const prompt = `You are categorizing a community event for a local events calendar${ev.town ? ` in ${ev.town}, CA` : ''}.

Event title: ${ev.title}
Organization: ${ev.organization || 'unknown'}
Venue: ${ev.location || 'unknown'}
Description: ${ev.description || 'No description provided'}

${categoryPromptGuide()}

Respond in this exact format:
CATEGORIES: key1,key2
TAGS: key1,key2`

    const response = await anthropic.messages.create({
      model: CATEGORIZE_MODEL,
      max_tokens: 60,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const catMatch = text.match(/CATEGORIES:\s*([^\n]*)/)
    const tagMatch = text.match(/TAGS:\s*([^\n]*)/)
    return { ...finalize(cleanCategories(catMatch?.[1]), cleanTags(tagMatch?.[1]), text), ok: true }
  } catch (err) {
    // ok: false lets callers report it instead of failing silently.
    console.error('Categorization failed for:', ev.title, err)
    return { ...finalize('community', '', text), ok: false }
  }
}
