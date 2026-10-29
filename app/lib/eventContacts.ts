import { supabase } from '../supabase'

// Submitters' contact emails live in the private `event_contacts` table, not on
// the public events row (see supabase/migrations/2026-10-29_event_contact_privacy.sql).
// Admins, and the org that owns an event, read them through the
// event_contact_emails() database function. Browser-only.
//
// Before that SQL has run, the function doesn't exist: we keep whatever email
// is already on the row, so the page works either way.
export async function withContactEmails<T extends { id: number; email?: string | null }>(events: T[]): Promise<T[]> {
  if (!events.length) return events
  const { data, error } = await supabase.rpc('event_contact_emails', { event_ids: events.map(e => e.id) })
  if (error || !data) return events
  const byId = new Map<number, string>((data as { event_id: number; email: string }[]).map(r => [r.event_id, r.email]))
  return events.map(e => ({ ...e, email: byId.get(e.id) ?? e.email ?? '' }))
}
