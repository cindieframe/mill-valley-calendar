import { supabase } from './supabase'

export async function getEvents(townSlug: string = 'mill-valley') {
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

  // Parse category string into array so components always get a clean array
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