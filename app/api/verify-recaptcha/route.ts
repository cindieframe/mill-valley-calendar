import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { token } = await req.json()
  const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${token}`,
  })
  const data = await res.json()
  if (!data.success) return NextResponse.json({ error: 'reCAPTCHA failed' }, { status: 400 })
  return NextResponse.json({ success: true })
}