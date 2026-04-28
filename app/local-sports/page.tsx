'use client'

import Header from '../components/Header'
import { colors, fonts, styles } from '@/app/lib/tokens'

export default function LocalSports() {
  return (
    <div style={styles.page}>
      <Header
        rightSlot={
          <a href="/org/login" style={{ color: 'rgba(255,255,255,0.65)', fontSize: '13px', textDecoration: 'none' }}>
            Org Login
          </a>
        }
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 52px)', padding: '40px 24px' }}>
        <div style={{ textAlign: 'center', maxWidth: '480px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 400, color: colors.textPrimary, marginBottom: '12px', fontFamily: fonts.sans }}>
            Local Sports &mdash;{' '}
            <em style={{ fontFamily: fonts.serif, fontStyle: 'italic', color: colors.navBg }}>Mill Valley</em>
          </h1>
          <p style={{ fontSize: '15px', color: colors.textSecondary, lineHeight: 1.7, marginBottom: '8px' }}>
            We're working on bringing local sports scores, schedules, and standings to Townstir.
          </p>
          <p style={{ fontSize: '14px', color: colors.textSecondary, lineHeight: 1.7 }}>
            Youth leagues, high school games, adult rec sports — all in one place. Coming soon.
          </p>
        </div>
      </div>
    </div>
  )
}