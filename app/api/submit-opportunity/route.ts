import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '../../lib/supabaseAdmin'
import { verifyRecaptcha } from '../../lib/recaptcha'
import { ADMIN_INBOX, escapeHtml, isEmail, sendEmail } from '../../lib/email'

// Public Volunteering form. reCAPTCHA is verified here, then the opportunity is
// saved as pending and emails are sent (all user text is HTML-escaped).
export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!(await verifyRecaptcha(body?.recaptchaToken))) {
      return NextResponse.json({ error: 'reCAPTCHA verification failed. Please try again.' }, { status: 400 })
    }
    const {
      title,
      description,
      category,
      contact_name,
      contact_email,
      contact_phone,
      organization,
      website,
      is_student_opportunity,
      posted_by_email,
      town = 'mill-valley',
    } = body

    if (!title || !description || !category) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Expires 37 days from now (30-day warning email + 7-day grace period)
    const expires_at = new Date()
    expires_at.setDate(expires_at.getDate() + 37)

    const { data, error } = await supabase.from('opportunities').insert([{
      title,
      description,
      category,
      contact_name,
      contact_email,
      contact_phone,
      organization,
      website,
      is_student_opportunity: is_student_opportunity || false,
      posted_by_email,
      town,
      status: 'pending',
      expires_at: expires_at.toISOString(),
    }]).select().single()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Notify admin
    await sendEmail({
      to: ADMIN_INBOX,
      subject: `New opportunity submitted: ${title}`,
      html: `
        <p>A new Volunteering opportunity has been submitted for review.</p>
        <p><strong>Title:</strong> ${escapeHtml(title)}</p>
        <p><strong>Category:</strong> ${escapeHtml(category)}</p>
        <p><strong>Organization:</strong> ${escapeHtml(organization || 'Community member')}</p>
        <p><strong>Contact:</strong> ${escapeHtml(contact_name || '')} — ${escapeHtml(contact_email || '')}</p>
        <p><a href="https://www.townstir.com/admin">Review it in the admin dashboard →</a></p>
      `,
    })

    // Confirm to submitter
    if (isEmail(posted_by_email)) {
      await sendEmail({
        to: posted_by_email,
        subject: `We received your opportunity: ${title}`,
        html: `
          <p>Hi ${escapeHtml(contact_name || 'there')},</p>
          <p>Thanks for submitting <strong>${escapeHtml(title)}</strong> to the Townstir Volunteering. We'll review it within 24 hours.</p>
          <p>Once approved it will appear on the Mill Valley Volunteering and will stay live for 30 days. You'll receive an email before it expires giving you the option to keep it live.</p>
          <p>— The Townstir Team</p>
        `,
      })
    }

    return NextResponse.json({ success: true, id: data.id })
  } catch (err) {
    console.error('Submit opportunity error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}