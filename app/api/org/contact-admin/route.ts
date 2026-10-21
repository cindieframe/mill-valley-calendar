import { NextRequest, NextResponse } from 'next/server'
import { requireOrgAccount } from '../../../lib/adminAuth'
import { ADMIN_INBOX, escapeHtml, paragraphs, sendEmail } from '../../../lib/email'

// Org dashboard → Contact admin. Always goes to the Townstir inbox; the org's
// name and reply-to address come from its own organizations row.
export async function POST(request: NextRequest) {
  const auth = await requireOrgAccount(request)
  if (auth.response) return auth.response
  const { org } = auth

  const { subject, message } = await request.json().catch(() => ({}))
  if (!subject?.trim() || !message?.trim()) {
    return NextResponse.json({ error: 'subject and message required' }, { status: 400 })
  }
  if (message.length > 10000) return NextResponse.json({ error: 'Message is too long' }, { status: 400 })

  const result = await sendEmail({
    to: ADMIN_INBOX,
    subject: `Message from ${org.name}: ${subject.trim()}`,
    html: `
      <p><strong>From:</strong> ${escapeHtml(org.name)} (${escapeHtml(org.email)})</p>
      <p><strong>Subject:</strong> ${escapeHtml(subject.trim())}</p>
      <br/>
      ${paragraphs(message)}
    `,
    replyTo: org.email || undefined,
  })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 })
  return NextResponse.json({ success: true })
}
