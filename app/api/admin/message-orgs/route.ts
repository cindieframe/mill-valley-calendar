import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabaseAdmin'
import { requireAdmin, canManageTown } from '../../../lib/adminAuth'
import { ADMIN_INBOX, escapeHtml, paragraphs, sendEmail } from '../../../lib/email'

// Admin → Organizations → Message (one org or all). Recipients come from the
// organizations table, limited to towns this admin manages.
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (auth.response) return auth.response

  const { orgIds, subject, body } = await request.json().catch(() => ({}))
  if (!Array.isArray(orgIds) || !orgIds.length || !subject?.trim() || !body?.trim()) {
    return NextResponse.json({ error: 'orgIds, subject and body required' }, { status: 400 })
  }
  if (orgIds.length > 500) return NextResponse.json({ error: 'Too many recipients' }, { status: 400 })

  const { data: orgs, error } = await supabaseAdmin
    .from('organizations')
    .select('id, name, email, town')
    .in('id', orgIds)
    .not('email', 'is', null)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let sent = 0
  let skipped = 0
  for (const org of orgs || []) {
    if (!(await canManageTown(auth.admin, org.town))) { skipped++; continue }
    const result = await sendEmail({
      to: org.email,
      subject: subject.trim(),
      html: `<p>Hi ${escapeHtml(org.name)},</p>${paragraphs(body)}<p>— The Townstir Team</p>`,
      replyTo: ADMIN_INBOX,
    })
    if (result.ok) sent++
    else skipped++
  }

  return NextResponse.json({ sent, skipped })
}
