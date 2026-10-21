import { supabase } from '../supabase'

// fetch() for our own protected API routes: adds the signed-in user's session
// token so the route can check who is asking (see app/lib/adminAuth.ts).
// Browser-only.
export async function authFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession()
  const headers = new Headers(init.headers)
  if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  return fetch(url, { ...init, headers })
}
