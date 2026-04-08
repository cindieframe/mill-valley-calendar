'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../supabase'

export default function AuthConfirm() {
  const router = useRouter()

  useEffect(() => {
    async function handleConfirm() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.push('/org/login')
      } else {
        // Wait for Supabase to process the token from the URL
        const { data, error } = await supabase.auth.exchangeCodeForSession(
          window.location.href
        )
        if (data.session) {
          router.push('/org/login')
        } else {
          router.push('/org/signup')
        }
      }
    }
    handleConfirm()
  }, [router])

  return (
    <div style={{ minHeight: '100vh', background: '#fafaf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '40px', marginBottom: '16px' }}>🌲</div>
        <p style={{ color: '#6b7280', fontSize: '15px' }}>Confirming your email…</p>
      </div>
    </div>
  )
}