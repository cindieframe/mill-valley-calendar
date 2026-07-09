import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function searchPlaces(query: string, location: string, apiKey: string) {
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query + ' ' + location)}&key=${apiKey}`

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(url)
      const data = await res.json()
      return data.results || []
    } catch (err) {
      if (attempt === 2) {
        console.error(`searchPlaces failed after 2 attempts for query "${query}":`, err)
        return [] // don't kill the whole run over one query failing
      }
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
  return []
}

const searchQueries = [
  'library', 'community center', 'arts center theater', 'parks and recreation',
  'chamber of commerce', 'museum', 'nonprofit organization', 'school district',
  'city government', 'church community events', 'restaurant', 'bar music venue',
  'music venue', 'bookstore', 'café', 'beer garden', 'winery', 'civic center',
  'cultural center', 'art club', 'arts association', 'art studio', 'yoga studio',
  'hiking club', 'nature club', 'outdoor club', 'trails association',
  'friends of', 'garden club', 'historical society', 'rotary club',
  'lions club', 'volunteer fire', 'neighborhood association',
]

export async function POST(request: NextRequest) {
  try {
    const { town, state } = await request.json()
    if (!town) {
      return NextResponse.json({ error: 'town is required' }, { status: 400 })
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Google Places API key not configured' }, { status: 500 })
    }

    // COLLISION GUARD: if a run for this town is already in progress, resume it
    // instead of deleting it and starting fresh underneath whatever's driving it.
    const { data: activeRun } = await supabase
      .from('discovery_runs')
      .select('*')
      .eq('town', town)
      .eq('status', 'running')
      .maybeSingle()

    if (activeRun) {
      return NextResponse.json({
        success: true,
        run_id: activeRun.id,
        total_orgs: activeRun.total_orgs,
        town: `${town}, ${activeRun.state || state || 'CA'}`,
        resumed: true,
      })
    }

    const location = `${town}, ${state || 'CA'}`

    // Fast part: 30 sequential Places text searches. Each is a single quick fetch,
    // so this comfortably finishes well under any timeout — no batching needed here.
    const allPlaces: any[] = []
    const seenIds = new Set<string>()

    for (const query of searchQueries) {
      const results = await searchPlaces(query, location, apiKey)
      for (const place of results.slice(0, 3)) {
        if (!seenIds.has(place.place_id)) {
          const address = place.formatted_address || ''
          if (address.toLowerCase().includes(town.toLowerCase())) {
            seenIds.add(place.place_id)
            allPlaces.push(place)
          }
        }
      }
    }

    // Clear any old (non-running) runs for this town — no history view needed, keep it simple.
    // Only completed/failed runs can reach here, since an active one was handled above.
   const { data: oldRuns } = await supabase
      .from('discovery_runs')
      .select('id, status, processed_count, total_orgs')
      .eq('town', town)

    if (oldRuns && oldRuns.length > 0) {
      console.log(`start: about to delete ${oldRuns.length} old run(s) for ${town}:`, JSON.stringify(oldRuns))
      const oldRunIds = oldRuns.map(r => r.id)
      await supabase.from('discovery_run_orgs').delete().in('run_id', oldRunIds)
      await supabase.from('discovery_runs').delete().in('id', oldRunIds)
    }

    // Create the new run
    const { data: run, error: runError } = await supabase
      .from('discovery_runs')
      .insert([{
        town,
        state: state || 'CA',
        status: 'running',
        total_orgs: allPlaces.length,
        processed_count: 0,
      }])
      .select()
      .single()

    if (runError || !run) {
      return NextResponse.json({ error: runError?.message || 'Failed to create discovery run' }, { status: 500 })
    }

    // Insert every candidate as a pending row for the batch worker to pick up.
    // No self-triggered fetch here — the page's own loop drives process-batch calls.
    if (allPlaces.length > 0) {
      const rows = allPlaces.map(place => ({
        run_id: run.id,
        place_id: place.place_id,
        place_data: place,
        status: 'pending',
      }))
      const { error: insertError } = await supabase.from('discovery_run_orgs').insert(rows)
      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }
    } else {
      await supabase.from('discovery_runs').update({ status: 'completed' }).eq('id', run.id)
    }

    return NextResponse.json({
      success: true,
      run_id: run.id,
      total_orgs: allPlaces.length,
      town: location,
      resumed: false,
    })

  } catch (error) {
    console.error('Discovery start error:', error)
    return NextResponse.json({ error: 'Failed to start discovery' }, { status: 500 })
  }
}