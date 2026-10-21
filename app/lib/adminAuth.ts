import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from './supabaseAdmin'
import { loadTowns, matchTown } from './towns'

// Server-side checks for API routes. Every route that uses the service-role
// client (supabaseAdmin) must call one of these first.
//
//   requireAdmin(request)          signed-in row in `admins`
//   requireSuperAdmin(request)     same, role super_admin
//   requireOrgOrAdmin(request, o)  an admin, or the logged-in account that owns org `o`
//   isCronRequest(request)         the 6-hour sync (Authorization: Bearer CRON_SECRET)
//
// Browser code sends the session with authFetch() from app/lib/authFetch.ts.

export type Admin = {
  email: string
  role: 'super_admin' | 'regional_admin'
  towns: string[]
}

export type OwnedOrg = {
  id: number
  name: string
  canonical_name: string | null
  town: string | null
  email: string | null
}

type Fail = { response: NextResponse }
type UserResult = { user: { id: string; email: string }; response?: never } | (Fail & { user?: never })
type AuthResult = { admin: Admin; response?: never } | (Fail & { admin?: never })
type OrgOrAdminResult =
  | { admin: Admin; org?: never; response?: never }
  | { org: OwnedOrg; admin?: never; response?: never }
  | (Fail & { admin?: never; org?: never })

function fail(message: string, status: number): Fail {
  return { response: NextResponse.json({ error: message }, { status }) }
}

// Verifies the Supabase session token sent as "Authorization: Bearer <access_token>".
async function requireUser(request: NextRequest): Promise<UserResult> {
  const header = request.headers.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) return fail('Not signed in', 401)

  const { data, error } = await supabaseAdmin.auth.getUser(token)
  const user = data?.user
  if (error || !user?.email) return fail('Session expired — sign in again', 401)
  return { user: { id: user.id, email: user.email } }
}

async function loadAdmin(email: string): Promise<Admin | null> {
  const { data: row } = await supabaseAdmin
    .from('admins')
    .select('role, towns')
    .eq('email', email)
    .maybeSingle()
  if (!row || (row.role !== 'super_admin' && row.role !== 'regional_admin')) return null
  return { email, role: row.role, towns: row.towns || [] }
}

export async function requireAdmin(request: NextRequest): Promise<AuthResult> {
  const auth = await requireUser(request)
  if (auth.response) return { response: auth.response }
  const admin = await loadAdmin(auth.user.email)
  if (!admin) return fail('Not an admin', 403)
  return { admin }
}

export async function requireSuperAdmin(request: NextRequest): Promise<AuthResult> {
  const auth = await requireAdmin(request)
  if (auth.response) return auth
  if (auth.admin.role !== 'super_admin') return fail('Only a super admin can do this', 403)
  return auth
}

// Admins pass through (callers still check canManageTown). Anyone else must be
// signed in as the account that owns `organization` (matched on name or
// canonical_name, case-insensitive).
export async function requireOrgOrAdmin(request: NextRequest, organization: string): Promise<OrgOrAdminResult> {
  const auth = await requireUser(request)
  if (auth.response) return { response: auth.response }

  const admin = await loadAdmin(auth.user.email)
  if (admin) return { admin }

  const { data: orgs } = await supabaseAdmin
    .from('organizations')
    .select('id, name, canonical_name, town, email')
    .eq('user_id', auth.user.id)
  const wanted = (organization || '').trim().toLowerCase()
  const org = (orgs || []).find(o =>
    o.name?.trim().toLowerCase() === wanted ||
    o.canonical_name?.trim().toLowerCase() === wanted
  )
  if (!org) return fail('You can only import events for your own organization', 403)
  return { org: org as OwnedOrg }
}

// The org account for the signed-in user (org dashboard routes).
export async function requireOrgAccount(request: NextRequest): Promise<{ org: OwnedOrg; response?: never } | (Fail & { org?: never })> {
  const auth = await requireUser(request)
  if (auth.response) return { response: auth.response }
  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('id, name, canonical_name, town, email')
    .eq('user_id', auth.user.id)
    .limit(1)
    .maybeSingle()
  if (!org) return fail('No organization account found', 403)
  return { org: org as OwnedOrg }
}

export function isCronRequest(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return (
    request.headers.get('authorization') === `Bearer ${secret}` ||
    request.nextUrl.searchParams.get('secret') === secret
  )
}

// super_admin: every town. regional_admin: only towns listed on their admin row.
export async function canManageTown(admin: Admin, townName: string | null | undefined): Promise<boolean> {
  if (admin.role === 'super_admin') return true
  const towns = await loadTowns()
  const target = matchTown(towns, townName)
  if (!target) return false
  return admin.towns.some(t => matchTown(towns, t)?.name === target.name)
}

export function forbiddenTown(townName: string | null | undefined) {
  return NextResponse.json({ error: `You don't manage ${townName || 'that town'}` }, { status: 403 })
}
