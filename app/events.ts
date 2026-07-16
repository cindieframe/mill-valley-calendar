import { supabase } from './supabase'

function timeTo24(t: string): string {
  if (!t) return '99:99'
  const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i)
  if (!m) return '99:99'
  let h = parseInt(m[1])
  const min = m[2]
  const ampm = m[3].toUpperCase()
  if (ampm === 'PM' && h !== 12) h += 12
  if (ampm === 'AM' && h === 12) h = 0
  return `${h.toString().padStart(2, '0')}:${min}`
}

function normalizeTime(t: string): string {
  if (!t) return t
  const m = t.match(/(\d+)(?::(\d+))?\s*(AM|PM)/i)
  if (!m) return t
  const h = m[1]
  const min = m[2] || '00'
  const ampm = m[3].toUpperCase()
  return `${h}:${min} ${ampm}`
}

// Shared shaping/sorting logic used by both single-town and Marin-aggregate fetches.
function shapeEvents(data: any[]) {
  return data
    .map((ev: any) => ({
      ...ev,
      cats: ev.category ? ev.category.split(',').map((c: string) => c.trim()) : [],
      time: normalizeTime(ev.time),
    }))
    .sort((a: any, b: any) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date)
      return timeTo24(a.time).localeCompare(timeTo24(b.time))
    })
}

// Marin aggregate: pulls approved events from every town on file with
// county = 'Marin', regardless of that town's `active` flag. A town being
// inactive only means it doesn't get its own page yet — its events still
// belong in the county-wide view.
async function getMarinEvents() {
  const { data: countyTowns, error: townsError } = await supabase
    .from('towns')
    .select('name, slug')
    .eq('county', 'Marin')

  if (townsError) {
    console.error('Error fetching Marin towns:', townsError)
    return []
  }
  if (!countyTowns || countyTowns.length === 0) {
    return []
  }

  const orParts = countyTowns
    .flatMap(t => [`town.ilike.${t.name}`, `town.ilike.${t.slug}`])
    .join(',')

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('status', 'approved')
    .or(orParts)
    .gte('date', new Date().toISOString().split('T')[0])

  if (error) {
    console.error('Error fetching Marin events:', error)
    return []
  }

  return shapeEvents(data || [])
}

export async function getEvents(townSlug: string = 'mill-valley') {
  if (townSlug.toLowerCase() === 'marin') {
    return getMarinEvents()
  }

  const townName = townSlug
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('status', 'approved')
    .or(`town.ilike.${townName},town.ilike.${townSlug}`)
    .gte('date', new Date().toISOString().split('T')[0])
    .order('date', { ascending: true })
    .order('time', { ascending: true })

  if (error) {
    console.error('Error fetching events:', error)
    return []
  }

  return shapeEvents(data || [])
}

export async function submitEvent(event: any) {
  const { data, error } = await supabase
    .from('events')
    .insert([{ ...event, status: 'pending' }])

  if (error) {
    console.error('Error submitting event:', error)
    return false
  }

  return true
}
