import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, town } = body

    if (!action || !town) {
      return NextResponse.json({ error: 'action and town required' }, { status: 400 })
    }

    if (action === 'add') {
      if (!town.name || !town.slug) {
        return NextResponse.json({ error: 'name and slug required' }, { status: 400 })
      }

      const { data, error } = await supabase
        .from('towns')
        .insert([{
          name: town.name,
          slug: town.slug,
          state: town.state || 'CA',
          county: town.county || '',
          tagline: town.tagline || `Events and happenings in ${town.name}, ${town.state || 'CA'}`,
          header_color: town.header_color || '#1a3d2b',
          accent_color: town.accent_color || '#C9952A',
          lat: town.lat ? parseFloat(town.lat) : null,
          lng: town.lng ? parseFloat(town.lng) : null,
          radius: town.radius ? parseInt(town.radius) : 5,
          active: town.active !== false,
        }])
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, town: data })
    }

    if (action === 'update') {
      if (!town.id) {
        return NextResponse.json({ error: 'id required for update' }, { status: 400 })
      }

      const { error } = await supabase
        .from('towns')
        .update({
          name: town.name,
          slug: town.slug,
          state: town.state,
          county: town.county,
          tagline: town.tagline,
          header_color: town.header_color,
          accent_color: town.accent_color,
          lat: town.lat ? parseFloat(town.lat) : null,
          lng: town.lng ? parseFloat(town.lng) : null,
          radius: town.radius ? parseInt(town.radius) : 5,
          active: town.active,
        })
        .eq('id', town.id)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    if (action === 'toggle') {
      if (!town.id) {
        return NextResponse.json({ error: 'id required for toggle' }, { status: 400 })
      }

      const { error } = await supabase
        .from('towns')
        .update({ active: town.active })
        .eq('id', town.id)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('add-town error:', error)
    return NextResponse.json({ error: 'Request failed' }, { status: 500 })
  }
}
