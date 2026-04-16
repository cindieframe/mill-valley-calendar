import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { to, subject, html, replyTo } = await req.json()
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
      reply_to: replyTo || 'townstir.admin@gmail.com',
    }),
  })
  const data = await res.json()
  if (!res.ok) return NextResponse.json({ error: data }, { status: 500 })
  return NextResponse.json({ success: true })
}
