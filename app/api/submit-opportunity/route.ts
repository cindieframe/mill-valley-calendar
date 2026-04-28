import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: 'Townstir <hello@send.townstir.com>',
      to,
      subject,
      html,
      reply_to: 'townstir.admin@gmail.com',
    }),
  })
  if (!res.ok) {
    const err = await res.json()
    console.error('Resend error:', err)
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
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
      to: 'townstir.admin@gmail.com',
      subject: `New opportunity submitted: ${title}`,
      html: `
        <p>A new Volunteering opportunity has been submitted for review.</p>
        <p><strong>Title:</strong> ${title}</p>
        <p><strong>Category:</strong> ${category}</p>
        <p><strong>Organization:</strong> ${organization || 'Community member'}</p>
        <p><strong>Contact:</strong> ${contact_name || ''} — ${contact_email || ''}</p>
        <p><a href="https://www.townstir.com/admin">Review it in the admin dashboard →</a></p>
      `,
    })

    // Confirm to submitter
    if (posted_by_email) {
      await sendEmail({
        to: posted_by_email,
        subject: `We received your opportunity: ${title}`,
        html: `
          <p>Hi ${contact_name || 'there'},</p>
          <p>Thanks for submitting <strong>${title}</strong> to the Townstir Volunteering. We'll review it within 24 hours.</p>
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