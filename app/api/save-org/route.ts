import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../supabase'

export async function POST(request: NextRequest) {
  try {
    const { name, website_url } = await request.json()
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

    // Only insert if not already there
    const { data: existing } = await supabase
      .from('organizations')
      .select('id')
      .ilike('name', name)
      .single()

    if (!existing) {
      await supabase.from('organizations').insert([{
        name,
        website_url: website_url || null,
        town: 'mill-valley',
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