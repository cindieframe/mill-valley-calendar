import { supabase } from '../supabase'

export type Town = { name: string; slug: string }

export async function loadTowns(): Promise<Town[]> {
  const { data, error } = await supabase.from('towns').select('name, slug')
  if (error || !data) return []
  return data as Town[]
}

// Matches any town value we receive — "San Rafael", "san-rafael",
// "San Anselmo, CA" — against the `towns` table.
export function matchTown(towns: Town[], input: unknown): Town | null {
  if (typeof input !== 'string' || !input.trim()) return null
  const base = input.trim().replace(/,\s*[A-Za-z]{2}$/, '').trim().toLowerCase()
  const asSlug = base.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return towns.find(t =>
    t.name?.toLowerCase() === base ||
    t.slug?.toLowerCase() === base ||
    t.slug?.toLowerCase() === asSlug
  ) || null
}

export async function findTown(input: unknown): Promise<Town | null> {
  return matchTown(await loadTowns(), input)
}

// Canonical town name, or null when the town isn't in the table — callers
// refuse the request instead of silently defaulting to a town.
export async function resolveTown(input: unknown): Promise<string | null> {
  return (await findTown(input))?.name ?? null
}

// PostgREST filter matching both stored forms of a town ("Mill Valley" / "mill-valley").
export function townFilter(town: Town): string {
  const q = (s: string) => `"${s.replace(/[\\%_]/g, '\\$&').replace(/[\\"]/g, '\\$&')}"`
  return `town.ilike.${q(town.name)},town.ilike.${q(town.slug)}`
}
