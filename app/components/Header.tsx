'use client';

// app/components/Header.tsx
// Shared header imported by ALL Townstir pages.
// Renders the nav bar with logo + section switcher + optional right-side slot.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { colors, fonts, styles } from '@/app/lib/tokens';

type HeaderVariant = 'default' | 'admin' | 'org';

interface HeaderProps {
  rightSlot?: React.ReactNode;
  variant?: HeaderVariant;
}

const SECTIONS = [
  { label: 'Events',       href: '/' },
  { label: 'Volunteering', href: '/volunteering' },
  { label: 'Local Sports', href: '/local-sports' },
]

export default function Header({ rightSlot, variant = 'default' }: HeaderProps) {
  const pathname = usePathname()
  const logoHref = variant === 'admin' ? '/admin' : variant === 'org' ? '/org/dashboard' : '/'

  const isVolunteering = pathname?.startsWith('/volunteering') || pathname?.startsWith('/post-opportunity')
  const isLocalSports = pathname?.startsWith('/local-sports')
  const activeHref = isVolunteering ? '/volunteering' : isLocalSports ? '/local-sports' : '/'

  return (
    <nav style={styles.nav}>

      {/* Logo */}
      <Link href={logoHref} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0px', flexShrink: 0 }}>
        <span style={styles.logoTown}>town</span>
        <span style={styles.logoStir}>stir</span>
      </Link>

      {/* Variant badge (admin / org) */}
      {variant !== 'default' && (
        <span style={{
          marginLeft: '12px',
          fontSize: '11px',
          fontFamily: fonts.sans,
          fontWeight: 500,
          color: 'rgba(255,255,255,0.55)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          paddingTop: '2px',
        }}>
          {variant === 'admin' ? 'Admin' : 'Org'}
        </span>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Section switcher — default variant only */}
      {variant === 'default' && (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {SECTIONS.map(({ label, href }) => {
            const isActive = href === activeHref
            return (
              <Link key={label} href={href} style={{
                color: isActive ? colors.textWhite : 'rgba(255,255,255,0.72)',
                fontSize: '13px',
                fontFamily: fonts.sans,
                fontWeight: isActive ? 500 : 400,
                textDecoration: 'none',
                padding: '0 14px',
                height: '52px',
                display: 'inline-flex',
                alignItems: 'center',
                borderBottom: isActive ? `2px solid ${colors.logoAccent}` : '2px solid transparent',
              }}>
                {label}
              </Link>
            )
          })}

          {/* Divider */}
          <span style={{
            width: '1px',
            height: '18px',
            background: 'rgba(255,255,255,0.4)',
            margin: '0 16px 0 4px',
            display: 'inline-block',
            flexShrink: 0,
          }} />
        </div>
      )}

      {/* Right slot — Org Login, Post Event/Opportunity etc */}
      {rightSlot && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {rightSlot}
        </div>
      )}

    </nav>
  )
}

export function AdminHeader({ rightSlot }: { rightSlot?: React.ReactNode }) {
  return <Header variant="admin" rightSlot={rightSlot} />;
}

export function OrgHeader({ rightSlot }: { rightSlot?: React.ReactNode }) {
  return <Header variant="org" rightSlot={rightSlot} />;
}
