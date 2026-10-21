// Server-only. Verifies a reCAPTCHA token inside the route that does the write,
// so the check can't be skipped by calling the write route directly.
export async function verifyRecaptcha(token: unknown): Promise<boolean> {
  if (typeof token !== 'string' || !token) return false
  const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret: process.env.RECAPTCHA_SECRET_KEY || '', response: token }),
  })
  const data = await res.json().catch(() => ({}))
  return data.success === true
}
