import { NextRequest, NextResponse } from 'next/server'
import { importFeed } from '../../lib/importFeed'
import { requireOrgOrAdmin, canManageTown, forbiddenTown } from '../../lib/adminAuth'
import { resolveTown } from '../../lib/towns'

// Connect / import an iCal feed or Squarespace events page.
// Allowed: an admin who manages the town, or an org account importing its own
// feed (always into the org's own town). The 6-hour sync calls importFeed()
// directly — see api/sync-feeds.
export async function POST(request: NextRequest) {
  const { feedUrl, organization, town: rawTown } = await request.json().catch(() => ({}))
  if (!feedUrl || !organization) {
    return NextResponse.json({ error: 'feedUrl and organization required' }, { status: 400 })
  }

  const auth = await requireOrgOrAdmin(request, organization)
  if (auth.response) return auth.response

  let town: unknown = rawTown
  let orgName: string = organization
  if (auth.admin) {
    const resolved = await resolveTown(rawTown)
    if (resolved && !(await canManageTown(auth.admin, resolved))) return forbiddenTown(resolved)
  } else {
    // Org accounts can't choose a town — their events go to the org's town.
    if (!auth.org.town) {
      return NextResponse.json({ error: 'Your organization has no town set. Contact townstir.admin@gmail.com.' }, { status: 400 })
    }
    town = auth.org.town
    orgName = auth.org.name
  }

  if (!/^https?:\/\//i.test(String(feedUrl))) {
    return NextResponse.json({ error: 'Feed URL must start with http:// or https://' }, { status: 400 })
  }

  const result = await importFeed({ feedUrl, organization: orgName, town })
  return NextResponse.json(result.body, { status: result.status })
}
