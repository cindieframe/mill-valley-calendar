import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from './supabaseAdmin'
import { loadTowns, matchTown } from './towns'

export type Admin = {
  email: string
  role: 'super_admin' | 'regional_admin'
  towns: string[]
}

type AuthResult = { admin: Admin; response?: never } | { admin?: never; response: NextResponse }

// Verifies the caller's Supabase session token (sent by the browser as
// "Authorization: Bearer <access_token>") and that they are in `admins`.
export async function requireAdmin(request: NextRequest): Promise<AuthResult> {
  const header = request.headers.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) {
    return { response: NextResponse.json({ error: 'Not signed in' }, { status: 401 }) }
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token)
  const email = data?.user?.email
  if (error || !email) {
    return { response: NextResponse.json({ error: 'Session expired — sign in again' }, { status: 401 }) }
  }

  const { data: row } = await supabaseAdmin
    .from('admins')
    .select('role, towns')
    .eq('email', email)
    .single()
  if (!row || (row.role !== 'super_admin' && row.role !== 'regional_admin')) {
    return { response: NextResponse.json({ error: 'Not an admin' }, { status: 403 }) }
  }

  return { admin: { email, role: row.role, towns: row.towns || [] } }
}

// super_admin: every town. regional_admin: only towns listed on their admin row.
export async function canManageTown(admin: Admin, townName: string): Promise<boolean> {
  if (admin.role === 'super_admin') return true
  const towns = await loadTowns()
  const target = matchTown(towns, townName)
  if (!target) return false
  return admin.towns.some(t => matchTown(towns, t)?.name === target.name)
}

export function forbiddenTown(townName: string) {
  return NextResponse.json({ error: `You don't manage ${townName}` }, { status: 403 })
}
