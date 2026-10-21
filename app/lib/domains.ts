// Websites many unrelated orgs share. Blocking one of these by domain would
// hide every org on it, so those orgs are blocked by Google place only.
const SHARED_HOSTS = [
  'facebook.com', 'instagram.com', 'google.com', 'sites.google.com',
  'linktr.ee', 'eventbrite.com', 'meetup.com', 'yelp.com', 'nextdoor.com',
  'patch.com', 'allevents.in', 'wixsite.com', 'squarespace.com',
]

// "https://www.Example.org/events?x=1" → "example.org". Null if not a URL.
export function toDomain(url: unknown): string | null {
  if (typeof url !== 'string' || !url.trim()) return null
  try {
    const withProtocol = /^[a-z]+:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`
    const host = new URL(withProtocol).hostname.toLowerCase().replace(/^www\./, '')
    return host || null
  } catch {
    return null
  }
}

export function isSharedHost(domain: string): boolean {
  return SHARED_HOSTS.some(h => domain === h || domain.endsWith(`.${h}`))
}

// Domain that is safe to block for one org, or null.
export function blockableDomain(url: unknown): string | null {
  const domain = toDomain(url)
  return domain && !isSharedHost(domain) ? domain : null
}
