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
  { key: 'family',    means: 'family-friendly' },
  { key: 'wellness',  means: 'health or wellness focused' },
  { key: 'reg',       means: 'registration or tickets required in advance' },
  { key: 'volunteer', means: 'a volunteering opportunity' },
  { key: 'music',     means: 'LIVE MUSIC: musicians, a band, singer, DJ set, jazz/folk/rock night, concert, or open mic with music. NOT music lessons, lectures about music, or film screenings' },
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

// Music tag implies the arts category.
export function finalize(categories: string, tags: string): { categories: string; tags: string } {
  const cats = categories.split(',').filter(Boolean)
  if (tags.split(',').includes('music') && !cats.includes('arts')) cats.push('arts')
  return { categories: cats.join(','), tags }
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Small, cheap model: classification only. ~$0.0005 per event.
const CATEGORIZE_MODEL = 'claude-haiku-4-5-20251001'

export async function categorizeEvent(ev: {
  title: string
  description?: string | null
  organization?: string | null
  location?: string | null
  town?: string | null
}): Promise<{ categories: string; tags: string }> {
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
    return finalize(cleanCategories(catMatch?.[1]), cleanTags(tagMatch?.[1]))
  } catch (err) {
    console.error('Categorization failed for:', ev.title, err)
    return { categories: 'community', tags: '' }
  }
}
