'use client';

// app/components/Header.tsx
// Shared header imported by ALL Townstir pages.
// Renders the nav bar with logo + optional right-side slot for page-specific CTAs.
//
// Usage examples:
//   <Header />                            — logo only (org pages, detail pages)
//   <Header rightSlot={<PostEventButton />} />  — with CTA
//   <Header variant="admin" />            — admin label next to logo

import Link from 'next/link';
import { colors, fonts, styles, spacing } from '@/app/lib/tokens';

type HeaderVariant = 'default' | 'admin' | 'org';

interface HeaderProps {
  /** Optional content rendered on the right side of the nav (e.g. buttons) */
  rightSlot?: React.ReactNode;
  /** Visual variant — affects any supplemental label shown next to the logo */
  variant?: HeaderVariant;
}

export default function Header({ rightSlot, variant = 'default' }: HeaderProps) {
  const logoHref = variant === 'admin' ? '/admin' : variant === 'org' ? '/org/dashboard' : '/';

  return (
    <nav style={styles.nav}>
      {/* Logo */}
      <Link href={logoHref} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0px' }}>
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

      {/* Right slot — caller provides page-specific buttons */}
      {rightSlot && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {rightSlot}
        </div>
      )}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Convenience wrappers so call sites don't need to pass variant every time
// ---------------------------------------------------------------------------

export function AdminHeader({ rightSlot }: { rightSlot?: React.ReactNode }) {
  return <Header variant="admin" rightSlot={rightSlot} />;
}

export function OrgHeader({ rightSlot }: { rightSlot?: React.ReactNode }) {
  return <Header variant="org" rightSlot={rightSlot} />;
}