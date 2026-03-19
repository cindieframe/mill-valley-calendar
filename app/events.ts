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

  return data
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
