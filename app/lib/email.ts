// Server-only email helpers. Every email is built here from database rows —
// the browser never supplies recipients or HTML (the old /api/send-email let
// anyone send anything from hello@send.townstir.com).

export const ADMIN_INBOX = 'townstir.admin@gmail.com'
const FROM = 'Townstir <hello@send.townstir.com>'
const SITE = 'https://www.townstir.com'

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Plain text typed by a person → safe HTML paragraphs.
export function paragraphs(text: string): string {
  return String(text || '')
    .split('\n')
    .map(line => `<p>${escapeHtml(line)}</p>`)
    .join('')
}

export function isEmail(value: unknown): value is string {
  return typeof value === 'string' && /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(value.trim())
}

export async function sendEmail(opts: { to: string; subject: string; html: string; replyTo?: string }) {
  if (!isEmail(opts.to)) return { ok: false, error: 'Invalid recipient' }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: FROM,
      to: opts.to.trim(),
      // Subjects are plain text; strip line breaks so they can't inject headers.
      subject: opts.subject.replace(/[\r\n]+/g, ' ').slice(0, 200),
      html: opts.html,
      reply_to: isEmail(opts.replyTo) ? opts.replyTo : ADMIN_INBOX,
    }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    console.error('Resend error:', data)
    return { ok: false, error: 'Email failed' }
  }
  return { ok: true }
}

type EventLike = {
  id?: number
  title: string
  date: string
  organization?: string | null
  town?: string | null
  rejected_note?: string | null
  unpublished_note?: string | null
}

// ── New event submitted (Post Event form or org dashboard) ──────────────────
export function eventSubmittedAdminEmail(ev: EventLike, extraDates: number) {
  return {
    to: ADMIN_INBOX,
    subject: `New event submitted: ${ev.title}`,
    html: `
      <p>A new event has been submitted for review.</p>
      <p><strong>Title:</strong> ${escapeHtml(ev.title)}</p>
      <p><strong>Date:</strong> ${escapeHtml(ev.date)}${extraDates > 0 ? ` (+ ${extraDates} recurring dates)` : ''}</p>
      <p><strong>Organization:</strong> ${escapeHtml(ev.organization)}</p>
      <p><strong>Town:</strong> ${escapeHtml(ev.town)}</p>
      <p><a href="${SITE}/admin">Review it in the admin dashboard →</a></p>
    `,
  }
}

export function eventSubmittedConfirmation(to: string, ev: EventLike, opts: { greetingName?: string; recurrence?: string; totalDates?: number }) {
  const recurring = (opts.totalDates || 1) > 1
  return {
    to,
    subject: `We received your event: ${ev.title}`,
    html: `
      <p>Hi ${escapeHtml(opts.greetingName || 'there')},</p>
      <p>Thanks for submitting <strong>${escapeHtml(ev.title)}</strong> to Townstir! We'll review it within 24 hours and you'll hear from us once it's approved.</p>
      <p><strong>${recurring ? 'First date' : 'Date'}:</strong> ${escapeHtml(ev.date)}${recurring ? `<br><strong>Recurs:</strong> ${escapeHtml(opts.recurrence)} (${opts.totalDates} total dates submitted)` : ''}</p>
      <p>Thanks for helping make ${escapeHtml(ev.town || 'your town')}'s community calendar great!</p>
      <p>— The Townstir Team</p>
    `,
  }
}

// ── Moderation result (admin approves / rejects / unpublishes) ───────────────
export function eventStatusEmail(to: string, ev: EventLike & { status: string }) {
  const title = escapeHtml(ev.title)
  const date = escapeHtml(ev.date)
  if (ev.status === 'approved') {
    return {
      to,
      subject: `Your event is live: ${ev.title}`,
      html: `<p>Great news!</p><p>Your event <strong>${title}</strong> on <strong>${date}</strong> has been approved and is now live on the Townstir calendar.</p><p><a href="${SITE}/event/${ev.id}">View your event →</a></p><p>— The Townstir Team</p>`,
    }
  }
  if (ev.status === 'rejected') {
    const note = ev.rejected_note ? `<p><strong>Note from admin:</strong> ${escapeHtml(ev.rejected_note)}</p>` : ''
    return {
      to,
      subject: `Update on your event: ${ev.title}`,
      html: `<p>Hi there,</p><p>Unfortunately your event <strong>${title}</strong> on <strong>${date}</strong> was not approved for the Townstir calendar.</p>${note}<p>You're welcome to make changes and resubmit at <a href="${SITE}/post-event">townstir.com/post-event</a>.</p><p>— The Townstir Team</p>`,
    }
  }
  if (ev.status === 'unpublished') {
    const note = ev.unpublished_note ? `<p><strong>Note from admin:</strong> ${escapeHtml(ev.unpublished_note)}</p>` : ''
    return {
      to,
      subject: `Your event has been unpublished: ${ev.title}`,
      html: `<p>Hi there,</p><p>Your event <strong>${title}</strong> on <strong>${date}</strong> has been temporarily unpublished from the Townstir calendar.</p>${note}<p>Please log in to your dashboard to make any needed updates.</p><p>— The Townstir Team</p>`,
    }
  }
  return null
}
