import { supabase } from './supabase'

export async function getEvents() {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('status', 'approved')
    .order('date', { ascending: true })

  if (error) {
    console.error('Error fetching events:', error)
    return []
  }

  // Parse category string into array so components always get a clean array
  return data.map((ev: any) => ({
    ...ev,
    cats: ev.category ? ev.category.split(',').map((c: string) => c.trim()) : [],
  }))
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