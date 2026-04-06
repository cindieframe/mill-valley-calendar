import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { to, subject, html } = await request.json()

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Townstir Mill Valley <noreply@send.townstir.com>',
      to,
      subject,
      html,
    }),
  })

  const data = await response.json()

  if (!response.ok) {
    return NextResponse.json({ error: data }, { status: 500 })
  }

  return NextResponse.json({ success: true, id: data.id })
}