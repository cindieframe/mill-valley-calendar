export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: 'Townstir <hello@send.townstir.com>',
      to,
      subject,
      html,
    }),
  })
  const data = await res.json()
  if (!res.ok) console.error('Email error:', data)
  return data
}