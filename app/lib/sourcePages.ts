// Page addresses for a Saved Source (organizations.website_url + extra_urls).

export const MAX_SOURCE_PAGES = 10

// Trim, keep only http(s) addresses, drop duplicates (ignoring a trailing slash).
export function cleanUrls(input: unknown[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of input) {
    if (typeof raw !== 'string') continue
    const url = raw.trim()
    if (!/^https?:\/\/\S+$/i.test(url)) continue
    const key = url.replace(/\/+$/, '').toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(url)
  }
  return out
}

