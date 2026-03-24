'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../supabase'

export default function Admin() {
  const router = useRouter()
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')

  useEffect(() => {
    loadEvents()
  }, [filter])

  async function loadEvents() {
    setLoading(true)
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('status', filter)
      .order('created_at', { ascending: false })
    if (!error) setEvents(data || [])
    setLoading(false)
  }

  async function updateStatus(id: number, status: string) {
    const { error } = await supabase
      .from('events')
      .update({ status })
      .eq('id', id)
    if (!error) {
      setEvents(prev => prev.filter(ev => ev.id !== id))
    }
  }

  return (
    <div style={{minHeight:'100vh',background:'#fafaf8',fontFamily:'sans-serif'}}>
      <header style={{background:'#1a3d2b',padding:'14px 40px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <span style={{fontWeight:800,fontSize:'22px',color:'white',letterSpacing:'-1px'}}>town</span>
          <span style={{fontWeight:800,fontSize:'22px',color:'#e6a020',letterSpacing:'-1px',textTransform:'uppercase'}}>STIR</span>
          <span style={{fontSize:'12px',color:'rgba(255,255,255,0.5)',marginLeft:'12px'}}>Admin</span>
        </div>
        <div style={{display:'flex',gap:'10px'}}>
          <button onClick={() => router.push('/admin/import')}
            style={{background:'transparent',color:'rgba(255,255,255,0.7)',border:'1.5px solid rgba(255,255,255,0.3)',padding:'8px 18px',borderRadius:'999px',fontWeight:600,fontSize:'13px',cursor:'pointer'}}>
            ⬇️ iCal Import
          </button>
          <button onClick={() => router.push('/')}
            style={{background:'transparent',color:'rgba(255,255,255,0.7)',border:'1.5px solid rgba(255,255,255,0.3)',padding:'8px 18px',borderRadius:'999px',fontWeight:600,fontSize:'13px',cursor:'pointer'}}>
            ← Calendar
          </button>
        </div>
      </header>

      <div style={{maxWidth:'900px',margin:'0 auto',padding:'32px 24px 80px'}}>
        <h1 style={{fontFamily:'Georgia,serif',fontSize:'28px',fontWeight:900,color:'#1f2937',marginBottom:'6px'}}>
          Moderation Queue
        </h1>
        <p style={{color:'#9ca3af',fontSize:'14px',marginBottom:'24px'}}>
          Review and approve submitted events before they go live.
        </p>

        <div style={{display:'flex',gap:'8px',marginBottom:'24px'}}>
          {['pending','approved','rejected'].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              style={{padding:'8px 20px',borderRadius:'999px',border:'1.5px solid',
                borderColor:filter===s?'#1a3d2b':'#e5e7eb',
                background:filter===s?'#1a3d2b':'white',
                color:filter===s?'white':'#6b7280',
                fontWeight:600,fontSize:'13px',cursor:'pointer',
                textTransform:'capitalize'}}>
              {s}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{textAlign:'center',padding:'40px',color:'#9ca3af'}}>Loading…</div>
        ) : events.length === 0 ? (
          <div style={{textAlign:'center',padding:'60px 20px',color:'#9ca3af'}}>
            <div style={{fontSize:'40px',marginBottom:'12px'}}>📭</div>
            <p>No {filter} events.</p>
          </div>
        ) : (
          events.map(ev => (
            <div key={ev.id} style={{background:'white',borderRadius:'12px',padding:'20px',marginBottom:'12px',boxShadow:'0 2px 8px rgba(0,0,0,0.06)',borderLeft:'4px solid #e5e7eb'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'12px'}}>
                <div style={{flex:1}}>
                  <h3 style={{fontSize:'16px',fontWeight:700,color:'#1f2937',marginBottom:'4px'}}>{ev.title}</h3>
                  <div style={{fontSize:'13px',color:'#6b7280'}}>
                    📅 {ev.date} &nbsp;·&nbsp; 🕐 {ev.time} &nbsp;·&nbsp; 📍 {ev.location}
                  </div>
                  <div style={{fontSize:'13px',color:'#6b7280',marginTop:'2px'}}>
                    👥 {ev.organization} &nbsp;·&nbsp; 🏷️ {ev.category}
                    {ev.cost && <>&nbsp;·&nbsp; 💰 {ev.cost}</>}
                  </div>
                </div>
                <div style={{fontSize:'11px',color:'#9ca3af',flexShrink:0,marginLeft:'12px'}}>#{ev.id}</div>
              </div>

              <p style={{fontSize:'13px',color:'#4b5563',lineHeight:1.6,marginBottom:'16px',padding:'12px',background:'#f9fafb',borderRadius:'8px'}}>
                {ev.description}
              </p>

              <div style={{fontSize:'12px',color:'#9ca3af',marginBottom:'16px'}}>
                {ev.email && <span>📧 {ev.email}&nbsp;&nbsp;</span>}
                {ev.website && <span>🌐 {ev.website}&nbsp;&nbsp;</span>}
                {ev.tags && <span>🏷️ {ev.tags}</span>}
              </div>

              {filter === 'pending' && (
                <div style={{display:'flex',gap:'8px'}}>
                  <button onClick={() => updateStatus(ev.id, 'approved')}
                    style={{background:'#16803c',color:'white',border:'none',padding:'9px 22px',borderRadius:'999px',fontWeight:700,fontSize:'13px',cursor:'pointer'}}>
                    ✓ Approve
                  </button>
                  <button onClick={() => updateStatus(ev.id, 'rejected')}
                    style={{background:'white',color:'#dc2626',border:'1.5px solid #dc2626',padding:'9px 22px',borderRadius:'999px',fontWeight:700,fontSize:'13px',cursor:'pointer'}}>
                    ✕ Reject
                  </button>
                </div>
              )}
              {filter === 'rejected' && (
                <button onClick={() => updateStatus(ev.id, 'approved')}
                  style={{background:'#16803c',color:'white',border:'none',padding:'9px 22px',borderRadius:'999px',fontWeight:700,fontSize:'13px',cursor:'pointer'}}>
                  ✓ Approve anyway
                </button>
              )}
              {filter === 'approved' && (
                <button onClick={() => updateStatus(ev.id, 'rejected')}
                  style={{background:'white',color:'#dc2626',border:'1.5px solid #dc2626',padding:'9px 22px',borderRadius:'999px',fontWeight:700,fontSize:'13px',cursor:'pointer'}}>
                  ✕ Remove from calendar
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}