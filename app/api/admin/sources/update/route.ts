import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { requireAdmin, canManageTown, forbiddenTown } from '../../../../lib/adminAuth'
import { cleanUrls, MAX_SOURCE_PAGES } from '../../../../lib/sourcePages'

// Admin → Import → AI tab → Saved Sources → Pages: replace a source's page list.
// Body: { id, urls }. The first page becomes website_url, the rest extra_urls.
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (auth.response) return auth.response

  const { id, urls } = await request.json().catch(() => ({}))
  if (!id || !Array.isArray(urls)) return NextResponse.json({ error: 'id and urls required' }, { status: 400 })

  const pages = cleanUrls(urls)
  if (!pages.length) {
    return NextResponse.json({ error: 'Keep at least one page address starting with http:// or https://' }, { status: 400 })
  }
  if (pages.length > MAX_SOURCE_PAGES) {
    return NextResponse.json({ error: `A source can have at most ${MAX_SOURCE_PAGES} pages.` }, { status: 400 })
  }

  const { data: org } = await supabaseAdmin.from('organizations').select('id, town').eq('id', id).maybeSingle()
  if (!org) return NextResponse.json({ error: 'Saved source not found' }, { status: 404 })
  if (!(await canManageTown(auth.admin, org.town))) return forbiddenTown(org.town)

  const { data, error } = await supabaseAdmin
    .from('organizations')
    .update({ website_url: pages[0], extra_urls: pages.slice(1) })
    .eq('id', id)
    .select('id, website_url, extra_urls')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ source: data })
}
