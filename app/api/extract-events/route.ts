import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '../../lib/supabaseAdmin'
import { requireAdmin, canManageTown, forbiddenTown } from '../../lib/adminAuth'
import { resolveTown } from '../../lib/towns'
import { escapeLike } from '../../lib/escapeLike'
import { extractFromPage } from '../../lib/extractPage'
import { cleanUrls, MAX_SOURCE_PAGES } from '../../lib/sourcePages'

// Each page can take a while (fetch + AI); allow the full Hobby-plan limit.
export const maxDuration = 300

const MAX_PAGES = MAX_SOURCE_PAGES
const PAGE_CONCURRENCY = 3

// AI / feed extraction for an organization's web pages.
//
// Body, one of:
//   { sourceId }                         Re-extract a Saved Source: reads its saved
//                                        pages, name, town and aggregator flag.
//   { urls | websiteUrl, organization, town, isAggregator?, saveSource? }
//                                        Extract the given page(s). With saveSource,
//                                        the org is saved/updated as a Saved Source
//                                        and the pages are ADDED to its page list.
//
// A source can have several pages (sites like marinwood.org put each event on
// its own page). Every page goes through the same steps: iCal feed → Squarespace
// list → AI extraction. Results are added up; per-page results are in `pages`.
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (auth.response) return auth.response

  try {
    const body = await request.json().catch(() => ({}))

    let organization: string
    let town: string | null
    let isAggregator: boolean
    let pages: string[]
    let sourceId: number | null = null

    if (body.sourceId) {
      const { data: org } = await supabase
        .from('organizations')
        .select('id, name, town, website_url, extra_urls, is_aggregator')
        .eq('id', body.sourceId)
        .maybeSingle()
      if (!org) return NextResponse.json({ error: 'Saved source not found' }, { status: 404 })
      sourceId = org.id
      organization = org.name
      town = await resolveTown(org.town)
      isAggregator = org.is_aggregator === true
      pages = cleanUrls([org.website_url, ...(org.extra_urls || [])])
    } else {
      organization = String(body.organization || '').trim()
      town = await resolveTown(body.town)
      if (!town) {
        return NextResponse.json({ error: body.town ? `Unknown town "${body.town}"` : 'town required' }, { status: 400 })
      }
      pages = cleanUrls(Array.isArray(body.urls) ? body.urls : [body.websiteUrl])
      isAggregator = body.isAggregator === true
      if (!isAggregator && organization) {
        const { data: orgData } = await supabase
          .from('organizations')
          .select('is_aggregator')
          .ilike('name', escapeLike(organization))
          .limit(1)
          .maybeSingle()
        if (orgData?.is_aggregator) isAggregator = true
      }
    }

    if (!town) return NextResponse.json({ error: 'This source has no town set.' }, { status: 400 })
    if (!(await canManageTown(auth.admin, town))) return forbiddenTown(town)
    if (!organization) return NextResponse.json({ error: 'organization required' }, { status: 400 })
    if (!pages.length) {
      return NextResponse.json({ error: 'Add at least one page address starting with http:// or https://' }, { status: 400 })
    }
    if (pages.length > MAX_PAGES) {
      return NextResponse.json({ error: `A source can have at most ${MAX_PAGES} pages.` }, { status: 400 })
    }

    const pageResults = await mapWithConcurrency(pages, PAGE_CONCURRENCY, websiteUrl =>
      extractFromPage({ websiteUrl, organization, isAggregator, town: town! })
    )

    const anySucceeded = pageResults.some(r => !r.body?.error)

    // Remember the source (new extraction) / when it was last read (re-extract).
    if (anySucceeded) {
      const now = new Date().toISOString()
      if (sourceId) {
        await supabase.from('organizations').update({ last_extracted_at: now }).eq('id', sourceId)
      } else if (body.saveSource) {
        sourceId = await saveSource({ organization, town, pages, now })
      }
    }

    // One page: same response as before, so existing callers (Discovery) are unchanged.
    if (pages.length === 1) {
      const only = pageResults[0]
      return NextResponse.json({ ...only.body, sourceId }, { status: only.status })
    }

    const summary = {
      success: anySucceeded,
      sourceId,
      imported: 0,
      skipped: 0,
      total: 0,
      results: [] as any[],
      errors: [] as string[],
      pages: pages.map((url, i) => {
        const b = pageResults[i].body || {}
        return {
          url,
          imported: b.imported || 0,
          skipped: b.skipped || 0,
          error: b.error || null,
          message: b.message || null,
          feedDetected: b.feedDetected || null,
        }
      }),
    }
    pageResults.forEach(({ body: b }, i) => {
      if (!b) return
      summary.imported += b.imported || 0
      summary.skipped += b.skipped || 0
      summary.total += b.total || 0
      summary.results.push(...(b.results || []))
      for (const e of b.errors || []) summary.errors.push(`${shortUrl(pages[i])}: ${e}`)
      if (b.error) summary.errors.push(`${shortUrl(pages[i])}: ${b.error}`)
    })
    if (!anySucceeded) {
      return NextResponse.json({ ...summary, error: 'None of the pages could be read.' }, { status: 502 })
    }
    return NextResponse.json(summary)
  } catch (error) {
    console.error('Extract events error:', error)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}

// Creates the Saved Source, or adds these pages to an existing one with the same name.
async function saveSource({ organization, town, pages, now }: {
  organization: string; town: string; pages: string[]; now: string
}): Promise<number | null> {
  const { data: existing } = await supabase
    .from('organizations')
    .select('id, website_url, extra_urls')
    .ilike('name', escapeLike(organization))
    .limit(1)
    .maybeSingle()

  if (existing) {
    const all = cleanUrls([existing.website_url, ...(existing.extra_urls || []), ...pages])
    const { error } = await supabase.from('organizations').update({
      website_url: all[0],
      extra_urls: all.slice(1, MAX_PAGES),
      last_extracted_at: now,
      town,
    }).eq('id', existing.id)
    if (error) console.error('Save source failed:', error)
    return existing.id
  }

  const { data: created, error } = await supabase.from('organizations').insert([{
    name: organization,
    website_url: pages[0],
    extra_urls: pages.slice(1),
    last_extracted_at: now,
    town,
  }]).select('id').single()
  if (error) console.error('Save source failed:', error)
  return created?.id ?? null
}

function shortUrl(url: string): string {
  try {
    const u = new URL(url)
    return u.pathname === '/' ? u.host : u.pathname.replace(/\/+$/, '')
  } catch {
    return url
  }
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}
