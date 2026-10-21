import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveTown } from '../../lib/towns'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { name, website_url, place_id, town: rawTown } = await request.json()
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })
    const town = await resolveTown(rawTown)
    if (!town) return NextResponse.json({ error: `Unknown town "${rawTown}"` }, { status: 400 })

    const { data: existing } = await supabase
      .from('organizations')
      .select('id, place_id')
      .ilike('name', name)
      .single()

    if (existing) {
      // Update place_id if we now have one and it wasn't saved before
      if (place_id && !existing.place_id) {
        await supabase
          .from('organizations')
          .update({ place_id })
          .eq('id', existing.id)
      }
    } else {
      await supabase.from('organizations').insert([{
        name,
        website_url: website_url || null,
        place_id: place_id || null,
        town,
        verified: false,
        is_aggregator: false,
      }])
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Save org error:', error)
    return NextResponse.json({ error: 'Failed to save org' }, { status: 500 })
  }
}