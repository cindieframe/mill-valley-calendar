import { createClient } from '@supabase/supabase-js'

// Service-role client. Server-side only (API routes) — never import this
// from a 'use client' file. Every route using it must call requireAdmin first.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)
