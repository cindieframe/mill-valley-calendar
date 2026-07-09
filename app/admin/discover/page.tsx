'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../supabase'
import { AdminHeader } from '../../components/Header'
import { useSearchParams } from 'next/navigation'

type OrgResult = {
  name: string
  website: string
  extraction_url: string
  address: string
  phone: string
  reason: string
  place_id: string
  feed_url: string | null
  already_imported: boolean
  feed_already_connected: boolean
  selected: boolean
  status: 'idle' | 'connecting' | 'extracting' | 'done' | 'error'
  statusMessage: string
  dismissed: boolean
  confirmingDismiss: boolean
}

type RunProgress = {
  status: 'running' | 'completed' | 'failed'
  total_orgs: number
  processed_count: number
  blocked_skipped: number
  already_known_skipped: number
}

function DiscoverOrgsInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const lockedTown = searchParams.get('town')
  const [town, setTown] = useState(lockedTown || 'Mill Valley')
  const [state, setState] = useState('CA')
  const [loading, setLoading] = useState(false)
  const [orgs, setOrgs] = useState<OrgResult[]>([])
  const [runId, setRunId] = useState<string | null>(null)
  const [runProgress, setRunProgress] = useState<RunProgress | null>(null)
  const [error, setError] = useState('')
  const [blockedOrgs, setBlockedOrgs] = useState<any[]>([])
  const [showBlocked, setShowBlocked] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const knownPlaceIdsRef = useRef<Set<string>>(new Set())
  const isStartingRef = useRef(false)
  const isRunningRef = useRef(false)

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  async function markRunFailed(id: string) {
    try {
      await fetch('/api/discover-orgs/fail-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ run_id: id })
      })
    } catch {
      // best-effort — if this fails too, the run just sits as 'running'
      // until manually cleared, same as before this fix
    }
  }

  async function refreshStatus(id: string) {
    const res = await fetch('/api/discover-orgs/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ run_id: id })
    })
    const data = await res.json()
    if (data.error) throw new Error(data.error)

    setRunProgress(data.run)

    const incoming: any[] = data.orgs || []
    const newOnes = incoming.filter(o => !knownPlaceIdsRef.current.has(o.place_id))
    if (newOnes.length > 0) {
      newOnes.forEach(o => knownPlaceIdsRef.current.add(o.place_id))
      setOrgs(prev => [
        ...prev,
        ...newOnes.map((o: any) => ({
          ...o,
          selected: !o.already_imported && !o.feed_already_connected,
          status: 'idle' as const,
          statusMessage: '',
          dismissed: false,
          confirmingDismiss: false,
        }))
      ])
    }
    return data.run
  }

  async function runDiscoveryLoop(id: string) {
    try {
      while (true) {
        const batchRes = await fetch('/api/discover-orgs/process-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ run_id: id })
        })
        const batchData = await batchRes.json()
        if (batchData.error) {
          setError(batchData.error)
          await markRunFailed(id)
          break
        }

        const run = await refreshStatus(id)

        if (run.status !== 'running') break
      }
    } catch {
      setError('Discovery stopped unexpectedly. Please try again.')
      await markRunFailed(id)
    }
    isRunningRef.current = false
    setLoading(false)
  }

  async function handleDiscover() {
    if (isStartingRef.current || isRunningRef.current) return
    isStartingRef.current = true

    setLoading(true)
    setError('')
    setOrgs([])
    setRunId(null)
    setRunProgress(null)
    knownPlaceIdsRef.current = new Set()
    stopPolling()

    try {
      const res = await fetch('/api/discover-orgs/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ town, state })
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
        isStartingRef.current = false
        setLoading(false)
        return
      }

      setRunId(data.run_id)
      setRunProgress({
        status: 'running',
        total_orgs: data.total_orgs,
        processed_count: 0,
        blocked_skipped: 0,
        already_known_skipped: 0,
      })

      if (data.total_orgs === 0) {
        isStartingRef.current = false
        setLoading(false)
        return
      }

      isRunningRef.current = true
      isStartingRef.current = false
      runDiscoveryLoop(data.run_id)
    } catch {
      setError('Discovery failed. Please try again.')
      isStartingRef.current = false
      setLoading(false)
    }
  }

  function toggleSelect(index: number) {
    setOrgs(prev => prev.map((o, i) => i === index ? { ...o, selected: !o.selected } : o))
  }

  function toggleSelectAll(group: OrgResult[]) {
    const allSelected = group.every(o => o.selected)
    const names = new Set(group.map(o => o.name))
    setOrgs(prev => prev.map(o => names.has(o.name) ? { ...o, selected: !allSelected } : o))
  }

  function startDismiss(index: number) {
    setOrgs(prev => prev.map((o, i) => i === index ? { ...o, confirmingDismiss: true } : o))
  }

  function cancelDismiss(index: number) {
    setOrgs(prev => prev.map((o, i) => i === index ? { ...o, confirmingDismiss: false } : o))
  }

  function dismissOrg(index: number) {
    setOrgs(prev => prev.map((o, i) => i === index ? { ...o, dismissed: true, confirmingDismiss: false } : o))
  }

  async function blockOrg(index: number) {
    const org = orgs[index]
    const res = await fetch('/api/block-org', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ place_id: org.place_id, name: org.name, town, website: org.website })
    })
    const data = await res.json()
    if (data.error) { alert('Block failed: ' + data.error); return }
    setOrgs(prev => prev.map((o, i) => i === index ? { ...o, dismissed: true, confirmingDismiss: false } : o))
  }

  async function unblockOrg(id: string) {
    await fetch('/api/unblock-org', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    })
    setBlockedOrgs(prev => prev.filter(b => b.id !== id))
  }

  async function loadBlockedOrgs() {
    const res = await fetch('/api/get-blocked-orgs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ town })
    })
    const { data } = await res.json()
    if (data) setBlockedOrgs(data)
  }

  function setOrgStatus(index: number, status: OrgResult['status'], message: string) {
    setOrgs(prev => prev.map((o, i) => i === index ? { ...o, status, statusMessage: message } : o))
  }

  async function connectFeed(index: number) {
    const org = orgs[index]
    if (!org.feed_url) return
    setOrgStatus(index, 'connecting', '')
    try {
      const res = await fetch('/api/import-ical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedUrl: org.feed_url, organization: org.name, town })
      })
      const data = await res.json()
      if (data.error) {
        setOrgStatus(index, 'error', data.error)
      } else {
        await fetch('/api/save-org', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: org.name, website_url: org.website, place_id: org.place_id, town })
        })
        setOrgStatus(index, 'done', `Connected — ${data.imported} events imported, ${data.skipped} skipped`)
      }
    } catch {
      setOrgStatus(index, 'error', 'Connection failed. Try again.')
    }
  }

  async function extractWithAI(index: number) {
    const org = orgs[index]
    const urlToUse = org.extraction_url || org.website
    if (!urlToUse) return
    setOrgStatus(index, 'extracting', '')
    try {
      const res = await fetch('/api/extract-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ websiteUrl: urlToUse, organization: org.name, town })
      })
      const data = await res.json()
      if (data.error) {
        setOrgStatus(index, 'error', data.error)
      } else if (data.imported === 0 && data.skipped === 0) {
        setOrgStatus(index, 'error', data.message || 'No upcoming events found on that page.')
      } else {
        await fetch('/api/save-org', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: org.name, website_url: urlToUse, place_id: org.place_id, town })
        })
        const feedNote = data.feedDetected ? ' (iCal feed found and used)' : ''
        setOrgStatus(index, 'done', `${data.imported} events imported, ${data.skipped} skipped${feedNote} — saved to Import Events`)
      }
    } catch {
      setOrgStatus(index, 'error', 'Extraction failed. Try again.')
    }
  }

  async function connectAllFeeds() {
    const feedOrgs = visible.filter(o => o.feed_url && !o.feed_already_connected && o.selected)
    for (let i = 0; i < orgs.length; i++) {
      if (feedOrgs.find(f => f.name === orgs[i].name)) {
        await connectFeed(i)
      }
    }
  }

  const visible = orgs.filter(o => !o.dismissed)
  const withFeed = visible.filter(o => o.feed_url && !o.feed_already_connected && !o.already_imported)
  const withoutFeed = visible.filter(o => !o.feed_url && !o.already_imported)
  const alreadyImported = visible.filter(o => o.already_imported || o.feed_already_connected)

  const btn: React.CSSProperties = {
    border: 'none', borderRadius: '6px', padding: '5px 12px',
    fontSize: '11px', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
  }

  function OrgCard({ org, index }: { org: OrgResult; index: number }) {
    const isWorking = org.status === 'connecting' || org.status === 'extracting'
    const isDone = org.status === 'done'
    const isError = org.status === 'error'

    return (
      <div style={{
        background: 'white', borderRadius: '10px', padding: '14px 16px',
        marginBottom: '8px', border: `1.5px solid ${isDone ? '#bbf7d0' : isError ? '#fecaca' : '#e5e7eb'}`,
        opacity: org.already_imported || org.feed_already_connected ? 0.6 : 1,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>

          {!org.already_imported && !org.feed_already_connected && (
            <div onClick={() => toggleSelect(index)}
              style={{
                width: '16px', height: '16px', borderRadius: '4px', flexShrink: 0,
                marginTop: '2px', cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                background: org.selected ? '#1a3d2b' : 'white',
                border: `1.5px solid ${org.selected ? '#1a3d2b' : '#d1d5db'}`,
              }}>
              {org.selected && <span style={{ color: 'white', fontSize: '10px', lineHeight: 1 }}>✓</span>}
            </div>
          )}

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: 500, color: '#1f2937', marginBottom: '2px' }}>
              {org.name}
            </div>
            <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '2px' }}>{org.address}</div>
            {org.website && (
              <a href={org.website} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: '11px', color: '#3a7d44', textDecoration: 'none' }}>
                {org.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
              </a>
            )}
            {org.extraction_url && org.extraction_url !== org.website && (
              <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                📅 Events page: {org.extraction_url.replace(/^https?:\/\//, '')}
              </div>
            )}
            {org.reason && (
              <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '3px', fontStyle: 'italic' }}>
                {org.reason}
              </div>
            )}
            {org.feed_url && !org.feed_already_connected && (
              <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '3px', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                {org.feed_url}
              </div>
            )}

            {(isDone || isError) && (
              <div style={{
                marginTop: '8px', fontSize: '12px', padding: '6px 10px', borderRadius: '6px',
                background: isDone ? '#f0fdf4' : '#fef2f2',
                color: isDone ? '#16803c' : '#dc2626',
              }}>
                {isDone ? '✓ ' : '⚠ '}{org.statusMessage}
              </div>
            )}

            {org.confirmingDismiss && (
              <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', color: '#6b7280' }}>Remove this org?</span>
                <button onClick={() => dismissOrg(index)}
                  style={{ ...btn, background: '#f3f4f6', color: '#374151', padding: '4px 10px' }}>
                  Just this session
                </button>
                <button onClick={() => blockOrg(index)}
                  style={{ ...btn, background: '#dc2626', color: 'white', padding: '4px 10px' }}>
                  Block permanently
                </button>
                <button onClick={() => cancelDismiss(index)}
                  style={{ ...btn, background: 'transparent', color: '#9ca3af', padding: '4px 6px' }}>
                  Cancel
                </button>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
            {org.already_imported && (
              <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '999px', background: '#f3f4f6', color: '#6b7280' }}>
                Already in Import
              </span>
            )}
            {org.feed_already_connected && (
              <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '999px', background: '#eff6ff', color: '#1d4ed8' }}>
                Feed connected
              </span>
            )}
            {!org.already_imported && !org.feed_already_connected && org.feed_url && (
              <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '999px', background: '#eff6ff', color: '#1d4ed8' }}>
                iCal feed found
              </span>
            )}
            {!org.already_imported && !org.feed_already_connected && !org.feed_url && (
              <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '999px', background: '#fef9c3', color: '#854d0e' }}>
                No feed found
              </span>
            )}

            {!org.already_imported && !org.feed_already_connected && !isDone && (
              org.feed_url ? (
                <button onClick={() => connectFeed(index)} disabled={isWorking}
                  style={{ ...btn, background: isWorking ? '#9ca3af' : '#1a3d2b', color: 'white' }}>
                  {org.status === 'connecting' ? 'Connecting…' : 'Connect Feed'}
                </button>
              ) : (
                <button onClick={() => extractWithAI(index)} disabled={isWorking}
                  style={{ ...btn, background: 'white', color: '#C9952A', border: '1.5px solid #C9952A' }}>
                  {org.status === 'extracting' ? 'Extracting…' : 'Extract with AI'}
                </button>
              )
            )}

            {!org.confirmingDismiss && (
              <button onClick={() => startDismiss(index)}
                style={{ ...btn, background: 'transparent', color: '#9ca3af', border: 'none', padding: '2px 4px', fontSize: '13px' }}
                title="Remove from list">
                ✕
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f2f3f5', fontFamily: 'sans-serif' }}>
      <AdminHeader
        rightSlot={
          <button onClick={() => router.push('/admin')}
            style={{ background: 'transparent', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.3)', padding: '6px 14px', borderRadius: '999px', fontSize: '12px', cursor: 'pointer' }}>
            ← Admin
          </button>
        }
      />

      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '40px 24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 500, color: '#1f2937', marginBottom: '6px' }}>
          Org Discovery Agent
        </h1>
        <p style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '32px' }}>
          Enter a town to discover local organizations that likely host community events.
        </p>

        <div style={{ background: 'white', borderRadius: '12px', padding: '24px', marginBottom: '24px', border: '1.5px solid #e5e7eb', display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
          <div style={{ flex: 2 }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#374151', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Town
            </label>
            <input
              value={town}
              onChange={e => !lockedTown && setTown(e.target.value)}
              readOnly={!!lockedTown}
              style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', background: lockedTown ? '#f9fafb' : 'white', cursor: lockedTown ? 'default' : 'text' }}
              placeholder="e.g. Mill Valley"
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#374151', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              State
            </label>
            <input
              value={state}
              onChange={e => setState(e.target.value)}
              style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
              placeholder="CA"
            />
          </div>
          <button
            onClick={handleDiscover}
            disabled={loading}
            style={{ background: '#1a3d2b', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 24px', fontSize: '14px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
            {loading ? 'Discovering…' : 'Discover Orgs'}
          </button>
        </div>

        {loading && runProgress && (
          <div style={{ background: 'white', borderRadius: '12px', padding: '24px', textAlign: 'center', border: '1.5px solid #e5e7eb', marginBottom: '16px' }}>
            <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '10px' }}>
              Checked {runProgress.processed_count} of {runProgress.total_orgs} candidates…
            </p>
            <div style={{ height: '6px', borderRadius: '999px', background: '#f2f3f5', overflow: 'hidden', marginBottom: '10px' }}>
              <div style={{
                height: '100%',
                width: runProgress.total_orgs > 0 ? `${Math.min(100, (runProgress.processed_count / runProgress.total_orgs) * 100)}%` : '0%',
                background: '#1a3d2b',
                transition: 'width 0.3s ease',
              }} />
            </div>
            <p style={{ fontSize: '12px', color: '#9ca3af' }}>
              {runProgress.blocked_skipped > 0 && `${runProgress.blocked_skipped} blocked skipped · `}
              {runProgress.already_known_skipped > 0 && `${runProgress.already_known_skipped} already known · `}
              Results appear below as they're found
            </p>
          </div>
        )}

        {error && (
          <div style={{ background: '#fee2e2', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#dc2626' }}>
            ⚠ {error}
          </div>
        )}

        {orgs.length > 0 && (
          <div>
            <div style={{ fontSize: '15px', fontWeight: 500, color: '#1f2937', marginBottom: '2px' }}>
              Found {visible.length} orgs likely to have events
            </div>
            <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '20px' }}>
              {runProgress && `out of ${runProgress.total_orgs} places searched in ${town}`}
              {withFeed.length > 0 && ` · iCal feed found for ${withFeed.length}`}
              {withoutFeed.length > 0 && ` · AI extraction available for ${withoutFeed.length}`}
            </div>

            {withFeed.length > 0 && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div onClick={() => toggleSelectAll(withFeed)}
                      style={{
                        width: '14px', height: '14px', borderRadius: '3px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: withFeed.every(o => o.selected) ? '#1a3d2b' : 'white',
                        border: `1.5px solid ${withFeed.every(o => o.selected) ? '#1a3d2b' : '#d1d5db'}`,
                      }}>
                      {withFeed.every(o => o.selected) && <span style={{ color: 'white', fontSize: '9px' }}>✓</span>}
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                      iCal feed found ({withFeed.length})
                    </span>
                  </div>
                  <button onClick={connectAllFeeds}
                    style={{ ...btn, background: '#1a3d2b', color: 'white', padding: '6px 14px', fontSize: '12px' }}>
                    Connect all selected feeds
                  </button>
                </div>
                {orgs.map((org, i) =>
                  !org.dismissed && org.feed_url && !org.feed_already_connected && !org.already_imported
                    ? <OrgCard key={org.place_id} org={org} index={i} />
                    : null
                )}
              </>
            )}

            {withoutFeed.length > 0 && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: `${withFeed.length > 0 ? '24px' : '0'} 0 10px` }}>
                  <div onClick={() => toggleSelectAll(withoutFeed)}
                    style={{
                      width: '14px', height: '14px', borderRadius: '3px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: withoutFeed.every(o => o.selected) ? '#1a3d2b' : 'white',
                      border: `1.5px solid ${withoutFeed.every(o => o.selected) ? '#1a3d2b' : '#d1d5db'}`,
                    }}>
                    {withoutFeed.every(o => o.selected) && <span style={{ color: 'white', fontSize: '9px' }}>✓</span>}
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                    No feed — extract with AI ({withoutFeed.length})
                  </span>
                </div>
                {orgs.map((org, i) =>
                  !org.dismissed && !org.feed_url && !org.already_imported
                    ? <OrgCard key={org.place_id} org={org} index={i} />
                    : null
                )}
              </>
            )}

            {alreadyImported.length > 0 && (
              <>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '24px 0 10px' }}>
                  Already in Import Events ({alreadyImported.length})
                </div>
                {orgs.map((org, i) =>
                  !org.dismissed && (org.already_imported || org.feed_already_connected)
                    ? <OrgCard key={org.place_id} org={org} index={i} />
                    : null
                )}
              </>
            )}
          </div>
        )}

        {/* Blocked Orgs Manager */}
        <div style={{ marginTop: '48px', borderTop: '1.5px solid #e5e7eb', paddingTop: '24px' }}>
          <button
            onClick={() => { setShowBlocked(!showBlocked); if (!showBlocked) loadBlockedOrgs() }}
            style={{ background: 'none', border: 'none', fontSize: '12px', color: '#9ca3af', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
            {showBlocked ? '▲ Hide' : '▼ Show'} blocked orgs for {town}
          </button>
          {showBlocked && (
            <div style={{ marginTop: '12px' }}>
              {blockedOrgs.length === 0 ? (
                <div style={{ fontSize: '13px', color: '#9ca3af' }}>No blocked orgs for {town}.</div>
              ) : (
                blockedOrgs.map(b => (
                  <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', border: '1.5px solid #e5e7eb', borderRadius: '8px', padding: '10px 14px', marginBottom: '6px' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: '#1f2937' }}>{b.name}</div>
                      {b.website && <div style={{ fontSize: '11px', color: '#9ca3af' }}>{b.website}</div>}
                    </div>
                    <button
                      onClick={() => unblockOrg(b.id)}
                      style={{ background: 'white', color: '#1a3d2b', border: '1.5px solid #1a3d2b', padding: '5px 12px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      Unblock
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

export default function DiscoverOrgs() {
  return (
    <Suspense fallback={<div style={{ padding: '40px', fontFamily: 'sans-serif' }}>Loading…</div>}>
      <DiscoverOrgsInner />
    </Suspense>
  )
}