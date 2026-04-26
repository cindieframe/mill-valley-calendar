'use client'

import { useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
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
  // UI state per org
  selected: boolean
  status: 'idle' | 'connecting' | 'extracting' | 'done' | 'error'
  statusMessage: string
  dismissed: boolean
}

function DiscoverOrgsInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const lockedTown = searchParams.get('town')
  const [town, setTown] = useState(lockedTown || 'Mill Valley')
  const [state, setState] = useState('CA')
  const [loading, setLoading] = useState(false)
  const [orgs, setOrgs] = useState<OrgResult[]>([])
  const [summary, setSummary] = useState<{ total_found: number; town: string; orgs_with_events: number } | null>(null)
  const [error, setError] = useState('')

  async function handleDiscover() {
    setLoading(true)
    setError('')
    setOrgs([])
    setSummary(null)
    try {
      const res = await fetch('/api/discover-orgs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ town, state })
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        setSummary({ total_found: data.total_found, town: data.town, orgs_with_events: data.orgs_with_events })
        setOrgs(
          data.orgs.map((o: any) => ({
            ...o,
            selected: !o.already_imported && !o.feed_already_connected,
            status: 'idle',
            statusMessage: '',
            dismissed: false,
          }))
        )
      }
    } catch {
      setError('Discovery failed. Please try again.')
    }
    setLoading(false)
  }

  function toggleSelect(index: number) {
    setOrgs(prev => prev.map((o, i) => i === index ? { ...o, selected: !o.selected } : o))
  }

  function toggleSelectAll(group: OrgResult[]) {
    const allSelected = group.every(o => o.selected)
    const names = new Set(group.map(o => o.name))
    setOrgs(prev => prev.map(o => names.has(o.name) ? { ...o, selected: !allSelected } : o))
  }

  function dismissOrg(index: number) {
    setOrgs(prev => prev.map((o, i) => i === index ? { ...o, dismissed: true } : o))
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
        body: JSON.stringify({ feedUrl: org.feed_url, organization: org.name })
      })
      const data = await res.json()
      if (data.error) {
        setOrgStatus(index, 'error', data.error)
      } else {
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
        body: JSON.stringify({ websiteUrl: urlToUse, organization: org.name })
      })
      const data = await res.json()
      if (data.error) {
        setOrgStatus(index, 'error', data.error)
      } else if (data.imported === 0 && data.skipped === 0) {
        setOrgStatus(index, 'error', data.message || 'No upcoming events found on that page.')
      } else {
        // Save org to organizations table so it appears in Import Events for future re-extraction
        await fetch('/api/save-org', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: org.name, website_url: urlToUse })
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

          {/* Checkbox — only for actionable orgs */}
          {!org.already_imported && !org.feed_already_connected && (
            <div
              onClick={() => toggleSelect(index)}
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

          {/* Info */}
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

            {/* Inline result */}
            {(isDone || isError) && (
              <div style={{
                marginTop: '8px', fontSize: '12px', padding: '6px 10px', borderRadius: '6px',
                background: isDone ? '#f0fdf4' : '#fef2f2',
                color: isDone ? '#16803c' : '#dc2626',
              }}>
                {isDone ? '✓ ' : '⚠ '}{org.statusMessage}
              </div>
            )}
          </div>

          {/* Right side: badge + action + delete */}
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

            {/* Action button */}
            {!org.already_imported && !org.feed_already_connected && !isDone && (
              org.feed_url ? (
                <button
                  onClick={() => connectFeed(index)}
                  disabled={isWorking}
                  style={{ ...btn, background: isWorking ? '#9ca3af' : '#1a3d2b', color: 'white' }}>
                  {org.status === 'connecting' ? 'Connecting…' : 'Connect Feed'}
                </button>
              ) : (
                <button
                  onClick={() => extractWithAI(index)}
                  disabled={isWorking}
                  style={{ ...btn, background: 'white', color: '#C9952A', border: '1.5px solid #C9952A' }}>
                  {org.status === 'extracting' ? 'Extracting…' : 'Extract with AI'}
                </button>
              )
            )}

            {/* Delete */}
            <button
              onClick={() => dismissOrg(index)}
              style={{ ...btn, background: 'transparent', color: '#9ca3af', border: 'none', padding: '2px 4px', fontSize: '13px' }}
              title="Remove from list">
              ✕
            </button>

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

        {/* Input */}
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

        {loading && (
          <div style={{ background: 'white', borderRadius: '12px', padding: '40px', textAlign: 'center', border: '1.5px solid #e5e7eb' }}>
            <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '8px' }}>Searching Google Places, checking for iCal feeds, and assessing orgs…</p>
            <p style={{ fontSize: '12px', color: '#9ca3af' }}>This can take up to 5 minutes</p>
          </div>
        )}

        {error && (
          <div style={{ background: '#fee2e2', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#dc2626' }}>
            ⚠ {error}
          </div>
        )}

        {summary && orgs.length > 0 && (
          <div>
            <div style={{ fontSize: '15px', fontWeight: 500, color: '#1f2937', marginBottom: '2px' }}>
              Found {summary.orgs_with_events ?? visible.length} orgs likely to have events
            </div>
            <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '20px' }}>
              out of {summary.total_found} places searched in {summary.town}
              {withFeed.length > 0 && ` · iCal feed found for ${withFeed.length}`}
              {withoutFeed.length > 0 && ` · AI extraction available for ${withoutFeed.length}`}
            </div>

            {/* iCal feed section */}
            {withFeed.length > 0 && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div
                      onClick={() => toggleSelectAll(withFeed)}
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
                  <button
                    onClick={connectAllFeeds}
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

            {/* No feed section */}
            {withoutFeed.length > 0 && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: `${withFeed.length > 0 ? '24px' : '0'} 0 10px` }}>
                  <div
                    onClick={() => toggleSelectAll(withoutFeed)}
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

            {/* Already imported section */}
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