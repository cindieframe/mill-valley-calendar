import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  TRUSTED_TYPES,
  SKIP_ALWAYS_TYPES,
  getBaseDomain,
  getPlaceDetails,
  findEventPageUrl,
  detectIcalFeed,
  assessOrg,
} from '../helpers'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BATCH_SIZE = 3
const PER_ORG_TIMEOUT_MS = 15000

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms)
    promise.then((result) => {
      clearTimeout(timer)
      resolve(result)
    }).catch(() => {
      clearTimeout(timer)
      resolve(fallback)
    })
  })
}

async function withRetry<T>(fn: () => PromiseLike<T>, attempts = 3, delayMs = 800, timeoutMs = 8000): Promise<T> {
  let lastResult: any
  for (let i = 1; i <= attempts; i++) {
    try {
      const result = await Promise.race([
        Promise.resolve(fn()),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Supabase call timed out')), timeoutMs))
      ])
      if (result && typeof result === 'object' && 'error' in result && (result as any).error) {
        lastResult = result
        if (i < attempts) {
          await new Promise(resolve => setTimeout(resolve, delayMs))
          continue
        }
        return result
      }
      return result
    } catch (err) {
      lastResult = err
      if (i < attempts) await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }
  throw lastResult
}

export async function POST(request: NextRequest) {
  let run_id: string | undefined

  try {
    const body = await request.json()
    run_id = body.run_id
    if (!run_id) {
      return NextResponse.json({ error: 'run_id is required' }, { status: 400 })
    }

    const { data: run, error: runError } = await withRetry(() =>
      supabase.from('discovery_runs').select('*').eq('id', run_id).single()
    )

    if (runError) {
      console.error(`[process-batch:${run_id}] Stage "fetch run" failed:`, runError)
      return NextResponse.json({ error: `Database error (fetch run): ${runError.message}` }, { status: 500 })
    }
    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    }

    if (run.status !== 'running') {
      return NextResponse.json({ success: true, status: run.status, note: 'Run already finished' })
    }

    const { data: batch, error: batchError } = await withRetry(() =>
      supabase
        .from('discovery_run_orgs')
        .select('*')
        .eq('run_id', run_id)
        .eq('status', 'pending')
        .limit(BATCH_SIZE)
    )

    if (batchError) {
      console.error(`[process-batch:${run_id}] Stage "fetch batch" failed:`, batchError)
      return NextResponse.json({ error: `Database error (fetch batch): ${batchError.message}` }, { status: 500 })
    }

    if (!batch || batch.length === 0) {
      try {
        await withRetry(() =>
          supabase.from('discovery_runs').update({
            status: 'completed',
            updated_at: new Date().toISOString(),
          }).eq('id', run_id)
        )
      } catch (err) {
        console.error(`[process-batch:${run_id}] Stage "mark completed (empty batch)" failed:`, err)
        return NextResponse.json({ error: `Database error (mark completed): ${err instanceof Error ? err.message : String(err)}` }, { status: 500 })
      }
      return NextResponse.json({ success: true, status: 'completed' })
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY
    if (!apiKey) {
      try {
        await withRetry(() =>
          supabase.from('discovery_runs').update({ status: 'failed' }).eq('id', run_id)
        )
      } catch (err) {
        console.error(`[process-batch:${run_id}] Stage "mark failed (no api key)" failed:`, err)
      }
      return NextResponse.json({ error: 'Google Places API key not configured' }, { status: 500 })
    }

    const town = run.town

    let blockedOrgsData, existingFeeds, orgsWithEvents, existingOrgs
    try {
      const results = await Promise.all([
        withRetry(() => supabase.from('blocked_orgs').select('place_id').eq('town', town)),
        withRetry(() => supabase.from('ical_feeds').select('url, organization')),
        withRetry(() => supabase.from('events').select('organization').eq('status', 'approved').eq('town', town)),
        withRetry(() => supabase.from('organizations').select('name, website_url, last_extracted_at, place_id')),
      ])
      blockedOrgsData = results[0].data
      existingFeeds = results[1].data
      orgsWithEvents = results[2].data
      existingOrgs = results[3].data
    } catch (err) {
      console.error(`[process-batch:${run_id}] Stage "fetch lookup tables" failed:`, err)
      return NextResponse.json({ error: `Database error (fetch lookup tables): ${err instanceof Error ? err.message : String(err)}` }, { status: 500 })
    }

    const blockedPlaceIds = new Set((blockedOrgsData || []).map((b: any) => b.place_id))
    const existingFeedUrls = new Set((existingFeeds || []).map((f: any) => f.url))
    const orgsWithEventNames = new Set((orgsWithEvents || []).map((e: any) => e.organization?.toLowerCase()))
    const knownPlaceIds = new Set((existingOrgs || []).map((o: any) => o.place_id).filter(Boolean))
    const feedOrgNames = new Set((existingFeeds || []).map((f: any) => f.organization?.toLowerCase()))
    const existingOrgWebsites = new Set(
      (existingOrgs || []).map((o: any) => {
        try { return getBaseDomain(o.website_url) } catch { return null }
      }).filter(Boolean)
    )
    const extractedOrgWebsites = new Set(
      (existingOrgs || [])
        .filter((o: any) => o.last_extracted_at !== null)
        .map((o: any) => { try { return getBaseDomain(o.website_url) } catch { return null } })
        .filter(Boolean)
    )
    const extractedOrgNames = new Set(
      (existingOrgs || [])
        .filter((o: any) => o.last_extracted_at !== null)
        .map((o: any) => o.name?.toLowerCase())
        .filter(Boolean)
    )

    let blockedSkippedThisBatch = 0
    let alreadyKnownSkippedThisBatch = 0

    async function processOneInner(row: any) {
      const place = row.place_data

      if (blockedPlaceIds.has(place.place_id)) {
        blockedSkippedThisBatch++
        return { row, result: null, skip: true }
      }

      const searchName = (place.name || '').toLowerCase()
      const knownByPlaceId = knownPlaceIds.has(place.place_id)
      const knownByName =
        orgsWithEventNames.has(searchName) ||
        feedOrgNames.has(searchName) ||
        extractedOrgNames.has(searchName)

      if (knownByPlaceId || knownByName) {
        alreadyKnownSkippedThisBatch++
        return {
          row,
          result: {
            name: place.name,
            website: '',
            extraction_url: '',
            address: place.formatted_address || '',
            phone: '',
            reason: '',
            place_id: place.place_id,
            feed_url: null,
            already_imported: true,
            feed_already_connected: false,
          },
          skip: false,
        }
      }

      try {
        const details = await withTimeout(getPlaceDetails(place.place_id, apiKey!), 10000, {})
        const types: string[] = details.types || []
        const website = details.website || ''
        const name = details.name || place.name

        if (types.some((t: string) => SKIP_ALWAYS_TYPES.has(t))) {
          return { row, result: null, skip: true }
        }

        const normalizedWebsite = website ? getBaseDomain(website) : null
        const knownByWebsite =
          (normalizedWebsite !== null && existingOrgWebsites.has(normalizedWebsite)) ||
          (normalizedWebsite !== null && extractedOrgWebsites.has(normalizedWebsite))

        if (knownByWebsite) {
          alreadyKnownSkippedThisBatch++
          return {
            row,
            result: {
              name, website, extraction_url: website,
              address: details.formatted_address || place.formatted_address || '',
              phone: details.formatted_phone_number || '',
              reason: '', place_id: place.place_id, feed_url: null,
              already_imported: true, feed_already_connected: false,
            },
            skip: false,
          }
        }

        const isTrusted = types.some((t: string) => TRUSTED_TYPES.has(t))

        const eventPageUrl = await withTimeout(findEventPageUrl(website), PER_ORG_TIMEOUT_MS, null)

        if (!isTrusted && !eventPageUrl) {
          return { row, result: null, skip: true }
        }

        const { likely, reason } = await assessOrg(name, types, website, eventPageUrl)
        if (!likely) {
          return { row, result: null, skip: true }
        }

        const feedUrl = await withTimeout(detectIcalFeed(website), PER_ORG_TIMEOUT_MS, null)
        const feedAlreadyConnected = feedUrl ? existingFeedUrls.has(feedUrl) : false

        return {
          row,
          result: {
            name, website, extraction_url: eventPageUrl || website,
            address: details.formatted_address || place.formatted_address || '',
            phone: details.formatted_phone_number || '',
            reason, place_id: place.place_id, feed_url: feedUrl,
            already_imported: false, feed_already_connected: feedAlreadyConnected,
          },
          skip: false,
        }
      } catch (err) {
        console.error(`[process-batch:${run_id}] Stage "process org" failed for "${place.name}" (place_id: ${place.place_id}):`, err)
        return { row, result: null, skip: true }
      }
    }

    async function processOne(row: any) {
      return withTimeout(processOneInner(row), PER_ORG_TIMEOUT_MS * 2, { row, result: null, skip: true })
    }

    const processed = await Promise.all(batch.map(processOne))

    try {
      // Single batch upsert instead of N individual update() calls.
      // Previously each org in the batch got its own withRetry-wrapped
      // update() (up to 3 attempts x 8s timeout EACH), meaning up to 9
      // separate network round-trips per batch of 3 — any one of which
      // stalling could time out the whole request. One batched call means
      // one round-trip, with retry still covering the whole batch as a unit.
      const rows = processed.map(({ row, result, skip }) => ({
        id: row.id,
        status: 'done',
        result: skip ? null : result,
        processed_at: new Date().toISOString(),
      }))

      const { error: writeError } = await withRetry(() =>
        supabase.from('discovery_run_orgs').upsert(rows, { onConflict: 'id' })
      )

      if (writeError) {
        throw writeError
      }
    } catch (err) {
      console.error(`[process-batch:${run_id}] Stage "write org results" failed:`, err)
      return NextResponse.json({ error: `Database error (write org results): ${err instanceof Error ? err.message : String(err)}` }, { status: 500 })
    }

    let remainingPending
    try {
      const result = await withRetry(() =>
        supabase
          .from('discovery_run_orgs')
          .select('id', { count: 'exact', head: true })
          .eq('run_id', run_id)
          .eq('status', 'pending')
      )
      remainingPending = result.count
    } catch (err) {
      console.error(`[process-batch:${run_id}] Stage "count remaining" failed:`, err)
      return NextResponse.json({ error: `Database error (count remaining): ${err instanceof Error ? err.message : String(err)}` }, { status: 500 })
    }

    try {
      await withRetry(() =>
        supabase.from('discovery_runs').update({
          processed_count: run.processed_count + batch.length,
          blocked_skipped: run.blocked_skipped + blockedSkippedThisBatch,
          already_known_skipped: run.already_known_skipped + alreadyKnownSkippedThisBatch,
          status: (remainingPending === null || remainingPending === undefined || remainingPending > 0) ? 'running' : 'completed',
          updated_at: new Date().toISOString(),
        }).eq('id', run_id)
      )
    } catch (err) {
      console.error(`[process-batch:${run_id}] Stage "update run progress" failed:`, err)
      return NextResponse.json({ error: `Database error (update run progress): ${err instanceof Error ? err.message : String(err)}` }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      processed: batch.length,
      remaining: remainingPending || 0,
    })

  } catch (error) {
    console.error(`[process-batch:${run_id ?? 'unknown'}] Unhandled error:`, error)
    return NextResponse.json({
      error: `Batch processing failed: ${error instanceof Error ? error.message : String(error)}`
    }, { status: 500 })
  }
}